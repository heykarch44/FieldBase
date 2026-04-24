// On app foreground, reconcile clock state against actual current location.
// iOS geofence events are unreliable when the phone is locked / pocketed,
// so we run two checks on foreground:
//   1. Clocked in at site X, but we're now clearly outside → write clock_out.
//   2. Clearly inside site Y, but last event was clock_out (or nothing) →
//      write clock_in so the user isn't stranded when iOS misses an Enter
//      event after a long drive.
//
// Both checks are guarded: we need a fresh location fix (not last-known),
// and we only auto-clock-in if the distance is well inside the radius to
// avoid flapping at the edge.

const RECONCILE_QUERY_TIMEOUT_MS = 6_000;

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { useAuth } from "../providers/AuthProvider";
import { useOrg } from "../providers/OrgProvider";
import { useAssignedSites } from "./useAssignedSites";
import { haversineDistance } from "../lib/geo";
import { supabase } from "../lib/supabase";

interface ReconcileOptions {
  enabled: boolean;
  // Extra slack on top of the geofence radius before we decide the user has
  // truly left. Helps with GPS jitter when sitting at the edge of a site.
  exitBufferMeters?: number;
}

export function useClockStateReconcile({
  enabled,
  exitBufferMeters = 25,
}: ReconcileOptions) {
  const { session } = useAuth();
  const { orgId } = useOrg();
  const { sites } = useAssignedSites();
  const runningRef = useRef(false);
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !session || !orgId) return;

    async function reconcile() {
      if (runningRef.current) return;
      // Throttle: at most once per 30s to avoid hammering on rapid fg/bg cycles.
      if (Date.now() - lastRunRef.current < 30_000) return;
      runningRef.current = true;
      lastRunRef.current = Date.now();
      // Belt-and-suspenders: force-release the lock after 30s even if
      // something inside catches a hang. Previously a wedged reconcile
      // could pin runningRef=true forever and silently disable reconcile
      // for the rest of the session.
      const releaseTimer = setTimeout(() => {
        runningRef.current = false;
      }, 30_000);
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        // Fresh fix — not the stale cache. Wrapped in a hard timeout because
        // getCurrentPositionAsync can hang for minutes during cell/GPS
        // handoffs (common when reopening app after a long drive). If the
        // fresh fix doesn't come in 8s, fall back to last known so we still
        // reconcile something rather than leaving the caller awaiting forever.
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ])
          .catch(() => null)
          .then(async (p) => {
            if (p) return p;
            return await Location.getLastKnownPositionAsync().catch(() => null);
          });
        if (!pos) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        // GPS accuracy in meters (radius of 68% confidence circle). iOS
        // reports 5-10m outdoors, 20-65m indoors, sometimes >100m after
        // cell handoff. We use this to decide if we trust the fix enough
        // to auto-clock-in.
        const gpsAccuracy = pos.coords.accuracy ?? 100;

        const sitesWithCoords = sites.filter(
          (s) => s.lat != null && s.lng != null
        );
        if (sitesWithCoords.length === 0) return;

        // Fetch the user's last event per site, all in parallel, each with
        // its own hard timeout so a stuck connection on one query can't
        // stall the whole reconcile pass.
        const results = await Promise.all(
          sitesWithCoords.map(async (site) => {
            const query = supabase
              .from("time_clock_events")
              .select("event_type, occurred_at")
              .eq("user_id", session!.user.id)
              .eq("jobsite_id", site.id)
              .order("occurred_at", { ascending: false })
              .limit(1);
            const res = await Promise.race([
              query,
              new Promise<{ data: null }>((resolve) =>
                setTimeout(
                  () => resolve({ data: null }),
                  RECONCILE_QUERY_TIMEOUT_MS
                )
              ),
            ]).catch(() => ({ data: null }));
            return { site, last: (res.data as any)?.[0] ?? null };
          })
        );

        for (const { site, last } of results) {
          const radius = (site as any).geofence_radius_m ?? 100;
          const distance = haversineDistance(
            lat,
            lng,
            site.lat as number,
            site.lng as number
          );

          // Case 1: last was clock_in but we're clearly outside now.
          // Write the missing clock_out.
          if (
            last &&
            last.event_type === "clock_in" &&
            distance > radius + exitBufferMeters
          ) {
            await supabase.from("time_clock_events").insert({
              org_id: orgId,
              user_id: session!.user.id,
              jobsite_id: site.id,
              event_type: "clock_out",
              source: "foreground_reconcile",
              occurred_at: new Date().toISOString(),
              lat,
              lng,
              inside_geofence: false,
            });
            continue;
          }

          // Case 2: we're clearly inside the site but not clocked in — iOS
          // missed the Enter event (common after long drives). Write the
          // clock_in now so the user doesn't have to manually fix it.
          //
          // Guard: require distance + GPS accuracy < radius so we're
          // confident we're actually inside. Example: 30m radius, distance
          // 10m from center with ±15m accuracy → 25m < 30m → trigger. But
          // if accuracy is ±50m, we refuse to trigger until GPS settles.
          // Also skip if there's already an open clock_in at THIS site.
          const confidentlyInside = distance + gpsAccuracy <= radius;
          const alreadyOpen = last && last.event_type === "clock_in";
          if (confidentlyInside && !alreadyOpen) {
            await supabase.from("time_clock_events").insert({
              org_id: orgId,
              user_id: session!.user.id,
              jobsite_id: site.id,
              event_type: "clock_in",
              source: "foreground_reconcile",
              occurred_at: new Date().toISOString(),
              lat,
              lng,
              inside_geofence: true,
            });
          }
        }
      } finally {
        clearTimeout(releaseTimer);
        runningRef.current = false;
      }
    }

    // Run once on mount (covers cold-start-while-already-outside).
    reconcile();

    const sub = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (next === "active") {
          reconcile();
        }
      }
    );
    return () => sub.remove();
  }, [enabled, session, orgId, sites, exitBufferMeters]);
}
