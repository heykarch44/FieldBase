// Dwell-mode background location task.
//
// iOS geofence Enter events are reliable (cell/wifi fingerprinting, zero
// GPS). Exit events are NOT — the OS might not notice you left until you
// enter another region, which can be 30+ minutes later. For payroll this is
// unacceptable.
//
// Strategy:
//   - Geofence Enter spins up this task (startLocationUpdatesAsync).
//   - While running, iOS delivers location samples whenever the user moves
//     beyond `distanceInterval` (10m) — much more responsive than 30s polls.
//   - Each sample is persisted to SecureStore so the foreground reconcile
//     and geofence task can back-date events using the earliest evidence.
//   - On each sample we check: am I outside every registered site?
//     If yes for >= DWELL_EXIT_SECS seconds, write clock_out for each
//     still-open site (back-dated to the first-outside timestamp).
//   - We do NOT auto-stop while the user has any open clock_in. Keeping
//     the task alive keeps iOS waking us, which is the whole point.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import {
  readSessionCache,
  readCachedSites,
  readCachedClockLabels,
  writeLastPosition,
  appendSample,
  readSiteOutsideMap,
  writeSiteOutsideMap,
  appendDiag,
} from "./sessionCache";
import { haversineDistance } from "./geo";

async function fireClockOutNotification(
  siteName: string,
  occurredAtIso: string
): Promise<void> {
  try {
    const labels = await readCachedClockLabels();
    const occurredMs = Date.parse(occurredAtIso);
    const stale =
      Number.isFinite(occurredMs) && Date.now() - occurredMs > 120_000;
    const body = stale
      ? `${siteName} (recorded ${formatRelative(occurredMs)})`
      : siteName;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: labels.clockOut,
        body,
        sound: "default",
      },
      trigger: null,
    });
  } catch {
    // best-effort
  }
}

function formatRelative(ms: number): string {
  const diff = Math.round((Date.now() - ms) / 60_000);
  if (diff < 1) return "just now";
  if (diff === 1) return "1 min ago";
  if (diff < 60) return `${diff} min ago`;
  const hours = Math.floor(diff / 60);
  return hours === 1 ? "1 hr ago" : `${hours} hr ago`;
}

export const LOCATION_TASK = "fieldiq-background-location";

// How far past the radius you must be before we consider you "outside"
// (avoids GPS jitter at the edge clocking you out).
const EXIT_BUFFER_M = 50;

// How long you must be continuously outside all sites before we write
// the clock_out. Catches quick trips to the truck for tools.
const DWELL_EXIT_SECS = 120;

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

interface LocationTaskBody {
  locations?: Location.LocationObject[];
}

// A fetch() with a hard timeout so background task invocations can't hang
// on a slow cell handoff. iOS gives the task only ~30 seconds; a hanging
// fetch wastes that budget and can ripple into UI hangs when the app comes
// foreground while the JS thread is still awaiting the promise.
async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 8000
): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLastEventAtSite(params: {
  userId: string;
  jobsiteId: string;
  accessToken: string;
}): Promise<{ event_type: string; occurred_at: string } | null> {
  const url =
    `${SUPABASE_URL}/rest/v1/time_clock_events` +
    `?user_id=eq.${params.userId}` +
    `&jobsite_id=eq.${params.jobsiteId}` +
    `&select=event_type,occurred_at` +
    `&order=occurred_at.desc` +
    `&limit=1`;
  const res = await timedFetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${params.accessToken}`,
    },
  });
  if (!res || !res.ok) return null;
  try {
    const rows = (await res.json()) as Array<{
      event_type: string;
      occurred_at: string;
    }>;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function insertClockOut(params: {
  userId: string;
  orgId: string;
  jobsiteId: string;
  accessToken: string;
  occurredAtIso: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  distanceFromSiteM: number;
}): Promise<boolean> {
  const body: Record<string, unknown> = {
    org_id: params.orgId,
    user_id: params.userId,
    jobsite_id: params.jobsiteId,
    event_type: "clock_out",
    source: "dwell_exit",
    occurred_at: params.occurredAtIso,
    lat: params.lat,
    lng: params.lng,
    inside_geofence: false,
    distance_from_site_m: params.distanceFromSiteM,
  };
  if (params.accuracyM != null) body.accuracy_m = params.accuracyM;

  const res = await timedFetch(`${SUPABASE_URL}/rest/v1/time_clock_events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${params.accessToken}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return !!res && res.ok;
}

// Wall-clock budget for one location-task invocation. iOS gives ~30s;
// we cap at 20s so we never leave the JS thread hot into foreground.
const LOCATION_TASK_BUDGET_MS = 20_000;

function withBudget<T>(p: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

TaskManager.defineTask<LocationTaskBody>(LOCATION_TASK, async ({ data, error }) => {
  await withBudget(handleLocationSample(data, error), undefined, LOCATION_TASK_BUDGET_MS);
});

async function handleLocationSample(
  data: LocationTaskBody | undefined,
  error: unknown
): Promise<void> {
  if (error) {
    await appendDiag("dwell", `task error: ${String(error)}`);
    return;
  }
  if (!data?.locations?.length) {
    await appendDiag("dwell", "no-locations");
    return;
  }

  const session = await readSessionCache();
  if (!session || !session.orgId) {
    await appendDiag("dwell", "no-session");
    return;
  }

  const sites = await readCachedSites();
  if (sites.length === 0) {
    await appendDiag("dwell", "no-sites");
    return;
  }

  // Persist EVERY sample we receive — including older ones in a batch
  // that iOS deferred. These are what foreground reconcile uses to
  // back-date events. Most-recent first, but appendSample preserves
  // insertion order so we just pass them in chronological order.
  const sortedSamples = [...data.locations].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
  );
  const receivedAt = Date.now();
  for (const s of sortedSamples) {
    const sampledAt = s.timestamp ?? receivedAt;
    const cached = {
      lat: s.coords.latitude,
      lng: s.coords.longitude,
      accuracyM: s.coords.accuracy ?? null,
      sampledAt,
      receivedAt,
    };
    await appendSample(cached);
    await writeLastPosition(cached);
  }

  await appendDiag(
    "dwell",
    `samples=${sortedSamples.length} sites=${sites.length}`
  );

  // Use the most recent sample for the dwell decision.
  const sample = sortedSamples[sortedSamples.length - 1]!;
  const { latitude: lat, longitude: lng } = sample.coords;
  const sampleTs = sample.timestamp ?? receivedAt;
  const sampleAccuracy = sample.coords.accuracy ?? null;

  // Read the persisted "first outside" map. Persisting through SecureStore
  // means we keep state across process kills — critical because iOS can
  // recreate the JS context between samples on a long shift.
  const outsideMap = await readSiteOutsideMap();
  let outsideMapDirty = false;

  let anyoneInside = false;

  // First pass: figure out who we're inside vs outside, and write events
  // for any site whose dwell window is satisfied.
  for (const site of sites) {
    const distance = haversineDistance(lat, lng, site.lat, site.lng);
    const inside = distance <= site.radius_m;
    const outsideBuffered = distance > site.radius_m + EXIT_BUFFER_M;

    if (inside) {
      anyoneInside = true;
      if (outsideMap[site.id] != null) {
        delete outsideMap[site.id];
        outsideMapDirty = true;
      }
      continue;
    }
    if (!outsideBuffered) {
      // In the jitter zone (between radius and radius+buffer). Don't reset
      // the timer but don't start it either.
      continue;
    }

    // We are definitely outside this site.
    const firstAt = outsideMap[site.id];
    if (firstAt == null) {
      // Use the earliest sample we have showing user outside (might be older
      // than this batch if the OS deferred deliveries).
      let earliestOutside = sampleTs;
      for (const s of sortedSamples) {
        const d = haversineDistance(
          s.coords.latitude,
          s.coords.longitude,
          site.lat,
          site.lng
        );
        if (d > site.radius_m + EXIT_BUFFER_M) {
          const t = s.timestamp ?? receivedAt;
          if (t < earliestOutside) earliestOutside = t;
        }
      }
      outsideMap[site.id] = earliestOutside;
      outsideMapDirty = true;
      continue;
    }
    const outsideFor = (Date.now() - firstAt) / 1000;
    if (outsideFor < DWELL_EXIT_SECS) continue;

    // Dwell satisfied. If the user has an open clock_in at this site, write
    // a clock_out (back-dated to firstAt — when they ACTUALLY left).
    const last = await fetchLastEventAtSite({
      userId: session.userId,
      jobsiteId: site.id,
      accessToken: session.accessToken,
    });
    if (last?.event_type === "clock_in") {
      const occurredAtIso = new Date(firstAt).toISOString();
      const ok = await insertClockOut({
        userId: session.userId,
        orgId: session.orgId,
        jobsiteId: site.id,
        accessToken: session.accessToken,
        occurredAtIso,
        lat,
        lng,
        accuracyM: sampleAccuracy,
        distanceFromSiteM: distance,
      });
      await appendDiag(
        "dwell",
        `clock_out ok=${ok} site=${site.id} firstOutside=${new Date(firstAt).toISOString()}`
      );
      if (!ok) {
        // Retry next tick by leaving entry in map but re-arming so we'll
        // try again immediately on the next sample.
        outsideMap[site.id] = Date.now() - DWELL_EXIT_SECS * 1000 - 1000;
      } else {
        delete outsideMap[site.id];
        await fireClockOutNotification(site.name ?? "Site", occurredAtIso);
      }
      outsideMapDirty = true;
    } else {
      // Nothing to close — clear so we don't keep retrying.
      delete outsideMap[site.id];
      outsideMapDirty = true;
    }
  }

  if (outsideMapDirty) {
    await writeSiteOutsideMap(outsideMap);
  }

  // We INTENTIONALLY do not stop the task even when outside everything.
  // iOS gives us "significant location changes" semantics with the
  // AutomotiveNavigation activity type — it pauses internally while the
  // device is stationary, so leaving the task running costs very little.
  // Keeping it running is what makes geofence Enter at the NEXT site
  // detectable in real time even when iOS holds the synthetic Enter event.
  void anyoneInside;
}

export async function startLocationTracking(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (started) {
      await appendDiag("dwell", "start: already-running");
      return;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      // Balanced is the sweet spot — lower than this and iOS won't deliver
      // samples often enough; higher and battery dies. AutomotiveNavigation
      // tells iOS to keep the GPS warm during driving, which is exactly when
      // we need responsiveness for arrive/leave events.
      accuracy: Location.Accuracy.Balanced,
      // Smaller distance interval = more samples = more reliable dwell
      // detection. iOS still throttles when stationary so battery cost
      // is bounded.
      distanceInterval: 10, // meters
      // timeInterval is iOS-ignored when distanceInterval is set, but
      // Android honors it.
      timeInterval: 30_000,
      // Keep task alive when user swipes the app away. Without this iOS kills
      // it on force-close and we lose exit detection.
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        // Android only; required when asking for background location.
        notificationTitle: "FieldIQ",
        notificationBody:
          "Tracking location to detect when you leave a job site.",
      },
      activityType: Location.ActivityType.AutomotiveNavigation,
    });
    await appendDiag("dwell", "start: ok");
  } catch (e) {
    await appendDiag("dwell", `start: error ${String(e)}`);
  }
}

export async function stopLocationTracking(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (!started) return;
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    // Don't clear the persisted outside-map here — foreground reconcile
    // might still want to inspect it.
    await appendDiag("dwell", "stop: ok");
  } catch (e) {
    await appendDiag("dwell", `stop: error ${String(e)}`);
  }
}
