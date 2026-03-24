import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  cacheRoutes,
  cacheJobsites,
  cacheVisits,
  cacheEquipment,
  getCachedRoutes,
  getCachedJobsites,
  getCachedVisits,
  getCachedEquipment,
  updateCachedVisit,
} from "../lib/offline-db";
import type { Route, Jobsite, Visit, Equipment, RouteStop } from "../types/database";
import { useAuth } from "../providers/AuthProvider";
import { useNetwork } from "../providers/NetworkProvider";

export function useRouteData() {
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDayOfWeek = (): string => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return days[new Date().getDay()];
  };

  const today = new Date().toISOString().split("T")[0];

  const fetchOnline = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch today's route
      const { data: routes, error: routeError } = await supabase
        .from("routes")
        .select("*")
        .eq("technician_id", user.id)
        .eq("day_of_week", getDayOfWeek());

      if (routeError) throw routeError;
      if (!routes || routes.length === 0) {
        setRoute(null);
        setStops([]);
        setLoading(false);
        return;
      }

      const currentRoute = routes[0] as Route;
      setRoute(currentRoute);
      await cacheRoutes(routes as Array<{ id: string } & Record<string, unknown>>);

      // Fetch today's visits
      const { data: visits, error: visitError } = await supabase
        .from("visits")
        .select("*")
        .eq("technician_id", user.id)
        .eq("scheduled_date", today)
        .order("created_at", { ascending: true });

      if (visitError) throw visitError;
      const visitList = (visits ?? []) as Visit[];
      await cacheVisits(visitList as Array<{ id: string } & Record<string, unknown>>);

      // Fetch jobsites for these visits
      const jobsiteIds = [...new Set(visitList.map((v) => v.jobsite_id))];
      let jobsites: Jobsite[] = [];
      if (jobsiteIds.length > 0) {
        const { data: jobsiteData } = await supabase
          .from("jobsites")
          .select("*")
          .in("id", jobsiteIds);
        jobsites = (jobsiteData ?? []) as Jobsite[];
        await cacheJobsites(jobsites as Array<{ id: string } & Record<string, unknown>>);
      }

      // Fetch equipment for jobsites
      let equipment: Equipment[] = [];
      if (jobsiteIds.length > 0) {
        const { data: equipData } = await supabase
          .from("equipment")
          .select("*")
          .in("jobsite_id", jobsiteIds);
        equipment = (equipData ?? []) as Equipment[];
        await cacheEquipment(
          equipment as Array<{ id: string; jobsite_id: string } & Record<string, unknown>>
        );
      }

      // Build ordered stops
      const optimizedOrder: string[] = (currentRoute.optimized_order ?? []) as string[];
      const jobsiteMap = new Map(jobsites.map((j) => [j.id, j]));
      const equipmentMap = new Map<string, Equipment[]>();
      for (const eq of equipment) {
        const list = equipmentMap.get(eq.jobsite_id) ?? [];
        list.push(eq);
        equipmentMap.set(eq.jobsite_id, list);
      }

      const orderedStops: RouteStop[] = visitList
        .map((visit, index) => {
          const jobsite = jobsiteMap.get(visit.jobsite_id);
          if (!jobsite) return null;
          const orderIdx = optimizedOrder.indexOf(visit.jobsite_id);
          return {
            ...visit,
            jobsite,
            equipment: equipmentMap.get(visit.jobsite_id) ?? [],
            order_index: orderIdx >= 0 ? orderIdx : index,
          };
        })
        .filter((s): s is RouteStop => s !== null)
        .sort((a, b) => a.order_index - b.order_index);

      setStops(orderedStops);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch route data";
      setError(msg);
      // Fall back to cache
      await loadFromCache();
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  const loadFromCache = useCallback(async () => {
    try {
      const cachedRoutesData = await getCachedRoutes<Route>();
      const cachedVisitsData = await getCachedVisits<Visit>();
      const cachedJobsitesData = await getCachedJobsites<Jobsite>();

      if (cachedRoutesData.length > 0) {
        setRoute(cachedRoutesData[0]);
      }

      const jobsiteMap = new Map(cachedJobsitesData.map((j) => [j.id, j]));
      const orderedStops: RouteStop[] = [];

      for (let i = 0; i < cachedVisitsData.length; i++) {
        const visit = cachedVisitsData[i];
        const jobsite = jobsiteMap.get(visit.jobsite_id);
        if (!jobsite) continue;
        const eq = await getCachedEquipment<Equipment>(visit.jobsite_id);
        orderedStops.push({
          ...visit,
          jobsite,
          equipment: eq,
          order_index: i,
        });
      }

      setStops(orderedStops);
    } catch {
      setError("Failed to load cached data");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isConnected) {
      await fetchOnline();
    } else {
      await loadFromCache();
    }
  }, [isConnected, fetchOnline, loadFromCache]);

  const updateVisitLocally = useCallback(
    async (visitId: string, updates: Partial<Visit>) => {
      setStops((prev) =>
        prev.map((stop) =>
          stop.id === visitId ? { ...stop, ...updates } : stop
        )
      );
      const existing = stops.find((s) => s.id === visitId);
      if (existing) {
        await updateCachedVisit(visitId, { ...existing, ...updates });
      }
    },
    [stops]
  );

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  return { route, stops, loading, error, refresh, updateVisitLocally };
}
