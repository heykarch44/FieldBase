// On app foreground, reconcile clock state against actual current location.
// iOS geofence exit events are unreliable when the phone is locked / pocketed,
// so if we notice the user is no longer inside a site they're clocked in to,
// we write the missing clock_out ourselves.

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
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        // Fresh fix — not the stale cache.
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);
        if (!pos) return;
        const { latitude: lat, longitude: lng } = pos.coords;

        const sitesWithCoords = sites.filter(
          (s) => s.lat != null && s.lng != null
        );
        if (sitesWithCoords.length === 0) return;

        // For every site the user could be clocked into, check "are we inside".
        for (const site of sitesWithCoords) {
          const radius = (site as any).geofence_radius_m ?? 100;
          const distance = haversineDistance(
            lat,
            lng,
            site.lat as number,
            site.lng as number
          );
          const insideNow = distance <= radius;

          // Find the user's last event at this site.
          const { data: lastRows } = await supabase
            .from("time_clock_events")
            .select("event_type, occurred_at")
            .eq("user_id", session!.user.id)
            .eq("jobsite_id", site.id)
            .order("occurred_at", { ascending: false })
            .limit(1);

          const last = lastRows?.[0];
          if (!last) continue;

          // Case 1: last was clock_in but we're clearly outside now.
          // Write the missing clock_out.
          if (
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

          // Case 2: last was clock_out (or nothing) but we're inside now and
          // this is our assigned site. Don't auto-clock-in here — that would
          // be surprising. The OS enter event (or user manual action) handles
          // that. We only *close* stale opens.
          void insideNow;
        }
      } finally {
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
