import { useState, useCallback, useEffect } from "react";
import * as FileSystem from "expo-file-system";
import uuid from "react-native-uuid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import type { ActivityEntryType } from "./useActivityEntryTypes";
import type { SitePhoto } from "./useSitePhotos";

export interface ActivityEntry {
  id: string;
  org_id: string;
  jobsite_id: string;
  service_order_id: string | null;
  visit_id: string | null;
  entry_type_id: string | null;
  title: string;
  body: string | null;
  author_id: string | null;
  occurred_at: string;
  created_at: string;
  entry_type?: ActivityEntryType | null;
  author?: { id: string; full_name: string | null; email: string } | null;
  photos?: SitePhoto[];
}

interface UsePhotoAsset {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  base64?: string | null;
}

interface AddEntryArgs {
  entry_type_id: string | null;
  title: string;
  body: string | null;
  occurred_at?: string;
  photos?: UsePhotoAsset[];
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function guessMimeFromExt(uri: string): { mime: string; ext: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return { mime: "image/png", ext: "png" };
  if (lower.endsWith(".webp")) return { mime: "image/webp", ext: "webp" };
  if (lower.endsWith(".heic")) return { mime: "image/heic", ext: "heic" };
  if (lower.endsWith(".heif")) return { mime: "image/heif", ext: "heif" };
  return { mime: "image/jpeg", ext: "jpg" };
}

export function useActivityEntries(params: {
  jobsiteId: string | null | undefined;
  serviceOrderId?: string | null;
}) {
  const { jobsiteId, serviceOrderId } = params;
  const { user } = useAuth();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!jobsiteId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      let query = supabase
        .from("activity_entries")
        .select(
          `*,
          entry_type:activity_entry_types(*),
          author:users!activity_entries_author_id_fkey(id, full_name, email)`
        )
        .eq("jobsite_id", jobsiteId)
        .order("occurred_at", { ascending: false });

      if (serviceOrderId) {
        query = query.eq("service_order_id", serviceOrderId);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      const raw = (data ?? []) as ActivityEntry[];

      const ids = raw.map((e) => e.id);
      let photosByEntry: Record<string, SitePhoto[]> = {};
      if (ids.length > 0) {
        const { data: linksData } = await supabase
          .from("activity_entry_photos")
          .select("entry_id, photo:site_photos(*)")
          .in("entry_id", ids);
        const rows = (linksData ?? []) as unknown as {
          entry_id: string;
          photo: SitePhoto | null;
        }[];
        photosByEntry = rows.reduce<Record<string, SitePhoto[]>>((acc, r) => {
          if (!r.photo) return acc;
          if (!acc[r.entry_id]) acc[r.entry_id] = [];
          acc[r.entry_id].push(r.photo);
          return acc;
        }, {});
      }
      setEntries(raw.map((e) => ({ ...e, photos: photosByEntry[e.id] ?? [] })));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load activity";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [jobsiteId, serviceOrderId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchEntries();
  }, [fetchEntries]);

  const addEntry = useCallback(
    async (args: AddEntryArgs): Promise<{ error: string | null }> => {
      if (!jobsiteId) return { error: "No jobsite" };
      if (!user?.id || !user.active_org_id) return { error: "Not authenticated" };
      if (!args.title.trim()) return { error: "Title is required" };

      const orgId = user.active_org_id;
      const occurredAt = args.occurred_at ?? new Date().toISOString();

      try {
        const { data: inserted, error: insertErr } = await supabase
          .from("activity_entries")
          .insert({
            org_id: orgId,
            jobsite_id: jobsiteId,
            service_order_id: serviceOrderId ?? null,
            entry_type_id: args.entry_type_id,
            title: args.title.trim(),
            body: args.body?.trim() || null,
            author_id: user.id,
            occurred_at: occurredAt,
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        const entryId = (inserted as { id: string }).id;

        for (const asset of args.photos ?? []) {
          const { mime: guessedMime, ext: guessedExt } = guessMimeFromExt(
            asset.fileName ?? asset.uri
          );
          const mime = asset.mimeType ?? guessedMime;
          const ext = (asset.fileName?.split(".").pop() ?? guessedExt).toLowerCase();

          const base64 =
            asset.base64 ??
            (await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            }));

          const bytes = decodeBase64(base64);
          const id = String(uuid.v4());
          const storagePath = `${orgId}/${jobsiteId}/${id}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from("site-photos")
            .upload(storagePath, bytes, {
              contentType: mime,
              upsert: false,
            });
          if (uploadErr) throw uploadErr;

          const { data: photoRow, error: photoInsErr } = await supabase
            .from("site_photos")
            .insert({
              org_id: orgId,
              jobsite_id: jobsiteId,
              service_order_id: serviceOrderId ?? null,
              uploaded_by: user.id,
              storage_path: storagePath,
              file_name: asset.fileName ?? `${id}.${ext}`,
              mime_type: mime,
              file_size_bytes: asset.fileSize ?? bytes.byteLength,
              width: asset.width ?? null,
              height: asset.height ?? null,
            })
            .select("id")
            .single();
          if (photoInsErr) {
            await supabase.storage.from("site-photos").remove([storagePath]);
            throw photoInsErr;
          }

          const { error: linkErr } = await supabase
            .from("activity_entry_photos")
            .insert({
              org_id: orgId,
              entry_id: entryId,
              photo_id: (photoRow as { id: string }).id,
            });
          if (linkErr) throw linkErr;
        }

        await fetchEntries();
        return { error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add entry";
        return { error: msg };
      }
    },
    [jobsiteId, serviceOrderId, user?.id, user?.active_org_id, fetchEntries]
  );

  const deleteEntry = useCallback(
    async (entryId: string): Promise<{ error: string | null }> => {
      try {
        await supabase.from("activity_entry_photos").delete().eq("entry_id", entryId);
        const { error: delErr } = await supabase
          .from("activity_entries")
          .delete()
          .eq("id", entryId);
        if (delErr) return { error: delErr.message };
        await fetchEntries();
        return { error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete entry";
        return { error: msg };
      }
    },
    [fetchEntries]
  );

  return { entries, loading, error, refetch, addEntry, deleteEntry };
}
