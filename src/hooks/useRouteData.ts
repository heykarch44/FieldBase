import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  cacheRoutes,
  cacheCustomers,
  cacheVisits,
  cacheEquipment,
  getCachedRoutes,
  getCachedCustomers,
  getCachedVisits,
  getCachedEquipment,
  updateCachedVisit,
} from "../lib/offline-db";
import type { Route, Customer, ServiceVisit, EquipmentInventory, RouteStop } from "../types/database";
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
        .from("service_visits")
        .select("*")
        .eq("technician_id", user.id)
        .eq("scheduled_date", today)
        .order("created_at", { ascending: true });

      if (visitError) throw visitError;
      const visitList = (visits ?? []) as ServiceVisit[];
      await cacheVisits(visitList as Array<{ id: string } & Record<string, unknown>>);

      // Fetch customers for these visits
      const customerIds = [...new Set(visitList.map((v) => v.customer_id))];
      let customers: Customer[] = [];
      if (customerIds.length > 0) {
        const { data: custData } = await supabase
          .from("customers")
          .select("*")
          .in("id", customerIds);
        customers = (custData ?? []) as Customer[];
        await cacheCustomers(customers as Array<{ id: string } & Record<string, unknown>>);
      }

      // Fetch equipment for customers
      let equipment: EquipmentInventory[] = [];
      if (customerIds.length > 0) {
        const { data: equipData } = await supabase
          .from("equipment_inventory")
          .select("*")
          .in("customer_id", customerIds);
        equipment = (equipData ?? []) as EquipmentInventory[];
        await cacheEquipment(
          equipment as Array<{ id: string; customer_id: string } & Record<string, unknown>>
        );
      }

      // Build ordered stops
      const optimizedOrder: string[] = currentRoute.optimized_order ?? [];
      const customerMap = new Map(customers.map((c) => [c.id, c]));
      const equipmentMap = new Map<string, EquipmentInventory[]>();
      for (const eq of equipment) {
        const list = equipmentMap.get(eq.customer_id) ?? [];
        list.push(eq);
        equipmentMap.set(eq.customer_id, list);
      }

      const orderedStops: RouteStop[] = visitList
        .map((visit, index) => {
          const customer = customerMap.get(visit.customer_id);
          if (!customer) return null;
          const orderIdx = optimizedOrder.indexOf(visit.customer_id);
          return {
            ...visit,
            customer,
            equipment: equipmentMap.get(visit.customer_id) ?? [],
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
      const cachedVisitsData = await getCachedVisits<ServiceVisit>();
      const cachedCustomersData = await getCachedCustomers<Customer>();

      if (cachedRoutesData.length > 0) {
        setRoute(cachedRoutesData[0]);
      }

      const customerMap = new Map(cachedCustomersData.map((c) => [c.id, c]));
      const orderedStops: RouteStop[] = [];

      for (let i = 0; i < cachedVisitsData.length; i++) {
        const visit = cachedVisitsData[i];
        const customer = customerMap.get(visit.customer_id);
        if (!customer) continue;
        const eq = await getCachedEquipment<EquipmentInventory>(visit.customer_id);
        orderedStops.push({
          ...visit,
          customer,
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
    async (visitId: string, updates: Partial<ServiceVisit>) => {
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
