import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export interface ActivityEntryType {
  id: string;
  org_id: string;
  label: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export function useActivityEntryTypes() {
  const { user } = useAuth();
  const [types, setTypes] = useState<ActivityEntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    if (!user?.active_org_id) {
      setTypes([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("activity_entry_types")
        .select("*")
        .eq("org_id", user.active_org_id)
        .order("sort_order", { ascending: true });
      if (fetchErr) throw fetchErr;
      setTypes((data ?? []) as ActivityEntryType[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load entry types";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.active_org_id]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchTypes();
  }, [fetchTypes]);

  return { types, loading, error, refetch };
}
