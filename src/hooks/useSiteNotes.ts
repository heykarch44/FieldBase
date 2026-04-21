import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export interface SiteNote {
  id: string;
  org_id: string;
  jobsite_id: string;
  service_order_id: string | null;
  visit_id: string | null;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: { id: string; full_name: string | null; email: string } | null;
}

export function useSiteNotes(params: {
  jobsiteId: string | null | undefined;
  serviceOrderId?: string | null;
}) {
  const { jobsiteId, serviceOrderId } = params;
  const { user } = useAuth();
  const [notes, setNotes] = useState<SiteNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!jobsiteId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      let query = supabase
        .from("site_notes")
        .select(
          "*, author:users!site_notes_author_id_fkey(id, full_name, email)"
        )
        .eq("jobsite_id", jobsiteId)
        .order("created_at", { ascending: false });

      if (serviceOrderId) {
        query = query.eq("service_order_id", serviceOrderId);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setNotes((data ?? []) as SiteNote[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch notes";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [jobsiteId, serviceOrderId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = useCallback(
    async (body: string): Promise<{ error: string | null }> => {
      const trimmed = body.trim();
      if (!trimmed) return { error: "Note is empty" };
      if (!jobsiteId) return { error: "No jobsite" };
      if (!user?.id || !user.active_org_id) {
        return { error: "Not authenticated" };
      }
      const { error: insertErr } = await supabase.from("site_notes").insert({
        org_id: user.active_org_id,
        jobsite_id: jobsiteId,
        service_order_id: serviceOrderId ?? null,
        author_id: user.id,
        body: trimmed,
      });
      if (insertErr) return { error: insertErr.message };
      await fetchNotes();
      return { error: null };
    },
    [jobsiteId, serviceOrderId, user?.id, user?.active_org_id, fetchNotes]
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<{ error: string | null }> => {
      const { error: deleteErr } = await supabase
        .from("site_notes")
        .delete()
        .eq("id", noteId);
      if (deleteErr) return { error: deleteErr.message };
      await fetchNotes();
      return { error: null };
    },
    [fetchNotes]
  );

  return { notes, loading, error, refetch, addNote, deleteNote };
}
