import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import type { VisitDetail, Customer, ServiceVisit, ChemicalLog, VisitPhoto, RepairRequest } from "../types/database";

export function useVisitHistory() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fromDate = sevenDaysAgo.toISOString().split("T")[0];

      const { data: visitsData, error: visitError } = await supabase
        .from("service_visits")
        .select("*")
        .eq("technician_id", user.id)
        .eq("status", "completed")
        .gte("scheduled_date", fromDate)
        .order("scheduled_date", { ascending: false });

      if (visitError) throw visitError;
      if (!visitsData || visitsData.length === 0) {
        setVisits([]);
        setLoading(false);
        return;
      }

      const visitList = visitsData as ServiceVisit[];
      const visitIds = visitList.map((v) => v.id);
      const customerIds = [...new Set(visitList.map((v) => v.customer_id))];

      const [customersRes, chemicalsRes, photosRes, repairsRes] = await Promise.all([
        supabase.from("customers").select("*").in("id", customerIds),
        supabase.from("chemical_logs").select("*").in("visit_id", visitIds),
        supabase.from("visit_photos").select("*").in("visit_id", visitIds),
        supabase.from("repair_requests").select("*").in("visit_id", visitIds),
      ]);

      const customerMap = new Map(
        ((customersRes.data ?? []) as Customer[]).map((c) => [c.id, c])
      );
      const chemicalsByVisit = new Map<string, ChemicalLog[]>();
      for (const cl of (chemicalsRes.data ?? []) as ChemicalLog[]) {
        const list = chemicalsByVisit.get(cl.visit_id) ?? [];
        list.push(cl);
        chemicalsByVisit.set(cl.visit_id, list);
      }
      const photosByVisit = new Map<string, VisitPhoto[]>();
      for (const p of (photosRes.data ?? []) as VisitPhoto[]) {
        const list = photosByVisit.get(p.visit_id) ?? [];
        list.push(p);
        photosByVisit.set(p.visit_id, list);
      }
      const repairsByVisit = new Map<string, RepairRequest[]>();
      for (const r of (repairsRes.data ?? []) as RepairRequest[]) {
        if (r.visit_id) {
          const list = repairsByVisit.get(r.visit_id) ?? [];
          list.push(r);
          repairsByVisit.set(r.visit_id, list);
        }
      }

      const detailed: VisitDetail[] = visitList
        .map((visit) => {
          const customer = customerMap.get(visit.customer_id);
          if (!customer) return null;
          return {
            ...visit,
            customer,
            chemical_logs: chemicalsByVisit.get(visit.id) ?? [],
            photos: photosByVisit.get(visit.id) ?? [],
            repair_requests: repairsByVisit.get(visit.id) ?? [],
          };
        })
        .filter((v): v is VisitDetail => v !== null);

      setVisits(detailed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch history");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  return { visits, loading, error, refresh: fetchHistory };
}
