import { useState, useCallback } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import uuid from "react-native-uuid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

interface UploadOptions {
  jobsiteId: string;
  serviceOrderId?: string | null;
  onUploaded?: () => void;
}

interface ProgressState {
  total: number;
  done: number;
  failed: number;
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

export function useUploadSitePhotos({
  jobsiteId,
  serviceOrderId,
  onUploaded,
}: UploadOptions) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    total: 0,
    done: 0,
    failed: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const uploadAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset, orgId: string) => {
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

      const { error: insertErr } = await supabase.from("site_photos").insert({
        org_id: orgId,
        jobsite_id: jobsiteId,
        service_order_id: serviceOrderId ?? null,
        uploaded_by: user?.id ?? null,
        storage_path: storagePath,
        file_name: asset.fileName ?? `${id}.${ext}`,
        mime_type: mime,
        file_size_bytes: asset.fileSize ?? bytes.byteLength,
        width: asset.width ?? null,
        height: asset.height ?? null,
      });

      if (insertErr) {
        await supabase.storage.from("site-photos").remove([storagePath]);
        throw insertErr;
      }
    },
    [jobsiteId, serviceOrderId, user?.id]
  );

  const uploadAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (!user?.active_org_id) {
        Alert.alert(
          "No organization",
          "Cannot upload photos without an active organization."
        );
        return;
      }
      if (assets.length === 0) return;

      setUploading(true);
      setError(null);
      setProgress({ total: assets.length, done: 0, failed: 0 });

      let done = 0;
      let failed = 0;

      for (const asset of assets) {
        try {
          await uploadAsset(asset, user.active_org_id);
          done += 1;
        } catch (err) {
          failed += 1;
          const msg = err instanceof Error ? err.message : "Upload failed";
          setError(msg);
        }
        setProgress({ total: assets.length, done, failed });
      }

      setUploading(false);
      if (failed > 0) {
        Alert.alert(
          "Upload incomplete",
          `${done} uploaded, ${failed} failed. Tap retry on a failed photo.`
        );
      }
      onUploaded?.();
    },
    [uploadAsset, user?.active_org_id, onUploaded]
  );

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        "Please enable photo library access in Settings to add photos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
      exif: false,
    });

    if (result.canceled) return;
    await uploadAssets(result.assets);
  }, [uploadAssets]);

  const pickFromCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        "Please enable camera access in Settings to take photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
      exif: false,
    });

    if (result.canceled) return;
    await uploadAssets(result.assets);
  }, [uploadAssets]);

  return {
    pickFromCamera,
    pickFromLibrary,
    uploading,
    progress,
    error,
  };
}
