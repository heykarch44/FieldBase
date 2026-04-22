import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../constants/theme";
import { Card } from "./Card";
import { useTimeClock, type ClockSiteInfo } from "../hooks/useTimeClock";

interface TimeClockCardProps {
  jobsiteId: string;
  siteLat: number | null;
  siteLng: number | null;
  radius?: number | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatElapsed(fromIso: string, nowMs: number): string {
  const elapsed = nowMs - new Date(fromIso).getTime();
  if (elapsed < 0) return "0m";
  const mins = Math.floor(elapsed / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function TimeClockCard({
  jobsiteId,
  siteLat,
  siteLng,
  radius,
}: TimeClockCardProps) {
  const {
    events,
    isClockedIn,
    clockedInSince,
    clockIn,
    clockOut,
    loading,
  } = useTimeClock(jobsiteId);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<"in" | "out">("in");
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [photoExt, setPhotoExt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tick, setTick] = useState(() => Date.now());
  React.useEffect(() => {
    if (!isClockedIn) return;
    const iv = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, [isClockedIn]);

  const siteInfo = useMemo<ClockSiteInfo>(
    () => ({ jobsiteId, siteLat, siteLng, radius: radius ?? 100 }),
    [jobsiteId, siteLat, siteLng, radius]
  );

  const todayEvents = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return events.filter((e) => new Date(e.occurred_at) >= start);
  }, [events]);

  const openClockModal = useCallback((kind: "in" | "out") => {
    setModalKind(kind);
    setNote("");
    setPhotoUri(null);
    setPhotoMime(null);
    setPhotoExt(null);
    setModalOpen(true);
  }, []);

  const pickPhoto = useCallback(async () => {
    Alert.alert("Add Photo", "Choose a source", [
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission required", "Enable camera access in Settings.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
          });
          if (result.canceled || !result.assets?.[0]) return;
          const a = result.assets[0];
          setPhotoUri(a.uri);
          setPhotoMime(a.mimeType ?? "image/jpeg");
          setPhotoExt((a.fileName?.split(".").pop() ?? "jpg").toLowerCase());
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission required", "Enable library access in Settings.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          });
          if (result.canceled || !result.assets?.[0]) return;
          const a = result.assets[0];
          setPhotoUri(a.uri);
          setPhotoMime(a.mimeType ?? "image/jpeg");
          setPhotoExt((a.fileName?.split(".").pop() ?? "jpg").toLowerCase());
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    const params = {
      site: siteInfo,
      note: note.trim() || null,
      photoUri,
      photoMime,
      photoExt,
    };
    const result =
      modalKind === "in" ? await clockIn(params) : await clockOut(params);
    setSubmitting(false);
    if (result.error) {
      Alert.alert("Couldn't save", result.error);
      return;
    }
    setModalOpen(false);
  }, [modalKind, note, photoUri, photoMime, photoExt, siteInfo, clockIn, clockOut]);

  if (loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary[600]} />
          <Text style={styles.loadingText}>Loading time clock…</Text>
        </View>
      </Card>
    );
  }

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="time" size={18} color={Colors.primary[600]} />
          <Text style={styles.headerText}>Time Clock</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isClockedIn ? "#dcfce7" : Colors.gray[100],
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: isClockedIn ? "#166534" : Colors.gray[600] },
              ]}
            >
              {isClockedIn ? "Clocked In" : "Clocked Out"}
            </Text>
          </View>
        </View>

        {isClockedIn && clockedInSince && (
          <Text style={styles.elapsedText}>
            In for {formatElapsed(clockedInSince, tick)} · since {formatTime(clockedInSince)}
          </Text>
        )}

        {isClockedIn ? (
          <TouchableOpacity
            style={[styles.bigBtn, styles.btnOut]}
            onPress={() => openClockModal("out")}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={22} color="white" />
            <Text style={styles.bigBtnText}>Clock Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bigBtn, styles.btnIn]}
            onPress={() => openClockModal("in")}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={22} color="white" />
            <Text style={styles.bigBtnText}>Clock In</Text>
          </TouchableOpacity>
        )}

        {todayEvents.length > 0 && (
          <View style={styles.todayBlock}>
            <Text style={styles.todayLabel}>Today</Text>
            {todayEvents.slice(0, 5).map((ev) => (
              <View key={ev.id} style={styles.eventRow}>
                <Ionicons
                  name={
                    ev.event_type === "clock_in" ? "arrow-forward-circle" : "arrow-back-circle"
                  }
                  size={14}
                  color={
                    ev.event_type === "clock_in"
                      ? Colors.success
                      : Colors.gray[500]
                  }
                />
                <Text style={styles.eventText}>
                  {ev.event_type === "clock_in" ? "In" : "Out"} · {formatTime(ev.occurred_at)}
                </Text>
                <Text style={styles.eventMeta}>
                  {ev.source === "auto_geofence" ? "Auto" : "Manual"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalKind === "in" ? "Clock In" : "Clock Out"}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={Colors.gray[600]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What you're doing…"
              placeholderTextColor={Colors.gray[400]}
              multiline
              style={styles.textArea}
              maxLength={500}
            />

            <Text style={styles.fieldLabel}>Photo (optional)</Text>
            {photoUri ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => {
                    setPhotoUri(null);
                    setPhotoMime(null);
                    setPhotoExt(null);
                  }}
                >
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={pickPhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={18} color={Colors.primary[700]} />
                <Text style={styles.addPhotoText}>Add photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                modalKind === "in" ? styles.btnIn : styles.btnOut,
                submitting && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name={modalKind === "in" ? "log-in-outline" : "log-out-outline"}
                    size={20}
                    color="white"
                  />
                  <Text style={styles.bigBtnText}>
                    {modalKind === "in" ? "Confirm Clock In" : "Confirm Clock Out"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    marginHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gray[700],
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  elapsedText: {
    fontSize: 13,
    color: Colors.primary[700],
    marginTop: 6,
    fontWeight: "600",
  },
  bigBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnIn: {
    backgroundColor: Colors.primary[600],
  },
  btnOut: {
    backgroundColor: Colors.primary[700],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  bigBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  todayBlock: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  todayLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Colors.gray[500],
    marginBottom: 6,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
  },
  eventText: {
    fontSize: 13,
    color: Colors.gray[700],
    flex: 1,
  },
  eventMeta: {
    fontSize: 11,
    color: Colors.gray[400],
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.gray[500],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Colors.gray[500],
    marginBottom: 6,
    marginTop: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 70,
    fontSize: 14,
    color: "#111827",
    textAlignVertical: "top",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  addPhotoText: {
    color: Colors.primary[700],
    fontSize: 13,
    fontWeight: "600",
  },
  photoWrap: {
    alignSelf: "flex-start",
    position: "relative",
  },
  photoPreview: {
    width: 110,
    height: 110,
    borderRadius: 12,
    backgroundColor: Colors.gray[100],
  },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
});
