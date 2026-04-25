import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import uuid from "react-native-uuid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import { haversineDistance } from "../lib/geo";
import { withTimeout } from "../lib/withTimeout";

// On bad cell, an unguarded Supabase query left the TimeClockCard
// stuck on its loading spinner indefinitely, and tapping clock_in
// would hang on the insert. Force restart was the only fix. These
// timeouts let the UI fail fast and recover instead of wedging.
const CLOCK_QUERY_TIMEOUT_MS = 8_000;
const CLOCK_INSERT_TIMEOUT_MS = 12_000;
const GPS_TIMEOUT_MS = 6_000;
const PHOTO_UPLOAD_TIMEOUT_MS = 20_000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_RES = { data: null, error: null } as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TIMEOUT_ERR = { error: { message: "Request timed out — check connection" } } as any;

export interface TimeClockEvent {
  id: string;
  org_id: string;
  user_id: string;
  jobsite_id: string | null;
  service_order_id: string | null;
  visit_id: string | null;
  event_type: "clock_in" | "clock_out";
  source: "auto_geofence" | "manual";
  occurred_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  distance_from_site_m: number | null;
  inside_geofence: boolean | null;
  note: string | null;
  photo_storage_path: string | null;
  created_at: string;
}

export interface ClockSiteInfo {
  jobsiteId: string;
  siteLat: number | null;
  siteLng: number | null;
  radius: number;
}

interface ClockActionParams {
  site: ClockSiteInfo;
  note?: string | null;
  photoUri?: string | null;
  photoMime?: string | null;
  photoExt?: string | null;
}

interface UseTimeClockResult {
  events: TimeClockEvent[];
  latestEvent: TimeClockEvent | null;
  isClockedIn: boolean;
  clockedInSince: string | null;
  loading: boolean;
  error: string | null;
  clockIn: (params: ClockActionParams) => Promise<{ error: string | null }>;
  clockOut: (params: ClockActionParams) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function uploadPhoto(opts: {
  orgId: string;
  jobsiteId: string;
  photoUri: string;
  mime: string;
  ext: string;
}): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(opts.photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = decodeBase64(base64);
    const id = String(uuid.v4());
    const path = `${opts.orgId}/${opts.jobsiteId}/clock_${id}.${opts.ext}`;
    const { error } = await supabase.storage
      .from("site-photos")
      .upload(path, bytes, {
        contentType: opts.mime,
        upsert: false,
      });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Time-clock hook scoped to a specific jobsite for a tech.
 * Fetches the tech's events for the site and exposes clockIn / clockOut.
 */
export function useTimeClock(jobsiteId: string | null): UseTimeClockResult {
  const { user } = useAuth();
  const [events, setEvents] = useState<TimeClockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!user || !jobsiteId) {
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: fetchErr } = await withTimeout(
      supabase
        .from("time_clock_events")
        .select("*")
        .eq("jobsite_id", jobsiteId)
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(50),
      CLOCK_QUERY_TIMEOUT_MS,
      EMPTY_RES
    );
    if (fetchErr) {
      setError(fetchErr.message);
    } else if (data) {
      setEvents(data as TimeClockEvent[]);
    }
    // Always release loading even on timeout so the spinner can't pin.
    setLoading(false);
  }, [user, jobsiteId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const insertEvent = useCallback(
    async (
      eventType: "clock_in" | "clock_out",
      params: ClockActionParams
    ): Promise<{ error: string | null }> => {
      if (!user?.active_org_id) {
        return { error: "No active organization" };
      }
      const orgId = user.active_org_id;

      // Best-effort GPS fix — race against a hard timeout because
      // getCurrentPositionAsync can hang for minutes during cell/GPS
      // handoffs. Falling back to last-known is fine; the event still
      // records without GPS rather than blocking the clock-in tap.
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;
      try {
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), GPS_TIMEOUT_MS)
          ),
        ]).catch(() => null);
        const fix =
          pos ??
          (await Location.getLastKnownPositionAsync().catch(() => null));
        if (fix) {
          lat = fix.coords.latitude;
          lng = fix.coords.longitude;
          accuracy = fix.coords.accuracy ?? null;
        }
      } catch {
        // ignore — event still records without GPS
      }

      let distance: number | null = null;
      let insideGeofence: boolean | null = null;
      if (
        lat != null &&
        lng != null &&
        params.site.siteLat != null &&
        params.site.siteLng != null
      ) {
        distance = haversineDistance(lat, lng, params.site.siteLat, params.site.siteLng);
        insideGeofence = distance <= params.site.radius;
      }

      let photoPath: string | null = null;
      if (params.photoUri) {
        photoPath = await Promise.race([
          uploadPhoto({
            orgId,
            jobsiteId: params.site.jobsiteId,
            photoUri: params.photoUri,
            mime: params.photoMime ?? "image/jpeg",
            ext: params.photoExt ?? "jpg",
          }),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), PHOTO_UPLOAD_TIMEOUT_MS)
          ),
        ]).catch(() => null);
      }

      const { error: insertErr } = await withTimeout(
        supabase.from("time_clock_events").insert({
          org_id: orgId,
          user_id: user.id,
          jobsite_id: params.site.jobsiteId,
          event_type: eventType,
          source: "manual",
          occurred_at: new Date().toISOString(),
          lat,
          lng,
          accuracy_m: accuracy,
          distance_from_site_m: distance,
          inside_geofence: insideGeofence,
          note: params.note ?? null,
          photo_storage_path: photoPath,
        }),
        CLOCK_INSERT_TIMEOUT_MS,
        TIMEOUT_ERR
      );

      if (insertErr) {
        return { error: insertErr.message };
      }
      await fetchEvents();
      return { error: null };
    },
    [user, fetchEvents]
  );

  const clockIn = useCallback(
    (params: ClockActionParams) => insertEvent("clock_in", params),
    [insertEvent]
  );
  const clockOut = useCallback(
    (params: ClockActionParams) => insertEvent("clock_out", params),
    [insertEvent]
  );

  const latestEvent = events[0] ?? null;
  const isClockedIn = latestEvent?.event_type === "clock_in";
  const clockedInSince = isClockedIn ? latestEvent?.occurred_at ?? null : null;

  return {
    events,
    latestEvent,
    isClockedIn,
    clockedInSince,
    loading,
    error,
    clockIn,
    clockOut,
    refresh: fetchEvents,
  };
}
