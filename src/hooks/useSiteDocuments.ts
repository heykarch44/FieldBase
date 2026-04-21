import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface SiteDocument {
  id: string;
  org_id: string;
  entity_type: string;
  entity_id: string;
  doc_type: string;
  name: string;
  storage_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { id: string; full_name: string | null; email: string } | null;
}

export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("fieldbase")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function useSiteDocuments(jobsiteId: string | null | undefined) {
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!jobsiteId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("documents")
        .select(
          "*, uploader:users!documents_uploaded_by_fkey(id, full_name, email)"
        )
        .eq("entity_type", "jobsite")
        .eq("entity_id", jobsiteId)
        .order("created_at", { ascending: false });
      if (fetchErr) throw fetchErr;
      setDocuments((data ?? []) as SiteDocument[]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch documents";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [jobsiteId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refetch,
    getDocumentUrl: getSignedDocumentUrl,
  };
}
