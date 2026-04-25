// Background geofence task. Registered once at module import time via
// TaskManager.defineTask. Fires on OS enter/exit for regions registered
// with Location.startGeofencingAsync('geofence-task', regions).
//
// The task runs in a separate JS context — NO React, NO AuthProvider.
// We read the cached session from SecureStore and POST directly to
// Supabase's REST endpoint using the cached access token.
//
// Reliability strategy:
//   - Always fire a local notification on EVERY clock event. The user-
//     visible UI hint also nudges iOS to keep the app "active" longer.
//   - Use the earliest evidence we have for `occurred_at`, not now().
//     If the OS delivered an Exit late (we have cached samples that
//     already showed user outside the radius), back-date to that sample.
//   - Persist a diagnostic log to SecureStore so foreground can surface
//     it (background tasks have no observable console).

import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import {
  readSessionCache,
  readCachedSites,
  readCachedClockLabels,
  readSamples,
  appendDiag,
  CachedPosition,
} from "./sessionCache";
import {
  startLocationTracking,
  stopLocationTracking,
} from "./backgroundLocationTask";
import { haversineDistance } from "./geo";

async function fireClockNotification(params: {
  eventType: "clock_in" | "clock_out";
  jobsiteId: string;
  occurredAtIso: string;
}): Promise<void> {
  try {
    const [labels, sites] = await Promise.all([
      readCachedClockLabels(),
      readCachedSites(),
    ]);
    const site = sites.find((s) => s.id === params.jobsiteId);
    const siteName = site?.name ?? "Site";
    const title =
      params.eventType === "clock_in" ? labels.clockIn : labels.clockOut;
    // Show the actual transition time when we back-date so the user knows
    // the event was when they truly transitioned, not when iOS delivered it.
    const occurredMs = Date.parse(params.occurredAtIso);
    const stale =
      Number.isFinite(occurredMs) && Date.now() - occurredMs > 120_000;
    const body = stale
      ? `${siteName} (recorded ${formatRelative(occurredMs)})`
      : siteName;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
      },
      trigger: null,
    });
  } catch {
    // Notifications are best-effort — never block the clock event on this.
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

export const GEOFENCE_TASK = "geofence-task";

// Hard timeout on any background fetch. iOS only gives the task ~30s and
// network hangs on cell handoffs have been linked to foreground app hangs
// when JS is still awaiting the promise on wake-up.
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

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key";

interface GeofenceTaskBody {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

async function insertClockEvent(params: {
  userId: string;
  orgId: string;
  jobsiteId: string;
  accessToken: string;
  eventType: "clock_in" | "clock_out";
  occurredAtIso: string;
  lat: number;
  lng: number;
  insideGeofence: boolean;
  accuracyM?: number | null;
  distanceFromSiteM?: number | null;
}): Promise<boolean> {
  const body: Record<string, unknown> = {
    org_id: params.orgId,
    user_id: params.userId,
    jobsite_id: params.jobsiteId,
    event_type: params.eventType,
    source: "auto_geofence",
    occurred_at: params.occurredAtIso,
    lat: params.lat,
    lng: params.lng,
    inside_geofence: params.insideGeofence,
  };
  if (params.accuracyM != null) body.accuracy_m = params.accuracyM;
  if (params.distanceFromSiteM != null)
    body.distance_from_site_m = params.distanceFromSiteM;

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

// Fetch the user's last event at a specific site to decide whether a new
// event is redundant (same type as the last) or a spurious exit (last
// wasn't a clock_in, so nothing to close).
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

// Overall task wall-clock budget. iOS gives ~30s to finish the handler;
// we target 20s so we always return and release the thread even if every
// sub-step is stuck. This is critical: if the task awaits forever, the JS
// thread stays hot into foreground and the UI appears hung.
const TASK_BUDGET_MS = 20_000;

function withBudget<T>(p: Promise<T>, fallback: T, timeoutMs = TASK_BUDGET_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

// Compute the best `occurred_at` we can justify using cached samples.
//   - For clock_out (exit): pick the earliest sample where the user was
//     clearly outside the site's radius. That's when they really left.
//   - For clock_in (enter): pick the most recent sample where the user
//     was inside the site (which would normally be "now"). If we have
//     no inside sample but the OS just delivered Enter, trust now() —
//     iOS is highly reliable on Enter.
//
// Returns ISO string. Falls back to now() if we have no useful samples.
function computeOccurredAt(params: {
  eventType: "clock_in" | "clock_out";
  siteLat: number;
  siteLng: number;
  siteRadiusM: number;
  samples: CachedPosition[];
  lastInsideEventAtIso?: string | null;
}): { iso: string; backdated: boolean; reason: string } {
  const now = Date.now();
  const { eventType, samples, siteLat, siteLng, siteRadiusM } = params;

  if (eventType === "clock_out") {
    // Find earliest sample where user was clearly outside (radius + 25m).
    // Bound to samples taken AFTER the last clock_in at this site (if known)
    // — otherwise we'd back-date past the real entry and stamp clock_out
    // before clock_in.
    const lowerBoundMs = params.lastInsideEventAtIso
      ? Date.parse(params.lastInsideEventAtIso)
      : 0;
    const valid = samples
      .filter((s) => s.sampledAt > lowerBoundMs)
      .filter(
        (s) =>
          haversineDistance(s.lat, s.lng, siteLat, siteLng) >
          siteRadiusM + 25
      )
      .sort((a, b) => a.sampledAt - b.sampledAt);
    if (valid.length > 0) {
      const earliest = valid[0]!.sampledAt;
      // Cap how far we'll back-date to 6 hours, just in case there are
      // stale samples from a previous shift sitting around.
      const sixHoursAgo = now - 6 * 60 * 60 * 1000;
      const ts = Math.max(earliest, sixHoursAgo);
      return {
        iso: new Date(ts).toISOString(),
        backdated: ts < now - 60_000,
        reason: `earliest-outside-sample (${valid.length} samples)`,
      };
    }
    return {
      iso: new Date(now).toISOString(),
      backdated: false,
      reason: "no-outside-samples-fallback-now",
    };
  }

  // clock_in
  const insideSamples = samples
    .filter(
      (s) =>
        haversineDistance(s.lat, s.lng, siteLat, siteLng) <= siteRadiusM
    )
    .sort((a, b) => a.sampledAt - b.sampledAt);
  if (insideSamples.length > 0) {
    // Use the EARLIEST inside sample — that's when the user actually arrived.
    const earliest = insideSamples[0]!.sampledAt;
    return {
      iso: new Date(earliest).toISOString(),
      backdated: earliest < now - 60_000,
      reason: `earliest-inside-sample (${insideSamples.length} samples)`,
    };
  }
  return {
    iso: new Date(now).toISOString(),
    backdated: false,
    reason: "no-inside-samples-fallback-now",
  };
}

// Define the task at module-evaluation time so the OS can dispatch to it.
TaskManager.defineTask<GeofenceTaskBody>(GEOFENCE_TASK, async ({ data, error }) => {
  await withBudget(
    handleGeofenceEvent(data, error),
    undefined,
    TASK_BUDGET_MS
  );
});

async function handleGeofenceEvent(
  data: GeofenceTaskBody | undefined,
  error: unknown
): Promise<void> {
  if (error) {
    await appendDiag("geofence", `error: ${String(error)}`);
    return;
  }
  if (!data) return;
  const { eventType, region } = data;
  if (!region || !region.identifier) return;

  const session = await readSessionCache();
  if (!session || !session.orgId) {
    await appendDiag("geofence", `no-session region=${region.identifier}`);
    return;
  }

  const clockEvent: "clock_in" | "clock_out" =
    eventType === Location.GeofencingEventType.Enter ? "clock_in" : "clock_out";

  await appendDiag(
    "geofence",
    `${clockEvent} region=${region.identifier}`
  );

  // iOS fires a synthetic state event for every registered region when
  // startGeofencingAsync is called. If you're currently outside a region
  // that gets registered, iOS emits Exit for it, which previously caused
  // phantom clock_out rows for sites you were never at.
  //
  // Guard rails:
  //   - Only write clock_out if the last event at that site was clock_in
  //     (i.e. there's an open session to close).
  //   - Only write clock_in if the last event at that site was NOT already
  //     clock_in (avoid duplicate opens on reboot / re-registration).
  const last = await fetchLastEventAtSite({
    userId: session.userId,
    jobsiteId: region.identifier,
    accessToken: session.accessToken,
  });

  if (clockEvent === "clock_out") {
    if (!last || last.event_type !== "clock_in") {
      await appendDiag(
        "geofence",
        `skip clock_out region=${region.identifier} last=${last?.event_type ?? "none"}`
      );
      return;
    }
  } else {
    if (last && last.event_type === "clock_in") {
      await appendDiag(
        "geofence",
        `skip clock_in region=${region.identifier} already-open`
      );
      return;
    }
  }

  // Find the site so we can compute occurred_at against its radius.
  const sites = await readCachedSites();
  const site = sites.find((s) => s.id === region.identifier);
  const siteRadius = site?.radius_m ?? region.radius ?? 100;
  const siteLat = site?.lat ?? region.latitude;
  const siteLng = site?.lng ?? region.longitude;

  const samples = await readSamples();
  const occurred = computeOccurredAt({
    eventType: clockEvent,
    siteLat,
    siteLng,
    siteRadiusM: siteRadius,
    samples,
    lastInsideEventAtIso:
      clockEvent === "clock_out" ? last?.occurred_at ?? null : null,
  });

  if (occurred.backdated) {
    await appendDiag(
      "geofence",
      `backdated ${clockEvent} site=${region.identifier} to=${occurred.iso} reason=${occurred.reason}`
    );
  }

  // Distance from site center for the audit row. Use the most recent
  // sample if we have one, else fall back to region center (distance 0).
  const lastSample = samples.length > 0 ? samples[samples.length - 1]! : null;
  const distance = lastSample
    ? haversineDistance(lastSample.lat, lastSample.lng, siteLat, siteLng)
    : 0;
  const lat = lastSample?.lat ?? region.latitude;
  const lng = lastSample?.lng ?? region.longitude;

  const inserted = await insertClockEvent({
    userId: session.userId,
    orgId: session.orgId,
    jobsiteId: region.identifier,
    accessToken: session.accessToken,
    eventType: clockEvent,
    occurredAtIso: occurred.iso,
    lat,
    lng,
    insideGeofence: clockEvent === "clock_in",
    accuracyM: lastSample?.accuracyM ?? null,
    distanceFromSiteM: distance,
  });

  await appendDiag(
    "geofence",
    `insert ${clockEvent} ok=${inserted} site=${region.identifier} occurred_at=${occurred.iso}`
  );

  // Fire notification and manage dwell tracking in parallel so a hang in
  // one doesn't block the others. All are best-effort — swallow errors.
  const followups: Promise<unknown>[] = [];
  if (inserted) {
    followups.push(
      fireClockNotification({
        eventType: clockEvent,
        jobsiteId: region.identifier,
        occurredAtIso: occurred.iso,
      }).catch(() => {})
    );
  }

  // DWELL MODE: we want continuous location updates running ANY time the
  // user is currently clocked in somewhere (i.e. on Enter). On Exit we
  // keep tracking running too — iOS often misses the second Enter when
  // moving between adjacent sites, so the dwell task is also our backup
  // detector for Enter at the next site. The location task itself
  // self-stops only when truly idle (outside everything for a while).
  followups.push(startLocationTracking().catch(() => {}));
  // Mark unused but keep import to make stop available for future use.
  void stopLocationTracking;

  // Wait for followups with a tighter budget so they don't eat the full
  // task window. If notification scheduling or location start hangs we
  // just return and iOS will keep the region monitored for next time.
  await withBudget(Promise.all(followups).then(() => undefined), undefined, 8_000);
}
