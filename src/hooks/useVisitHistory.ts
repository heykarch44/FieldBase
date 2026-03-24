import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

interface VisitHistoryItem {
  id: string;
  scheduled_date: string;
  status: string;
  arrived_at: string | null;
  departed_at: string | null;
  notes: string | null;
  jobsite: {
    id: string;
    name: string;
    address_line1: string;
    city: string;
  };
  photos: Array<{ id: string }>;
  service_orders: Array<{
    id: string;
    title: string;
    urgency: string;
    description: string | null;
  }>;
}

export function useVisitHistory() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitHistoryItem[]>([]);
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
        .from("visits")
        .select(`
          id, scheduled_date, status, arrived_at, departed_at, notes,
          jobsite:jobsites(id, name, address_line1, city)
        `)
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

      const visitIds = visitsData.map((v) => v.id);

      const [photosRes, ordersRes] = await Promise.all([
        supabase.from("photos").select("id, entity_id").eq("entity_type", "visit").in("entity_id", visitIds),
        supabase.from("service_orders").select("id, visit_id, title, urgency, description").in("visit_id", visitIds),
      ]);

      const photosByVisit = new Map<string, Array<{ id: string }>>();
      for (const p of photosRes.data ?? []) {
        const list = photosByVisit.get(p.entity_id) ?? [];
        list.push({ id: p.id });
        photosByVisit.set(p.entity_id, list);
      }

      const ordersByVisit = new Map<string, Array<{ id: string; title: string; urgency: string; description: string | null }>>();
      for (const o of (ordersRes.data ?? []) as Array<{ id: string; visit_id: string; title: string; urgency: string; description: string | null }>) {
        const list = ordersByVisit.get(o.visit_id) ?? [];
        list.push({ id: o.id, title: o.title, urgency: o.urgency, description: o.description });
        ordersByVisit.set(o.visit_id, list);
      }

      const detailed: VisitHistoryItem[] = visitsData.map((visit) => ({
        ...visit,
        jobsite: visit.jobsite as unknown as VisitHistoryItem["jobsite"],
        photos: photosByVisit.get(visit.id) ?? [],
        service_orders: ordersByVisit.get(visit.id) ?? [],
      }));

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
