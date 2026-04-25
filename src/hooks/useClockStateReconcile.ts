// On app foreground, reconcile clock state against actual current location
// AND back-date any events the OS held while the app was suspended.
//
// The background tasks persist a rolling buffer of samples (~last 30) plus
// a per-site "first-observed-outside" map to SecureStore. On foreground we
// scan that history to figure out the EARLIEST evidence we have for any
// transition — that's what we use as `occurred_at`, NOT now().
//
// Two checks per site:
//   1. Last event was clock_in but cached samples (or current fix) show
//      we're outside → write clock_out at the earliest outside sample.
//   2. We're confidently inside a site but no open clock_in → write
//      clock_in at the earliest inside sample.
//
// Both are guarded against GPS jitter: we require accuracy + distance
// to be well past/under the radius before acting.

const RECONCILE_QUERY_TIMEOUT_MS = 6_000;

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { useAuth } from "../providers/AuthProvider";
import { useOrg } from "../providers/OrgProvider";
import { useAssignedSites } from "./useAssignedSites";
import { haversineDistance } from "../lib/geo";
import { supabase } from "../lib/supabase";
import {
  readSamples,
  readLastPosition,
  readSiteOutsideMap,
  writeSiteOutsideMap,
  appendDiag,
  CachedPosition,
} from "../lib/sessionCache";

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
      const releaseTimer = setTimeout(() => {
        runningRef.current = false;
      }, 30_000);
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        // Fresh fix — not the stale cache. Wrapped in a hard timeout because
        // getCurrentPositionAsync can hang for minutes during cell/GPS
        // handoffs (common when reopening app after a long drive).
        const fresh = await Promise.race<Location.LocationObject | null>([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]).catch(() => null);
        const lastKnown = fresh
          ? null
          : await Location.getLastKnownPositionAsync().catch(() => null);
        const pos = fresh ?? lastKnown ?? null;

        // Always pull cached samples + last-position whether or not we
        // got a fresh fix; we may need them for back-dating regardless.
        const [cachedSamples, cachedLast, cachedOutsideMap] = await Promise.all([
          readSamples(),
          readLastPosition(),
          readSiteOutsideMap(),
        ]);

        await appendDiag(
          "reconcile",
          `start fresh=${!!fresh} last=${!!lastKnown} samples=${cachedSamples.length} outsideKeys=${Object.keys(cachedOutsideMap).length}`
        );

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

        const outsideMapMutated: Record<string, number> = { ...cachedOutsideMap };
        let outsideMapDirty = false;

        // Compute current position from fresh fix OR fall back to cached
        // last-known background position (the BG task wrote it).
        let currentLat: number | null = pos?.coords.latitude ?? null;
        let currentLng: number | null = pos?.coords.longitude ?? null;
        let currentAccuracy: number | null =
          (pos?.coords.accuracy ?? null) as number | null;
        if (currentLat == null || currentLng == null) {
          if (cachedLast) {
            currentLat = cachedLast.lat;
            currentLng = cachedLast.lng;
            currentAccuracy = cachedLast.accuracyM;
          }
        }

        for (const { site, last } of results) {
          const radius = (site as any).geofence_radius_m ?? 100;
          const siteLat = site.lat as number;
          const siteLng = site.lng as number;

          // Distance from current best-known location to the site center.
          const distance =
            currentLat != null && currentLng != null
              ? haversineDistance(currentLat, currentLng, siteLat, siteLng)
              : null;

          // Last-event-at-site type — used to figure out which case applies.
          const lastEventTime = last?.occurred_at
            ? Date.parse(last.occurred_at)
            : 0;

          // Helper: earliest outside sample taken AFTER the last clock_in.
          // Combined with persisted "first outside" map for robustness.
          const earliestOutsideTs = ((): number | null => {
            const samplesEarliest = (() => {
              const valid = cachedSamples
                .filter((s: CachedPosition) => s.sampledAt > lastEventTime)
                .filter(
                  (s: CachedPosition) =>
                    haversineDistance(s.lat, s.lng, siteLat, siteLng) >
                    radius + exitBufferMeters
                )
                .sort((a, b) => a.sampledAt - b.sampledAt);
              return valid.length > 0 ? valid[0]!.sampledAt : null;
            })();
            const persisted = cachedOutsideMap[site.id] ?? null;
            const both = [samplesEarliest, persisted].filter(
              (x): x is number => x != null
            );
            if (both.length === 0) return null;
            return Math.min(...both);
          })();

          // Earliest inside sample at this site, used to back-date a
          // forced clock_in.
          const earliestInsideTs = ((): number | null => {
            const valid = cachedSamples
              .filter(
                (s: CachedPosition) =>
                  haversineDistance(s.lat, s.lng, siteLat, siteLng) <= radius
              )
              .sort((a, b) => a.sampledAt - b.sampledAt);
            return valid.length > 0 ? valid[0]!.sampledAt : null;
          })();

          // Case 1: last was clock_in but evidence shows user has left.
          // Use earliest-outside timestamp from cached samples, else fall
          // back to the persisted first-outside timestamp, else now().
          if (last && last.event_type === "clock_in") {
            const definitelyOutsideNow =
              distance != null && distance > radius + exitBufferMeters;
            const evidenceOutside = earliestOutsideTs != null;
            if (definitelyOutsideNow || evidenceOutside) {
              const occurredMs = earliestOutsideTs ?? Date.now();
              const occurredAtIso = new Date(occurredMs).toISOString();
              await supabase.from("time_clock_events").insert({
                org_id: orgId,
                user_id: session!.user.id,
                jobsite_id: site.id,
                event_type: "clock_out",
                source: "foreground_reconcile",
                occurred_at: occurredAtIso,
                lat: currentLat ?? siteLat,
                lng: currentLng ?? siteLng,
                inside_geofence: false,
                accuracy_m: currentAccuracy,
                distance_from_site_m: distance ?? null,
              });
              await appendDiag(
                "reconcile",
                `clock_out site=${site.id} occurred_at=${occurredAtIso} backdated=${occurredMs < Date.now() - 60_000}`
              );
              if (outsideMapMutated[site.id] != null) {
                delete outsideMapMutated[site.id];
                outsideMapDirty = true;
              }
              continue;
            }
          }

          // Case 2: not clocked in but we're confidently inside the site.
          // iOS missed the Enter — write a clock_in (back-dated to the
          // earliest inside sample if we have one).
          const gpsAccuracy = currentAccuracy ?? 100;
          const confidentlyInside =
            distance != null && distance + gpsAccuracy <= radius;
          const alreadyOpen = last && last.event_type === "clock_in";
          if (confidentlyInside && !alreadyOpen) {
            const occurredMs = earliestInsideTs ?? Date.now();
            const occurredAtIso = new Date(occurredMs).toISOString();
            await supabase.from("time_clock_events").insert({
              org_id: orgId,
              user_id: session!.user.id,
              jobsite_id: site.id,
              event_type: "clock_in",
              source: "foreground_reconcile",
              occurred_at: occurredAtIso,
              lat: currentLat ?? siteLat,
              lng: currentLng ?? siteLng,
              inside_geofence: true,
              accuracy_m: currentAccuracy,
              distance_from_site_m: distance,
            });
            await appendDiag(
              "reconcile",
              `clock_in site=${site.id} occurred_at=${occurredAtIso} backdated=${occurredMs < Date.now() - 60_000}`
            );
          }
        }

        if (outsideMapDirty) {
          await writeSiteOutsideMap(outsideMapMutated);
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
