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
