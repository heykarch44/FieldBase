import { useCallback, useEffect, useRef } from "react";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { GEOFENCE_TASK } from "../lib/backgroundGeofenceTask";
import { haversineDistance } from "../lib/geo";
import { useAssignedSites } from "./useAssignedSites";

const IOS_MAX_REGIONS = 20;

interface Site {
  id: string;
  lat: number | null;
  lng: number | null;
  geofence_radius_m?: number | null;
}

// Pick the closest N sites to current location. Sites without coords are dropped.
function pickClosestSites(
  sites: Site[],
  currentLat: number | null,
  currentLng: number | null,
  limit: number
): Site[] {
  const withCoords = sites.filter((s) => s.lat != null && s.lng != null);
  if (withCoords.length <= limit) return withCoords;
  if (currentLat == null || currentLng == null) {
    // No current location — deterministic slice so we pick *some* sites rather
    // than none. Could also just return empty and wait for location.
    return withCoords.slice(0, limit);
  }
  const scored = withCoords.map((s) => ({
    site: s,
    d: haversineDistance(currentLat, currentLng, s.lat as number, s.lng as number),
  }));
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, limit).map((x) => x.site);
}

export function useGeofenceRegistration(options: {
  enabled: boolean;
}): { registeredCount: number; refresh: () => Promise<void> } {
  const { sites } = useAssignedSites();
  const lastKeyRef = useRef<string | null>(null);
  const countRef = useRef<number>(0);

  const register = useCallback(async () => {
    if (!options.enabled) return;

    // Grab current location best-effort. If it fails, we still register
    // something so the feature works — just may not be the ideal subset.
    let currentLat: number | null = null;
    let currentLng: number | null = null;
    try {
      const pos = await Location.getLastKnownPositionAsync();
      if (pos) {
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
      }
    } catch {
      // ignore
    }

    const chosen = pickClosestSites(
      sites as Site[],
      currentLat,
      currentLng,
      IOS_MAX_REGIONS
    );

    const regions: Location.LocationRegion[] = chosen.map((s) => ({
      identifier: s.id,
      latitude: s.lat as number,
      longitude: s.lng as number,
      radius: s.geofence_radius_m ?? 100,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));

    // Build a cheap key to avoid redundant re-registrations
    const key = regions
      .map((r) => `${r.identifier}:${r.latitude}:${r.longitude}:${r.radius}`)
      .sort()
      .join("|");
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    // Stop existing monitoring if registered (task-manager throws otherwise)
    try {
      const hasStarted = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
      if (hasStarted) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined);
      }
    } catch {
      // ignore
    }

    if (regions.length === 0) {
      countRef.current = 0;
      return;
    }

    try {
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
      countRef.current = regions.length;
    } catch {
      countRef.current = 0;
    }
  }, [sites, options.enabled]);

  useEffect(() => {
    register();
  }, [register]);

  return { registeredCount: countRef.current, refresh: register };
}
