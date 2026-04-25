import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import { useAuth } from "../providers/AuthProvider";
import type { Jobsite } from "../types/database";

// Hard timeout per query so a stuck Supabase call on bad cell can't
// pin the sites tab on its loading spinner indefinitely — which also
// starved useClockStateReconcile of its sites list and prevented
// foreground auto clock-in.
const SITES_QUERY_TIMEOUT_MS = 8_000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY: any = { data: null, error: null };

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
      const { data: assignments, error: assignErr } = await withTimeout(
        supabase
          .from("jobsite_assignees")
          .select("jobsite_id")
          .eq("user_id", user.id),
        SITES_QUERY_TIMEOUT_MS,
        EMPTY
      );

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
      const { data: jobsitesData, error: jobsitesErr } = await withTimeout(
        supabase
          .from("jobsites")
          .select("*")
          .in("id", siteIds)
          .order("name"),
        SITES_QUERY_TIMEOUT_MS,
        EMPTY
      );

      if (jobsitesErr) throw jobsitesErr;

      const jobsites = (jobsitesData ?? []) as Jobsite[];

      if (jobsites.length === 0) {
        setSites([]);
        setLoading(false);
        return;
      }

      // 3. Fetch open orders counts (status not in closed set)
      const { data: ordersData } = await withTimeout(
        supabase
          .from("service_orders")
          .select("jobsite_id, status")
          .in("jobsite_id", siteIds),
        SITES_QUERY_TIMEOUT_MS,
        EMPTY
      );

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
      const { data: visitsData } = await withTimeout(
        supabase
          .from("visits")
          .select("jobsite_id, scheduled_date, status")
          .in("jobsite_id", siteIds)
          .gte("scheduled_date", today)
          .in("status", ["scheduled", "en_route", "in_progress"])
          .order("scheduled_date", { ascending: true }),
        SITES_QUERY_TIMEOUT_MS,
        EMPTY
      );

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
