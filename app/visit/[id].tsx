import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocation } from "../../src/hooks/useLocation";
import { useNetwork } from "../../src/providers/NetworkProvider";
import { enqueueAction, enqueuePhotoUpload } from "../../src/lib/offline-db";
import { DynamicForm } from "../../src/components/DynamicForm";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { StatusBadge } from "../../src/components/StatusBadge";
import { Colors } from "../../src/constants/theme";
import {
  ServiceOrderFormSchema,
  type ServiceOrderForm,
  type Visit,
  type Jobsite,
  type Equipment,
} from "../../src/types/database";

// ============================================================
// Visit Step tabs
// ============================================================
const STEPS = [
  { key: "arrive", label: "Arrive", icon: "location" },
  { key: "fields", label: "Fields", icon: "document-text" },
  { key: "photos", label: "Photos", icon: "camera" },
  { key: "notes", label: "Notes", icon: "create" },
  { key: "order", label: "Order", icon: "build" },
  { key: "depart", label: "Depart", icon: "flag" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getCurrentLocation, getDistanceMeters } = useLocation();
  const { isConnected, triggerSync } = useNetwork();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [jobsite, setJobsite] = useState<Jobsite | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [currentStep, setCurrentStep] = useState<StepKey>("arrive");
  const [loading, setLoading] = useState(true);
  const [arriving, setArriving] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [arriveTime, setArriveTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("0:00");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Notes
  const [notes, setNotes] = useState("");

  // Photos
  const [photos, setPhotos] = useState<
    Array<{ uri: string; caption: string }>
  >([]);

  // Service order form
  const orderForm = useForm<ServiceOrderForm>({
    resolver: zodResolver(ServiceOrderFormSchema) as never,
    defaultValues: { urgency: "medium" },
  });
  const [showOrderForm, setShowOrderForm] = useState(false);

  // ============================================================
  // Load visit data
  // ============================================================
  useEffect(() => {
    loadVisitData();
  }, [id]);

  const loadVisitData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: visitData } = await supabase
        .from("visits")
        .select("*")
        .eq("id", id)
        .single();

      if (visitData) {
        const v = visitData as Visit;
        setVisit(v);
        setNotes(v.notes ?? "");

        if (v.arrived_at) {
          setArriveTime(new Date(v.arrived_at));
          setCurrentStep("fields");
        }
        if (v.status === "completed") {
          setCurrentStep("depart");
        }

        const { data: jobsiteData } = await supabase
          .from("jobsites")
          .select("*")
          .eq("id", v.jobsite_id)
          .single();

        if (jobsiteData) setJobsite(jobsiteData as Jobsite);

        const { data: equipData } = await supabase
          .from("equipment")
          .select("*")
          .eq("jobsite_id", v.jobsite_id);

        if (equipData) setEquipment(equipData as Equipment[]);
      }
    } catch {
      Alert.alert("Error", "Failed to load visit data");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Timer
  // ============================================================
  useEffect(() => {
    if (arriveTime) {
      const updateTimer = () => {
        const diff = Date.now() - arriveTime.getTime();
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setElapsedTime(`${mins}:${secs.toString().padStart(2, "0")}`);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [arriveTime]);

  // ============================================================
  // Arrive handler
  // ============================================================
  const handleArrive = async () => {
    setArriving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const location = await getCurrentLocation();
    const now = new Date();

    let distanceMeters: number | null = null;
    let flagged = false;

    if (location && jobsite?.lat && jobsite?.lng) {
      distanceMeters = getDistanceMeters(
        location.latitude,
        location.longitude,
        jobsite.lat,
        jobsite.lng
      );
      flagged = distanceMeters > (visit?.geofence_radius_meters ?? 150);
    }

    const updates: Partial<Visit> = {
      status: "in_progress",
      arrived_at: now.toISOString(),
      arrived_lat: location?.latitude ?? null,
      arrived_lng: location?.longitude ?? null,
      geofence_verified: !flagged,
    };

    if (flagged) {
      Alert.alert(
        "Distance Warning",
        `You are ${Math.round(distanceMeters!)}m from the jobsite. Your location has been logged.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setArriving(false) },
          { text: "Continue", onPress: () => persistArrival(updates, now) },
        ]
      );
      return;
    }

    await persistArrival(updates, now);
  };

  const persistArrival = async (updates: Partial<Visit>, now: Date) => {
    try {
      if (isConnected) {
        await supabase.from("visits").update(updates).eq("id", id);
      } else {
        await enqueueAction("visits", "update", id!, { ...updates, id });
      }

      setVisit((prev) => (prev ? { ...prev, ...updates } : prev));
      setArriveTime(now);
      setCurrentStep("fields");
    } catch {
      Alert.alert("Error", "Failed to record arrival");
    } finally {
      setArriving(false);
    }
  };

  // ============================================================
  // Photo handler
  // ============================================================
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const location = await getCurrentLocation();

      setPhotos((prev) => [...prev, { uri: asset.uri, caption: "" }]);

      await enqueuePhotoUpload({
        localUri: asset.uri,
        entityType: "visit",
        entityId: id!,
        lat: location?.latitude,
        lng: location?.longitude,
        takenAt: new Date().toISOString(),
      });
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Photo library permission is required");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      const location = await getCurrentLocation();
      for (const asset of result.assets) {
        setPhotos((prev) => [...prev, { uri: asset.uri, caption: "" }]);

        await enqueuePhotoUpload({
          localUri: asset.uri,
          entityType: "visit",
          entityId: id!,
          lat: location?.latitude,
          lng: location?.longitude,
          takenAt: new Date().toISOString(),
        });
      }
    }
  };

  // ============================================================
  // Submit service order
  // ============================================================
  const submitServiceOrder = async (data: ServiceOrderForm) => {
    try {
      const payload = {
        visit_id: id!,
        jobsite_id: visit!.jobsite_id,
        org_id: visit!.org_id,
        requested_by: user!.id,
        title: data.title,
        description: data.description ?? null,
        urgency: data.urgency,
        estimated_cost: data.estimated_cost ?? null,
        status: "pending" as const,
      };

      if (isConnected) {
        await supabase.from("service_orders").insert(payload);
      } else {
        await enqueueAction(
          "service_orders",
          "insert",
          crypto.randomUUID?.() ?? Date.now().toString(),
          payload
        );
      }

      Alert.alert("Submitted", "Service order submitted to the office");
      setShowOrderForm(false);
      orderForm.reset();
    } catch {
      Alert.alert("Error", "Failed to submit service order");
    }
  };

  // ============================================================
  // Depart handler
  // ============================================================
  const handleDepart = async () => {
    setDeparting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const location = await getCurrentLocation();
    const now = new Date();

    const updates: Partial<Visit> = {
      status: "completed",
      departed_at: now.toISOString(),
      departed_lat: location?.latitude ?? null,
      departed_lng: location?.longitude ?? null,
      notes: notes || null,
    };

    try {
      if (isConnected) {
        await supabase.from("visits").update(updates).eq("id", id);
      } else {
        await enqueueAction("visits", "update", id!, { ...updates, id });
      }

      setVisit((prev) => (prev ? { ...prev, ...updates } : prev));
      await triggerSync();

      Alert.alert("Visit Complete", "Visit has been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to complete visit");
    } finally {
      setDeparting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert("Skip Visit", "Mark this visit as skipped?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Skip",
        style: "destructive",
        onPress: async () => {
          const updates = { status: "skipped" as const, notes: notes || null };
          if (isConnected) {
            await supabase.from("visits").update(updates).eq("id", id);
          } else {
            await enqueueAction("visits", "update", id!, { ...updates, id });
          }
          router.back();
        },
      },
    ]);
  };

  // ============================================================
  // Render
  // ============================================================
  if (loading || !visit) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading visit...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {jobsite?.name ?? "Visit"}
            </Text>
            <View style={styles.headerMeta}>
              <StatusBadge status={visit.status} />
              {arriveTime && (
                <Text style={styles.timerText}>{elapsedTime}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleSkip}>
            <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Step tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stepTabBar}
          contentContainerStyle={styles.stepTabContent}
        >
          {STEPS.map((step) => (
            <TouchableOpacity
              key={step.key}
              onPress={() => setCurrentStep(step.key)}
              style={[
                styles.stepTab,
                currentStep === step.key && styles.stepTabActive,
              ]}
            >
              <Ionicons
                name={step.icon as never}
                size={16}
                color={
                  currentStep === step.key ? "#6366F1" : "#9CA3AF"
                }
              />
              <Text
                style={[
                  styles.stepTabText,
                  currentStep === step.key && styles.stepTabTextActive,
                ]}
              >
                {step.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Step content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {/* ARRIVE STEP */}
          {currentStep === "arrive" && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>Record Arrival</Text>
              {jobsite && (
                <View style={styles.jobsiteInfo}>
                  <Text style={styles.jobsiteName}>{jobsite.name}</Text>
                  <Text style={styles.jobsiteAddress}>
                    {jobsite.address_line1}, {jobsite.city} {jobsite.state} {jobsite.zip}
                  </Text>
                  {jobsite.access_notes && (
                    <Text style={styles.accessNotes}>{jobsite.access_notes}</Text>
                  )}
                </View>
              )}
              {visit.arrived_at ? (
                <View style={styles.arrivedBanner}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={styles.arrivedText}>
                    Arrived at {new Date(visit.arrived_at).toLocaleTimeString()}
                  </Text>
                </View>
              ) : (
                <Button
                  title={arriving ? "Recording..." : "I Have Arrived"}
                  onPress={handleArrive}
                  disabled={arriving}
                  haptic
                />
              )}
            </Card>
          )}

          {/* DYNAMIC FIELDS STEP */}
          {currentStep === "fields" && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>Service Fields</Text>
              <DynamicForm
                entityType="visit"
                entityId={id!}
                isConnected={isConnected}
                readOnly={visit.status === "completed"}
                onSaved={() => Alert.alert("Saved", "Field data saved")}
              />
            </Card>
          )}

          {/* PHOTOS STEP */}
          {currentStep === "photos" && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>Photos</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color="#6366F1" />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery}>
                  <Ionicons name="images" size={24} color="#6366F1" />
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.photoGrid}>
                {photos.map((photo, i) => (
                  <Image key={i} source={{ uri: photo.uri }} style={styles.photoThumb} />
                ))}
                {photos.length === 0 && (
                  <Text style={styles.emptyText}>No photos yet</Text>
                )}
              </View>
            </Card>
          )}

          {/* NOTES STEP */}
          {currentStep === "notes" && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>Service Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Enter any notes about this visit..."
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={visit.status !== "completed"}
              />
              {visit.status !== "completed" && (
                <Button
                  title="Save Notes"
                  onPress={async () => {
                    if (isConnected) {
                      await supabase
                        .from("visits")
                        .update({ notes })
                        .eq("id", id);
                    } else {
                      await enqueueAction("visits", "update", id!, {
                        notes,
                        id,
                      });
                    }
                    Alert.alert("Saved", "Notes saved");
                  }}
                  size="sm"
                />
              )}
            </Card>
          )}

          {/* SERVICE ORDER STEP */}
          {currentStep === "order" && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>Service Order</Text>
              <Text style={styles.stepSubtitle}>
                Submit a service order to the office for follow-up work
              </Text>
              {!showOrderForm ? (
                <Button
                  title="Create Service Order"
                  onPress={() => setShowOrderForm(true)}
                  variant="outline"
                />
              ) : (
                <View style={styles.formSection}>
                  <TextInput
                    style={styles.input}
                    placeholder="Title *"
                    onChangeText={(v) => orderForm.setValue("title", v)}
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description"
                    multiline
                    numberOfLines={3}
                    onChangeText={(v) => orderForm.setValue("description", v)}
                  />
                  <View style={styles.urgencyRow}>
                    {(["low", "medium", "high", "emergency"] as const).map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.urgencyChip,
                          orderForm.watch("urgency") === level && styles.urgencyChipActive,
                        ]}
                        onPress={() => orderForm.setValue("urgency", level)}
                      >
                        <Text
                          style={[
                            styles.urgencyChipText,
                            orderForm.watch("urgency") === level && styles.urgencyChipTextActive,
                          ]}
                        >
                          {level}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Estimated Cost"
                    keyboardType="decimal-pad"
                    onChangeText={(v) =>
                      orderForm.setValue("estimated_cost", parseFloat(v) || undefined)
                    }
                  />
                  <View style={styles.formActions}>
                    <Button
                      title="Cancel"
                      onPress={() => setShowOrderForm(false)}
                      variant="outline"
                      size="sm"
                    />
                    <Button
                      title="Submit"
                      onPress={orderForm.handleSubmit(submitServiceOrder)}
                      size="sm"
                    />
                  </View>
                </View>
              )}
            </Card>
          )}

          {/* DEPART STEP */}
          {currentStep === "depart" && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>Complete Visit</Text>
              {visit.status === "completed" ? (
                <View style={styles.arrivedBanner}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={styles.arrivedText}>Visit completed</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.stepSubtitle}>
                    {arriveTime
                      ? `Time on site: ${elapsedTime}`
                      : "You have not yet arrived at this location"}
                  </Text>
                  <Button
                    title={departing ? "Completing..." : "Complete & Depart"}
                    onPress={handleDepart}
                    disabled={departing || !arriveTime}
                    haptic
                  />
                </>
              )}
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#6B7280" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 12,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  timerText: { fontSize: 13, fontWeight: "600", color: "#6366F1" },
  stepTabBar: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  stepTabContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  stepTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  stepTabActive: { backgroundColor: "#EEF2FF" },
  stepTabText: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
  stepTabTextActive: { color: "#6366F1", fontWeight: "600" },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 100 },
  stepCard: { marginBottom: 16 },
  stepTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: "#6B7280", marginBottom: 16 },
  jobsiteInfo: { marginBottom: 16 },
  jobsiteName: { fontSize: 16, fontWeight: "600", color: "#374151" },
  jobsiteAddress: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  accessNotes: {
    fontSize: 13,
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  arrivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 8,
  },
  arrivedText: { fontSize: 15, fontWeight: "600", color: "#065F46" },
  photoActions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  photoButton: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  photoButtonText: { fontSize: 13, color: "#6366F1", fontWeight: "600" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  emptyText: { fontSize: 14, color: "#9CA3AF", fontStyle: "italic" },
  notesInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#111827",
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  formSection: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  textArea: { height: 80, textAlignVertical: "top" },
  urgencyRow: { flexDirection: "row", gap: 8 },
  urgencyChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
  },
  urgencyChipActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  urgencyChipText: { fontSize: 12, color: "#6B7280", textTransform: "capitalize" },
  urgencyChipTextActive: { color: "#FFFFFF", fontWeight: "600" },
  formActions: { flexDirection: "row", gap: 8 },
});
