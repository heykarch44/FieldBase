import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface SitePhoto {
  id: string;
  org_id: string;
  jobsite_id: string;
  service_order_id: string | null;
  visit_id: string | null;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  uploader?: { id: string; full_name: string | null; email: string } | null;
}

export async function getSignedPhotoUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("site-photos")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function useSitePhotos(
  jobsiteId: string | null | undefined,
  serviceOrderId?: string | null
) {
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!jobsiteId) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      let query = supabase
        .from("site_photos")
        .select(
          "*, uploader:users!site_photos_uploaded_by_fkey(id, full_name, email)"
        )
        .eq("jobsite_id", jobsiteId)
        .order("created_at", { ascending: false });

      if (serviceOrderId) {
        query = query.eq("service_order_id", serviceOrderId);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setPhotos((data ?? []) as SitePhoto[]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch photos";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [jobsiteId, serviceOrderId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  return { photos, loading, error, refetch, getPhotoUrl: getSignedPhotoUrl };
}
