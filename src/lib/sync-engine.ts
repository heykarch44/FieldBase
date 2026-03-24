import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import {
  getQueuedActions,
  removeQueuedAction,
  incrementRetry,
  getQueuedPhotos,
  removeQueuedPhoto,
  logConflict,
} from "./offline-db";

const MAX_RETRIES = 5;

export type SyncStatus = "synced" | "pending" | "error";

export async function syncAll(): Promise<SyncStatus> {
  let hasErrors = false;
  let hasPending = false;

  try {
    const actionResult = await syncActions();
    if (actionResult === "error") hasErrors = true;
    if (actionResult === "pending") hasPending = true;

    const photoResult = await syncPhotos();
    if (photoResult === "error") hasErrors = true;
    if (photoResult === "pending") hasPending = true;
  } catch {
    hasErrors = true;
  }

  if (hasErrors) return "error";
  if (hasPending) return "pending";
  return "synced";
}

async function syncActions(): Promise<SyncStatus> {
  const actions = await getQueuedActions();
  if (actions.length === 0) return "synced";

  let hasErrors = false;

  for (const action of actions) {
    if (action.retry_count >= MAX_RETRIES) {
      hasErrors = true;
      continue;
    }

    try {
      const payload = JSON.parse(action.payload);

      if (action.operation === "update") {
        // Check for conflicts: server timestamp wins
        const { data: serverData } = await supabase
          .from(action.table_name)
          .select("updated_at")
          .eq("id", action.record_id)
          .single();

        if (
          serverData?.updated_at &&
          payload.updated_at &&
          new Date(serverData.updated_at) > new Date(payload.updated_at)
        ) {
          await logConflict(
            action.table_name,
            action.record_id,
            payload,
            serverData
          );
          await removeQueuedAction(action.id);
          continue;
        }

        const { error } = await supabase
          .from(action.table_name)
          .update(payload)
          .eq("id", action.record_id);

        if (error) throw error;
      } else if (action.operation === "insert") {
        const { error } = await supabase
          .from(action.table_name)
          .insert(payload);

        if (error) throw error;
      } else if (action.operation === "upsert") {
        const { error } = await supabase
          .from(action.table_name)
          .upsert(payload);

        if (error) throw error;
      }

      await removeQueuedAction(action.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await incrementRetry(action.id, message);
      hasErrors = true;
    }
  }

  return hasErrors ? "error" : "synced";
}

async function syncPhotos(): Promise<SyncStatus> {
  const photos = await getQueuedPhotos();
  if (photos.length === 0) return "synced";

  let hasErrors = false;

  for (const photo of photos) {
    if (photo.retry_count >= MAX_RETRIES) {
      hasErrors = true;
      continue;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(photo.local_uri);
      if (!fileInfo.exists) {
        await removeQueuedPhoto(photo.id);
        continue;
      }

      const fileName = `${photo.visit_id}/${Date.now()}_${photo.photo_type}.jpg`;
      const fileBase64 = await FileSystem.readAsStringAsync(photo.local_uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error: uploadError } = await supabase.storage
        .from("visit-photos")
        .upload(fileName, decode(fileBase64), {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("visit-photos")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("visit_photos")
        .insert({
          visit_id: photo.visit_id,
          storage_url: urlData.publicUrl,
          photo_type: photo.photo_type,
          caption: photo.caption,
          lat: photo.lat,
          lng: photo.lng,
          taken_at: photo.taken_at,
        });

      if (insertError) throw insertError;

      await removeQueuedPhoto(photo.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await incrementRetry(photo.id as unknown as number, message);
      hasErrors = true;
    }
  }

  return hasErrors ? "error" : "synced";
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
