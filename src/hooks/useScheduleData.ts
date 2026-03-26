import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  cacheJobsites,
  cacheVisits,
  cacheEquipment,
  getCachedJobsites,
  getCachedVisits,
  getCachedEquipment,
} from "../lib/offline-db";
import type { Jobsite, Visit, Equipment } from "../types/database";
import { useAuth } from "../providers/AuthProvider";
import { useNetwork } from "../providers/NetworkProvider";

export interface ScheduleItem extends Visit {
  jobsite: Jobsite;
  equipment: Equipment[];
}

export interface ScheduleSection {
  title: string;
  data: ScheduleItem[];
}

export function useScheduleData() {
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  const [sections, setSections] = useState<ScheduleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const sevenDaysFromNow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();

  const buildSections = (
    activeVisits: Visit[],
    todayVisits: Visit[],
    upcomingVisits: Visit[],
    jobsiteMap: Map<string, Jobsite>,
    equipmentMap: Map<string, Equipment[]>
  ): ScheduleSection[] => {
    const toItem = (v: Visit): ScheduleItem | null => {
      const jobsite = jobsiteMap.get(v.jobsite_id);
      if (!jobsite) return null;
      return {
        ...v,
        jobsite,
        equipment: equipmentMap.get(v.jobsite_id) ?? [],
      };
    };

    const result: ScheduleSection[] = [];

    const activeItems = activeVisits.map(toItem).filter((s): s is ScheduleItem => s !== null);
    if (activeItems.length > 0) {
      result.push({ title: "Active", data: activeItems });
    }

    const todayItems = todayVisits.map(toItem).filter((s): s is ScheduleItem => s !== null);
    if (todayItems.length > 0) {
      result.push({ title: "Today", data: todayItems });
    }

    const upcomingItems = upcomingVisits.map(toItem).filter((s): s is ScheduleItem => s !== null);
    if (upcomingItems.length > 0) {
      result.push({ title: "Upcoming", data: upcomingItems });
    }

    return result;
  };

  const fetchOnline = useCallback(async () => {
    if (!user) return;

    try {
      // Active: in_progress visits from prior days
      const { data: activeData, error: activeErr } = await supabase
        .from("visits")
        .select("*")
        .eq("technician_id", user.id)
        .eq("status", "in_progress")
        .lt("scheduled_date", today);

      if (activeErr) throw activeErr;

      // Today's visits
      const { data: todayData, error: todayErr } = await supabase
        .from("visits")
        .select("*")
        .eq("technician_id", user.id)
        .eq("scheduled_date", today)
        .in("status", ["scheduled", "en_route", "in_progress", "completed"])
        .order("scheduled_time", { ascending: true, nullsFirst: false });

      if (todayErr) throw todayErr;

      // Upcoming: next 7 days
      const { data: upcomingData, error: upcomingErr } = await supabase
        .from("visits")
        .select("*")
        .eq("technician_id", user.id)
        .gt("scheduled_date", today)
        .lte("scheduled_date", sevenDaysFromNow)
        .eq("status", "scheduled")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (upcomingErr) throw upcomingErr;

      const activeVisits = (activeData ?? []) as Visit[];
      const todayVisits = (todayData ?? []) as Visit[];
      const upcomingVisits = (upcomingData ?? []) as Visit[];
      const allVisits = [...activeVisits, ...todayVisits, ...upcomingVisits];

      // Cache visits
      await cacheVisits(allVisits as Array<{ id: string } & Record<string, unknown>>);

      // Fetch jobsites
      const jobsiteIds = [...new Set(allVisits.map((v) => v.jobsite_id))];
      let jobsites: Jobsite[] = [];
      if (jobsiteIds.length > 0) {
        const { data: jobsiteData } = await supabase
          .from("jobsites")
          .select("*")
          .in("id", jobsiteIds);
        jobsites = (jobsiteData ?? []) as Jobsite[];
        await cacheJobsites(jobsites as Array<{ id: string } & Record<string, unknown>>);
      }

      // Fetch equipment
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

      const jobsiteMap = new Map(jobsites.map((j) => [j.id, j]));
      const equipmentMap = new Map<string, Equipment[]>();
      for (const eq of equipment) {
        const list = equipmentMap.get(eq.jobsite_id) ?? [];
        list.push(eq);
        equipmentMap.set(eq.jobsite_id, list);
      }

      setSections(buildSections(activeVisits, todayVisits, upcomingVisits, jobsiteMap, equipmentMap));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch schedule data";
      setError(msg);
      await loadFromCache();
    } finally {
      setLoading(false);
    }
  }, [user, today, sevenDaysFromNow]);

  const loadFromCache = useCallback(async () => {
    try {
      const cachedVisitsData = await getCachedVisits<Visit>();
      const cachedJobsitesData = await getCachedJobsites<Jobsite>();

      const jobsiteMap = new Map(cachedJobsitesData.map((j) => [j.id, j]));
      const equipmentMap = new Map<string, Equipment[]>();

      for (const visit of cachedVisitsData) {
        if (!equipmentMap.has(visit.jobsite_id)) {
          const eq = await getCachedEquipment<Equipment>(visit.jobsite_id);
          equipmentMap.set(visit.jobsite_id, eq);
        }
      }

      const activeVisits = cachedVisitsData.filter(
        (v) => v.status === "in_progress" && v.scheduled_date < today
      );
      const todayVisits = cachedVisitsData.filter(
        (v) =>
          v.scheduled_date === today &&
          ["scheduled", "en_route", "in_progress", "completed"].includes(v.status)
      );
      const upcomingVisits = cachedVisitsData.filter(
        (v) =>
          v.scheduled_date > today &&
          v.scheduled_date <= sevenDaysFromNow &&
          v.status === "scheduled"
      );

      setSections(buildSections(activeVisits, todayVisits, upcomingVisits, jobsiteMap, equipmentMap));
    } catch {
      setError("Failed to load cached data");
    } finally {
      setLoading(false);
    }
  }, [today, sevenDaysFromNow]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isConnected) {
      await fetchOnline();
    } else {
      await loadFromCache();
    }
  }, [isConnected, fetchOnline, loadFromCache]);

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  return { sections, loading, error, refresh };
}
