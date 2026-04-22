// Background geofence task. Registered once at module import time via
// TaskManager.defineTask. Fires on OS enter/exit for regions registered
// with Location.startGeofencingAsync('geofence-task', regions).
//
// The task runs in a separate JS context — NO React, NO AuthProvider.
// We read the cached session from SecureStore and POST directly to
// Supabase's REST endpoint using the cached access token.

import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { readSessionCache } from "./sessionCache";

export const GEOFENCE_TASK = "geofence-task";

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
  lat: number;
  lng: number;
  insideGeofence: boolean;
}): Promise<boolean> {
  const body = {
    org_id: params.orgId,
    user_id: params.userId,
    jobsite_id: params.jobsiteId,
    event_type: params.eventType,
    source: "auto_geofence",
    occurred_at: new Date().toISOString(),
    lat: params.lat,
    lng: params.lng,
    inside_geofence: params.insideGeofence,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/time_clock_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${params.accessToken}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Fetch the user's last event at a specific site to decide whether a new
// event is redundant (same type as the last) or a spurious exit (last
// wasn't a clock_in, so nothing to close).
async function fetchLastEventAtSite(params: {
  userId: string;
  jobsiteId: string;
  accessToken: string;
}): Promise<{ event_type: string } | null> {
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/time_clock_events` +
      `?user_id=eq.${params.userId}` +
      `&jobsite_id=eq.${params.jobsiteId}` +
      `&select=event_type` +
      `&order=occurred_at.desc` +
      `&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${params.accessToken}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ event_type: string }>;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// Define the task at module-evaluation time so the OS can dispatch to it.
TaskManager.defineTask<GeofenceTaskBody>(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  if (!data) return;
  const { eventType, region } = data;
  if (!region || !region.identifier) return;

  const session = await readSessionCache();
  if (!session || !session.orgId) {
    // No cached session — silently skip. On next foreground launch the
    // app can reconcile via manual state if needed.
    return;
  }

  const clockEvent: "clock_in" | "clock_out" =
    eventType === Location.GeofencingEventType.Enter ? "clock_in" : "clock_out";

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
      // Nothing to close — probably a synthetic exit on registration.
      return;
    }
  } else {
    // clock_in
    if (last && last.event_type === "clock_in") {
      // Already clocked in here — don't double-open.
      return;
    }
  }

  await insertClockEvent({
    userId: session.userId,
    orgId: session.orgId,
    jobsiteId: region.identifier,
    accessToken: session.accessToken,
    eventType: clockEvent,
    lat: region.latitude,
    lng: region.longitude,
    insideGeofence: clockEvent === "clock_in",
  });
});
