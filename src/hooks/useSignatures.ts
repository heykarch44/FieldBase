import { useCallback, useEffect, useState } from "react";
import uuid from "react-native-uuid";
import { supabase } from "../lib/supabase";
import { useOrg } from "../providers/OrgProvider";
import type { Signature } from "../types/database";

export async function getSignedSignatureUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("signatures")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function useSignatures(serviceOrderId: string | null | undefined) {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignatures = useCallback(async () => {
    if (!serviceOrderId) {
      setSignatures([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("signatures")
        .select("*")
        .eq("entity_type", "service_order")
        .eq("entity_id", serviceOrderId)
        .order("signed_at", { ascending: false });
      if (fetchErr) throw fetchErr;
      setSignatures((data ?? []) as Signature[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch signatures");
    } finally {
      setLoading(false);
    }
  }, [serviceOrderId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchSignatures();
  }, [fetchSignatures]);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  return { signatures, loading, error, refresh, getSignedUrl: getSignedSignatureUrl };
}

// Convert base64 PNG to a Uint8Array for Supabase upload
function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, "");
  const bin = globalThis.atob(cleaned);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function useCreateSignature() {
  const { orgId } = useOrg();

  return useCallback(
    async ({
      serviceOrderId,
      signerName,
      base64Png,
    }: {
      serviceOrderId: string;
      signerName: string;
      base64Png: string;
    }): Promise<{ id: string; storagePath: string }> => {
      if (!orgId) throw new Error("No active organization");
      if (!signerName.trim()) throw new Error("Signer name is required");
      if (!base64Png) throw new Error("Signature is empty");

      const fileId = String(uuid.v4());
      const storagePath = `${orgId}/${serviceOrderId}/${fileId}.png`;
      const bytes = base64ToUint8Array(base64Png);

      const { error: uploadErr } = await supabase.storage
        .from("signatures")
        .upload(storagePath, bytes, {
          contentType: "image/png",
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      const { data: inserted, error: insertErr } = await supabase
        .from("signatures")
        .insert({
          org_id: orgId,
          entity_type: "service_order",
          entity_id: serviceOrderId,
          signer_name: signerName.trim(),
          signer_role: "customer",
          signature_url: storagePath,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      return { id: (inserted as { id: string }).id, storagePath };
    },
    [orgId]
  );
}
