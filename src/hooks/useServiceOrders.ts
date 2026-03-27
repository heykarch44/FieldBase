import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import { useNetwork } from "../providers/NetworkProvider";
import type { ServiceOrder, Jobsite, ServiceOrderStatus } from "../types/database";

export interface ServiceOrderItem extends ServiceOrder {
  jobsite: Jobsite | null;
  requester_name: string | null;
}

export interface ServiceOrderSection {
  title: string;
  data: ServiceOrderItem[];
}

const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0,
  scheduled: 1,
  approved: 2,
  pending: 3,
  completed: 4,
  invoiced: 5,
  draft: 6,
};

export function useServiceOrders() {
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  const [sections, setSections] = useState<ServiceOrderSection[]>([]);
  const [allOrders, setAllOrders] = useState<ServiceOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildSections = (orders: ServiceOrderItem[]): ServiceOrderSection[] => {
    const active: ServiceOrderItem[] = [];
    const upcoming: ServiceOrderItem[] = [];
    const done: ServiceOrderItem[] = [];

    for (const order of orders) {
      if (order.status === "in_progress") {
        active.push(order);
      } else if (["completed", "invoiced", "canceled"].includes(order.status)) {
        done.push(order);
      } else {
        upcoming.push(order);
      }
    }

    // Sort upcoming by urgency weight then scheduled date
    const urgencyWeight: Record<string, number> = {
      emergency: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    upcoming.sort((a, b) => {
      const ua = urgencyWeight[a.urgency] ?? 2;
      const ub = urgencyWeight[b.urgency] ?? 2;
      if (ua !== ub) return ua - ub;
      if (a.scheduled_date && b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date);
      if (a.scheduled_date) return -1;
      if (b.scheduled_date) return 1;
      return 0;
    });

    // Sort done by most recent first
    done.sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at));

    const result: ServiceOrderSection[] = [];
    if (active.length > 0) result.push({ title: "In Progress", data: active });
    if (upcoming.length > 0) result.push({ title: "Assigned", data: upcoming });
    if (done.length > 0) result.push({ title: "Completed", data: done.slice(0, 20) });

    return result;
  };

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // 1. Get all service_order_ids assigned to this tech
      const { data: assignments, error: assignErr } = await supabase
        .from("service_order_assignees")
        .select("service_order_id")
        .eq("user_id", user.id);

      if (assignErr) throw assignErr;

      if (!assignments || assignments.length === 0) {
        setSections([]);
        setAllOrders([]);
        setLoading(false);
        return;
      }

      const orderIds = assignments.map((a: { service_order_id: string }) => a.service_order_id);

      // 2. Fetch the actual service orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from("service_orders")
        .select("*")
        .in("id", orderIds)
        .not("status", "eq", "canceled");

      if (ordersErr) throw ordersErr;

      const orders = (ordersData ?? []) as ServiceOrder[];

      if (orders.length === 0) {
        setSections([]);
        setAllOrders([]);
        setLoading(false);
        return;
      }

      // 3. Fetch jobsites for these orders
      const jobsiteIds = [...new Set(orders.map((o) => o.jobsite_id))];
      const { data: jobsitesData } = await supabase
        .from("jobsites")
        .select("*")
        .in("id", jobsiteIds);

      const jobsiteMap = new Map(
        ((jobsitesData ?? []) as Jobsite[]).map((j) => [j.id, j])
      );

      // 4. Fetch requester names
      const requesterIds = [...new Set(orders.filter((o) => o.requested_by).map((o) => o.requested_by!))];
      let requesterMap = new Map<string, string>();
      if (requesterIds.length > 0) {
        const { data: requestersData } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", requesterIds);
        if (requestersData) {
          requesterMap = new Map(
            (requestersData as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name])
          );
        }
      }

      // 5. Build items
      const items: ServiceOrderItem[] = orders.map((o) => ({
        ...o,
        jobsite: jobsiteMap.get(o.jobsite_id) ?? null,
        requester_name: o.requested_by ? requesterMap.get(o.requested_by) ?? null : null,
      }));

      setAllOrders(items);
      setSections(buildSections(items));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch service orders";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  return { sections, allOrders, loading, error, refresh };
}
