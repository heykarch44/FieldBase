import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import type {
  Jobsite,
  ServiceOrder,
  ServiceOrderStatus,
} from "../types/database";

export interface ScheduleItem extends ServiceOrder {
  jobsite: Jobsite | null;
}

export interface ScheduleSection {
  title: string;
  data: ScheduleItem[];
}

const ACTIVE_STATUSES: ServiceOrderStatus[] = [
  "scheduled",
  "approved",
  "in_progress",
];

export function useScheduleData() {
  const { user } = useAuth();
  const [sections, setSections] = useState<ScheduleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();

  const buildSections = (orders: ScheduleItem[]): ScheduleSection[] => {
    const active: ScheduleItem[] = [];
    const todayItems: ScheduleItem[] = [];
    const upcoming: ScheduleItem[] = [];

    for (const o of orders) {
      // Active: in_progress, regardless of date
      if (o.status === "in_progress") {
        active.push(o);
        continue;
      }
      if (!o.scheduled_date) continue;
      if (o.scheduled_date === today) {
        todayItems.push(o);
      } else if (o.scheduled_date > today && o.scheduled_date <= sevenDaysFromNow) {
        upcoming.push(o);
      }
    }

    // Sort within sections
    todayItems.sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));
    upcoming.sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));

    const result: ScheduleSection[] = [];
    if (active.length > 0) result.push({ title: "In Progress", data: active });
    if (todayItems.length > 0) result.push({ title: "Today", data: todayItems });
    if (upcoming.length > 0) result.push({ title: "Upcoming", data: upcoming });
    return result;
  };

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // 1. Get assigned service_order_ids for this user
      const { data: assignments, error: assignErr } = await supabase
        .from("service_order_assignees")
        .select("service_order_id")
        .eq("user_id", user.id);

      if (assignErr) throw assignErr;

      if (!assignments || assignments.length === 0) {
        setSections([]);
        setLoading(false);
        return;
      }

      const orderIds = assignments.map(
        (a: { service_order_id: string }) => a.service_order_id
      );

      // 2. Fetch scheduled/in-progress orders only, within today..+7 window
      // (in_progress pulled regardless of date; upcoming constrained; today matched)
      const { data: ordersData, error: ordersErr } = await supabase
        .from("service_orders")
        .select("*")
        .in("id", orderIds)
        .in("status", ACTIVE_STATUSES)
        .or(`scheduled_date.is.null,scheduled_date.gte.${today}`);

      if (ordersErr) throw ordersErr;

      const orders = (ordersData ?? []) as ServiceOrder[];

      if (orders.length === 0) {
        setSections([]);
        setLoading(false);
        return;
      }

      // 3. Jobsites
      const jobsiteIds = [...new Set(orders.map((o) => o.jobsite_id))];
      const { data: jobsitesData } = await supabase
        .from("jobsites")
        .select("*")
        .in("id", jobsiteIds);

      const jobsiteMap = new Map(
        ((jobsitesData ?? []) as Jobsite[]).map((j) => [j.id, j])
      );

      const items: ScheduleItem[] = orders.map((o) => ({
        ...o,
        jobsite: jobsiteMap.get(o.jobsite_id) ?? null,
      }));

      setSections(buildSections(items));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch schedule";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, today, sevenDaysFromNow]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  return { sections, loading, error, refresh };
}
