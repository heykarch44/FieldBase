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
  writeSessionCache,
  readCachedSites,
  readCachedClockLabels,
  writeLastPosition,
  appendSample,
  readSamples,
  readSiteOutsideMap,
  writeSiteOutsideMap,
  appendDiag,
  type CachedSession,
} from "./sessionCache";
import { supabase } from "./supabase";
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

async function fireClockInNotification(
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
        title: labels.clockIn,
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
// (avoids GPS jitter at the edge clocking you out). Tightened from 50m
// because Home-style 35m radii were producing 85m total before exit could
// fire — large enough that GPS drift kept users "inside" for 10+ minutes
// after a real departure.
const EXIT_BUFFER_M = 15;

// How long you must be continuously outside all sites before we write
// the clock_out. Catches quick trips to the truck for tools.
const DWELL_EXIT_SECS = 120;

// Number of consecutive most-recent samples that must all be inside a
// site's radius before we declare a dwell-based ENTER. Mirrors the
// foreground reconcile's "confidently inside" check but uses sample
// continuity instead of GPS-accuracy padding.
const ENTER_CONSECUTIVE = 3;

// Don't insert a clock_in if one already exists for this user+site within
// this many seconds (regardless of source). Protects against races with
// foreground reconcile and the iOS geofence Enter callback.
const ENTER_DEDUP_SECS = 60;

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

interface LocationTaskBody {
  locations?: Location.LocationObject[];
}

// Tracks whether we've already emitted the "session-loaded" diag for this
// JS context. iOS recreates the JS context across cold starts, so this
// resets naturally on each process spin-up — exactly when we want to see
// the line again.
let sessionLoadedLogged = false;

// Resolve a usable session for background inserts. Tries multiple sources
// because the dwell task runs in its own JS context that may not have
// rehydrated the in-memory supabase client yet:
//   1. supabase.auth.getSession() — reads from SecureStore via the
//      configured adapter and auto-refreshes if needed
//   2. readSessionCache() — the manual SecureStore cache written by
//      AuthProvider; survives even if the supabase client hasn't loaded
//   3. If we got tokens from (2) but supabase has no live session, push
//      them in via setSession so subsequent calls in this context work
//
// Returns null on any of the granular failure modes after logging which
// one was hit. org_id comes only from the manual cache because Supabase
// sessions don't carry our app-level org assignment.
async function loadBackgroundSession(): Promise<CachedSession | null> {
  let userId: string | null = null;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      await appendDiag("dwell", `getSession-error ${String(error.message ?? error)}`);
    }
    const sb = data?.session ?? null;
    if (sb?.access_token && sb.user?.id) {
      userId = sb.user.id;
      accessToken = sb.access_token;
      refreshToken = sb.refresh_token ?? null;
    }
  } catch (e) {
    await appendDiag("dwell", `getSession-throw ${String(e)}`);
  }

  // Fall back to the manual SecureStore cache (or use it for org_id even
  // when supabase resolved the session).
  const manual = await readSessionCache();
  if (!userId || !accessToken) {
    if (!manual) {
      await appendDiag("dwell", "no-session-from-storage");
      return null;
    }
    userId = manual.userId;
    accessToken = manual.accessToken;
    refreshToken = manual.refreshToken ?? refreshToken;

    // Prime the supabase client for any subsequent calls in this context.
    if (manual.refreshToken) {
      try {
        await supabase.auth.setSession({
          access_token: manual.accessToken,
          refresh_token: manual.refreshToken,
        });
      } catch {
        // best-effort — REST inserts don't depend on the live client
      }
    }
  }

  if (!userId || !accessToken) {
    await appendDiag("dwell", "no-session-from-supabase");
    return null;
  }

  const orgId = manual?.orgId ?? null;
  if (!orgId) {
    await appendDiag("dwell", "no-org-id");
    return null;
  }

  // Refresh the persisted cache if supabase produced a newer token than
  // what we had on disk. Keeps the geofence task and a future dwell tick
  // from operating on a stale token.
  if (manual && (manual.accessToken !== accessToken || manual.userId !== userId)) {
    try {
      await writeSessionCache({
        userId,
        orgId,
        accessToken,
        refreshToken: refreshToken ?? manual.refreshToken ?? null,
      });
    } catch {
      // non-fatal
    }
  }

  if (!sessionLoadedLogged) {
    sessionLoadedLogged = true;
    await appendDiag("dwell", `session-loaded user=${userId} org=${orgId}`);
  }

  return {
    userId,
    orgId,
    accessToken,
    refreshToken: refreshToken ?? null,
  };
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

// Returns the user's most recent event across ALL jobsites. Used to enforce
// the one-clock-at-a-time invariant before a dwell ENTER inserts a clock_in:
// if the most recent event anywhere is a clock_in, the user is still on the
// clock somewhere else and we must not double-clock them in.
async function fetchLastEventAnywhere(params: {
  userId: string;
  accessToken: string;
}): Promise<{
  event_type: string;
  occurred_at: string;
  jobsite_id: string | null;
} | null> {
  const url =
    `${SUPABASE_URL}/rest/v1/time_clock_events` +
    `?user_id=eq.${params.userId}` +
    `&select=event_type,occurred_at,jobsite_id` +
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
      jobsite_id: string | null;
    }>;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function insertClockIn(params: {
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
    event_type: "clock_in",
    source: "dwell_enter",
    occurred_at: params.occurredAtIso,
    lat: params.lat,
    lng: params.lng,
    inside_geofence: true,
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

  const session = await loadBackgroundSession();
  if (!session || !session.orgId) {
    // Granular reason already logged inside loadBackgroundSession.
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

  // Pull the rolling sample buffer once. We use it for two checks below:
  //   - "any sample in the last 2 min outside the radius" → fire exit fast
  //     instead of waiting for 3 consecutive samples to all line up
  //   - "the most recent N samples are all inside" → declare ENTER even
  //     when iOS swallowed the geofence callback
  const recentSamples = await readSamples();

  // Whether the user is currently on the clock anywhere. Loaded lazily on
  // first ENTER candidate so the common (idle, not-near-anything) case
  // doesn't pay the network cost.
  let anywhereLoaded = false;
  let anywhereOpen: boolean | null = null;

  let anyoneInside = false;

  // First pass: figure out who we're inside vs outside, and write events
  // for any site whose dwell window is satisfied OR whose ENTER criteria
  // are met.
  for (const site of sites) {
    const distance = haversineDistance(lat, lng, site.lat, site.lng);
    const inside = distance <= site.radius_m;
    const outsideBuffered = distance > site.radius_m + EXIT_BUFFER_M;

    // Per-evaluation diagnostic line. Lets us see, after the fact, whether
    // the dwell task was actually running and how it judged each site —
    // which is the only way to debug "the app was foreground but nothing
    // fired" reports.
    await appendDiag(
      "dwell",
      `eval site=${site.id} distance=${Math.round(distance)}m inside=${inside}`
    );

    if (inside) {
      anyoneInside = true;
      if (outsideMap[site.id] != null) {
        delete outsideMap[site.id];
        outsideMapDirty = true;
      }

      // ENTER detection: if the last ENTER_CONSECUTIVE samples (across all
      // recent batches, not just this one) are all inside this site's
      // radius, and the user has no open clock_in anywhere, write a
      // back-dated clock_in. Mirrors what foreground reconcile would do
      // on app open, but doesn't require the user to open the app.
      const tail = recentSamples.slice(-ENTER_CONSECUTIVE);
      const haveEnough = tail.length >= ENTER_CONSECUTIVE;
      const allInside =
        haveEnough &&
        tail.every(
          (s) =>
            haversineDistance(s.lat, s.lng, site.lat, site.lng) <= site.radius_m
        );
      if (!allInside) continue;

      // Dedup: skip if a clock_in for this user+site already landed in the
      // last ENTER_DEDUP_SECS seconds (e.g. iOS Enter callback got there
      // first, or foreground reconcile beat us).
      const last = await fetchLastEventAtSite({
        userId: session.userId,
        jobsiteId: site.id,
        accessToken: session.accessToken,
      });
      if (last && last.event_type === "clock_in") {
        const lastMs = Date.parse(last.occurred_at);
        const ageSecs = (Date.now() - lastMs) / 1000;
        if (Number.isFinite(lastMs) && ageSecs < ENTER_DEDUP_SECS) continue;
        // Already on the clock here from an earlier event we haven't seen
        // a corresponding clock_out for — leave it alone.
        continue;
      }

      // One-clock-at-a-time invariant: if the user has an open clock_in at
      // any other site, don't double-clock them in. The dwell exit logic
      // (above on prior ticks) is what should close the other site first.
      if (!anywhereLoaded) {
        const recent = await fetchLastEventAnywhere({
          userId: session.userId,
          accessToken: session.accessToken,
        });
        anywhereOpen = recent?.event_type === "clock_in";
        anywhereLoaded = true;
      }
      if (anywhereOpen) {
        await appendDiag(
          "dwell",
          `enter skip site=${site.id} reason=open-clock-elsewhere`
        );
        continue;
      }

      // Back-date occurred_at to the earliest of the consecutive inside
      // samples — that's when the user actually arrived, not now().
      const earliestInsideMs = tail.reduce(
        (min, s) => (s.sampledAt < min ? s.sampledAt : min),
        tail[0]!.sampledAt
      );
      const occurredAtIso = new Date(earliestInsideMs).toISOString();
      const ok = await insertClockIn({
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
        `enter site=${site.id} ok=${ok} to=${occurredAtIso} reason=consecutive-inside-samples (${ENTER_CONSECUTIVE})`
      );
      if (ok) {
        anywhereOpen = true; // prevent ENTER for any other site this tick
        await fireClockInNotification(site.name ?? "Site", occurredAtIso);
      }
      continue;
    }

    // From here on the most recent sample is OUTSIDE the radius.

    // Fast-path exit: if any persisted sample in the last 2 minutes shows
    // the user past radius+buffer, fire the exit immediately rather than
    // waiting for the dwell window to accumulate via the outsideMap. This
    // catches the case where the OS delivered samples sparsely (e.g. one
    // every 30s) so we never get 3+ consecutive batches showing outside,
    // but the user has objectively been gone for minutes.
    const twoMinAgo = Date.now() - DWELL_EXIT_SECS * 1000;
    const fastExitEvidence = recentSamples.some(
      (s) =>
        s.sampledAt >= twoMinAgo &&
        haversineDistance(s.lat, s.lng, site.lat, site.lng) >
          site.radius_m + EXIT_BUFFER_M
    );

    if (!outsideBuffered && !fastExitEvidence) {
      // In the jitter zone (between radius and radius+buffer) AND no recent
      // hard-outside evidence. Don't reset the timer but don't start it.
      continue;
    }

    // We are definitely outside this site.
    const firstAt = outsideMap[site.id];
    if (firstAt == null && !fastExitEvidence) {
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

    // If fast-exit evidence applies but we don't yet have a firstAt mark,
    // use the earliest qualifying sample from the persisted buffer so the
    // back-date is honest.
    let effectiveFirstAt = firstAt ?? sampleTs;
    if (fastExitEvidence) {
      const earliestOutsideRecent = recentSamples
        .filter(
          (s) =>
            s.sampledAt >= twoMinAgo &&
            haversineDistance(s.lat, s.lng, site.lat, site.lng) >
              site.radius_m + EXIT_BUFFER_M
        )
        .reduce<number | null>(
          (min, s) => (min == null || s.sampledAt < min ? s.sampledAt : min),
          null
        );
      if (earliestOutsideRecent != null) {
        effectiveFirstAt =
          firstAt != null
            ? Math.min(firstAt, earliestOutsideRecent)
            : earliestOutsideRecent;
      }
    } else {
      const outsideFor = (Date.now() - effectiveFirstAt) / 1000;
      if (outsideFor < DWELL_EXIT_SECS) continue;
    }

    // Dwell satisfied (or fast-exit evidence triggered). If the user has an
    // open clock_in at this site, write a clock_out back-dated to when
    // they ACTUALLY left.
    const last = await fetchLastEventAtSite({
      userId: session.userId,
      jobsiteId: site.id,
      accessToken: session.accessToken,
    });
    if (last?.event_type === "clock_in") {
      const occurredAtIso = new Date(effectiveFirstAt).toISOString();
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
        `clock_out ok=${ok} site=${site.id} firstOutside=${occurredAtIso} fast=${fastExitEvidence}`
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
      if (outsideMap[site.id] != null) {
        delete outsideMap[site.id];
        outsideMapDirty = true;
      }
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
