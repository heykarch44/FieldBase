import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import type { Jobsite } from "../types/database";

export interface AssignedSiteItem extends Jobsite {
  open_orders_count: number;
  next_visit_date: string | null;
}

export function useAssignedSites() {
  const { user } = useAuth();
  const [sites, setSites] = useState<AssignedSiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // 1. Get all jobsite_ids assigned to this tech
      const { data: assignments, error: assignErr } = await supabase
        .from("jobsite_assignees")
        .select("jobsite_id")
        .eq("user_id", user.id);

      if (assignErr) throw assignErr;

      if (!assignments || assignments.length === 0) {
        setSites([]);
        setLoading(false);
        return;
      }

      const siteIds = assignments.map(
        (a: { jobsite_id: string }) => a.jobsite_id
      );

      // 2. Fetch the actual jobsites
      const { data: jobsitesData, error: jobsitesErr } = await supabase
        .from("jobsites")
        .select("*")
        .in("id", siteIds)
        .order("name");

      if (jobsitesErr) throw jobsitesErr;

      const jobsites = (jobsitesData ?? []) as Jobsite[];

      if (jobsites.length === 0) {
        setSites([]);
        setLoading(false);
        return;
      }

      // 3. Fetch open orders counts (status not in closed set)
      const { data: ordersData } = await supabase
        .from("service_orders")
        .select("jobsite_id, status")
        .in("jobsite_id", siteIds);

      const openOrdersMap = new Map<string, number>();
      if (ordersData) {
        for (const o of ordersData as { jobsite_id: string; status: string }[]) {
          if (
            !["completed", "canceled", "invoiced"].includes(o.status)
          ) {
            openOrdersMap.set(
              o.jobsite_id,
              (openOrdersMap.get(o.jobsite_id) ?? 0) + 1
            );
          }
        }
      }

      // 4. Fetch next scheduled visit date per site (from today forward)
      const today = new Date().toISOString().split("T")[0];
      const { data: visitsData } = await supabase
        .from("visits")
        .select("jobsite_id, scheduled_date, status")
        .in("jobsite_id", siteIds)
        .gte("scheduled_date", today)
        .in("status", ["scheduled", "en_route", "in_progress"])
        .order("scheduled_date", { ascending: true });

      const nextVisitMap = new Map<string, string>();
      if (visitsData) {
        for (const v of visitsData as {
          jobsite_id: string;
          scheduled_date: string;
        }[]) {
          if (!nextVisitMap.has(v.jobsite_id)) {
            nextVisitMap.set(v.jobsite_id, v.scheduled_date);
          }
        }
      }

      // 5. Build items
      const items: AssignedSiteItem[] = jobsites.map((j) => ({
        ...j,
        open_orders_count: openOrdersMap.get(j.id) ?? 0,
        next_visit_date: nextVisitMap.get(j.id) ?? null,
      }));

      setSites(items);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch assigned sites";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    if (user) fetchSites();
  }, [user]);

  return { sites, loading, error, refresh };
}
