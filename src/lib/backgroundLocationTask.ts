// Dwell-mode background location task.
//
// iOS geofence Enter events are reliable (cell/wifi fingerprinting, zero
// GPS). Exit events are NOT — the OS might not notice you left until you
// enter another region, which can be 30+ minutes later. For payroll this is
// unacceptable.
//
// Strategy:
//   - Geofence Enter still handles clock_in (existing task).
//   - Geofence Enter ALSO spins up this task (startLocationUpdatesAsync).
//   - While running, iOS delivers location samples every ~30s.
//   - On each sample we check: am I outside every registered site?
//     If yes for >= DWELL_EXIT_SECS seconds, write clock_out for each
//     still-open site and stop this task (back to zero-battery mode).
//   - If a new Enter happens while this task is running we just keep going.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import {
  readSessionCache,
  readCachedSites,
  readCachedClockLabels,
} from "./sessionCache";
import { haversineDistance } from "./geo";

async function fireClockOutNotification(siteName: string): Promise<void> {
  try {
    const labels = await readCachedClockLabels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: labels.clockOut,
        body: siteName,
        sound: "default",
      },
      trigger: null,
    });
  } catch {
    // best-effort
  }
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

// Track first-outside timestamp per site across invocations. Persisted in a
// module-level map — survives background task wake-ups within a single
// process. If the process dies we lose it and start fresh, which just means
// the next dwell window restarts (still ends up writing clock_out).
const firstOutsideAt = new Map<string, number>();

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
}): Promise<{ event_type: string } | null> {
  const url =
    `${SUPABASE_URL}/rest/v1/time_clock_events` +
    `?user_id=eq.${params.userId}` +
    `&jobsite_id=eq.${params.jobsiteId}` +
    `&select=event_type` +
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
    const rows = (await res.json()) as Array<{ event_type: string }>;
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
  lat: number;
  lng: number;
}): Promise<boolean> {
  const body = {
    org_id: params.orgId,
    user_id: params.userId,
    jobsite_id: params.jobsiteId,
    event_type: "clock_out",
    source: "dwell_exit",
    occurred_at: new Date().toISOString(),
    lat: params.lat,
    lng: params.lng,
    inside_geofence: false,
  };
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

TaskManager.defineTask<LocationTaskBody>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;

  const session = await readSessionCache();
  if (!session || !session.orgId) return;

  const sites = await readCachedSites();
  if (sites.length === 0) {
    await stopLocationTracking();
    return;
  }

  // Use the most recent sample (iOS can deliver a batch).
  const sample = data.locations[data.locations.length - 1];
  const { latitude: lat, longitude: lng } = sample.coords;
  const now = Date.now();

  let anyoneInside = false;
  const openSiteIds: string[] = [];

  // First pass: figure out who we're inside vs outside.
  for (const site of sites) {
    const distance = haversineDistance(lat, lng, site.lat, site.lng);
    const inside = distance <= site.radius_m;
    const outsideBuffered = distance > site.radius_m + EXIT_BUFFER_M;

    if (inside) {
      anyoneInside = true;
      firstOutsideAt.delete(site.id);
      continue;
    }
    if (!outsideBuffered) {
      // In the jitter zone (between radius and radius+buffer). Don't reset
      // the timer but don't start it either.
      continue;
    }

    // We are definitely outside this site.
    const firstAt = firstOutsideAt.get(site.id);
    if (firstAt == null) {
      firstOutsideAt.set(site.id, now);
      continue;
    }
    const outsideFor = (now - firstAt) / 1000;
    if (outsideFor < DWELL_EXIT_SECS) continue;

    // Dwell satisfied. If the user has an open clock_in at this site, write
    // a clock_out. Remember to clear the tracker regardless.
    firstOutsideAt.delete(site.id);

    const last = await fetchLastEventAtSite({
      userId: session.userId,
      jobsiteId: site.id,
      accessToken: session.accessToken,
    });
    if (last?.event_type === "clock_in") {
      const ok = await insertClockOut({
        userId: session.userId,
        orgId: session.orgId,
        jobsiteId: site.id,
        accessToken: session.accessToken,
        lat,
        lng,
      });
      if (!ok) {
        // Retry next tick by not removing from firstOutsideAt. Put a stale
        // "first" time back so we immediately retry next sample.
        firstOutsideAt.set(site.id, now - DWELL_EXIT_SECS * 1000);
      } else {
        await fireClockOutNotification(site.name ?? "Site");
      }
      openSiteIds.push(site.id);
    }
  }

  // If we're not inside any site AND we closed out everything (or nothing
  // was open), stop the task to save battery.
  if (!anyoneInside) {
    // Check if any site still has an open clock_in we haven't closed.
    // If firstOutsideAt is empty AND we didn't just close one, we're idle.
    const stillPending = firstOutsideAt.size > 0;
    if (!stillPending) {
      await stopLocationTracking();
    }
  }
});

export async function startLocationTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    // ~30 sec between samples while moving; iOS throttles when stationary
    // so battery cost is much lower than the numbers suggest.
    timeInterval: 30_000,
    distanceInterval: 25, // meters
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
}

export async function stopLocationTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  firstOutsideAt.clear();
}
