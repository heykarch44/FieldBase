import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import type { ActivityEntryType } from "../hooks/useActivityEntryTypes";
import { activityColorForKey, activityIconForKey } from "./activityStyles";

interface PendingPhoto {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  base64?: string | null;
}

interface ActivityEntryModalProps {
  visible: boolean;
  onClose: () => void;
  entryTypes: ActivityEntryType[];
  onSubmit: (args: {
    entry_type_id: string | null;
    title: string;
    body: string | null;
    photos: PendingPhoto[];
  }) => Promise<{ error: string | null }>;
}

export function ActivityEntryModal({
  visible,
  onClose,
  entryTypes,
  onSubmit,
}: ActivityEntryModalProps) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setTypeId(null);
    setTitle("");
    setBody("");
    setPhotos([]);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [onClose, reset, submitting]);

  const addPhotosFromAssets = useCallback(
    (assets: ImagePicker.ImagePickerAsset[]) => {
      const mapped: PendingPhoto[] = assets.map((a) => ({
        uri: a.uri,
        mimeType: a.mimeType ?? null,
        fileName: a.fileName ?? null,
        fileSize: a.fileSize ?? null,
        width: a.width ?? null,
        height: a.height ?? null,
        base64: a.base64 ?? null,
      }));
      setPhotos((prev) => [...prev, ...mapped]);
    },
    []
  );

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Enable camera access in Settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
      exif: false,
    });
    if (result.canceled) return;
    addPhotosFromAssets(result.assets);
  }, [addPhotosFromAssets]);

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Enable photo library access in Settings.");
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
    addPhotosFromAssets(result.assets);
  }, [addPhotosFromAssets]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a title.");
      return;
    }
    setSubmitting(true);
    const { error } = await onSubmit({
      entry_type_id: typeId,
      title: title.trim(),
      body: body.trim() || null,
      photos,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Could not save", error);
      return;
    }
    reset();
    onClose();
  }, [body, onClose, onSubmit, photos, reset, title, typeId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={submitting}>
            <Text style={styles.headerBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Entry</Text>
          <TouchableOpacity onPress={handleSave} disabled={submitting || !title.trim()}>
            <Text
              style={[
                styles.headerBtn,
                styles.headerBtnPrimary,
                (!title.trim() || submitting) && styles.headerBtnDisabled,
              ]}
            >
              {submitting ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Type picker */}
            <Text style={styles.sectionLabel}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeRow}
            >
              {entryTypes.map((t) => {
                const selected = typeId === t.id;
                const color = activityColorForKey(t.color);
                const iconName = activityIconForKey(t.icon);
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setTypeId(selected ? null : t.id)}
                    style={[
                      styles.typeChip,
                      { backgroundColor: selected ? color.bg : Colors.white },
                      {
                        borderColor: selected ? color.fg : Colors.gray[200],
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={iconName}
                      size={16}
                      color={selected ? color.fg : Colors.gray[500]}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: selected ? color.fg : Colors.gray[700] },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Title */}
            <Text style={styles.sectionLabel}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Short summary"
              placeholderTextColor={Colors.gray[400]}
              style={styles.input}
              returnKeyType="next"
            />

            {/* Body */}
            <Text style={styles.sectionLabel}>Notes</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Add details (tap mic on your keyboard to dictate)…"
              placeholderTextColor={Colors.gray[400]}
              style={[styles.input, styles.textArea]}
              multiline
              textAlignVertical="top"
            />

            {/* Photos */}
            <Text style={styles.sectionLabel}>Photos</Text>
            <View style={styles.photoActionsRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.7}>
                <Ionicons name="camera" size={18} color={Colors.white} />
                <Text style={styles.photoBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoBtnAlt}
                onPress={pickFromLibrary}
                activeOpacity={0.7}
              >
                <Ionicons name="images" size={18} color={Colors.primary[700]} />
                <Text style={styles.photoBtnAltText}>Add from Gallery</Text>
              </TouchableOpacity>
            </View>

            {photos.length > 0 && (
              <View style={styles.thumbGrid}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={styles.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} />
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => removePhoto(i)}
                    >
                      <Ionicons name="close" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {submitting && (
          <View style={styles.submittingBanner}>
            <ActivityIndicator color={Colors.primary[600]} />
            <Text style={styles.submittingText}>Saving entry…</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Colors.gray[900] },
  headerBtn: { fontSize: 15, color: Colors.gray[600] },
  headerBtnPrimary: { color: Colors.primary[600], fontWeight: "600" },
  headerBtnDisabled: { opacity: 0.4 },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.gray[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  typeRow: { paddingVertical: 4, gap: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  typeChipText: { fontSize: 13, fontWeight: "500" },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.gray[900],
  },
  textArea: { minHeight: 120 },
  photoActionsRow: { flexDirection: "row", gap: 8 },
  photoBtn: {
    flex: 1,
    backgroundColor: Colors.primary[600],
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoBtnText: { color: Colors.white, fontSize: 14, fontWeight: "600" },
  photoBtnAlt: {
    flex: 1,
    backgroundColor: Colors.primary[50],
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoBtnAltText: { color: Colors.primary[700], fontSize: 14, fontWeight: "600" },
  thumbGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumbWrap: { width: 80, height: 80, borderRadius: 8, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  submittingBanner: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  submittingText: { color: Colors.gray[700], fontSize: 14 },
});
