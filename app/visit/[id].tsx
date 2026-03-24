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
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocation } from "../../src/hooks/useLocation";
import { useNetwork } from "../../src/providers/NetworkProvider";
import { enqueueAction, enqueuePhotoUpload } from "../../src/lib/offline-db";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { FormInput } from "../../src/components/FormInput";
import { StatusBadge } from "../../src/components/StatusBadge";
import { Colors } from "../../src/constants/theme";
import {
  SERVICE_CHECKLIST_ITEMS,
  CHEMICAL_NAMES,
  CHEMICAL_UNITS,
  REPAIR_CATEGORIES,
  URGENCY_LEVELS,
  PHOTO_TYPES,
} from "../../src/constants/checklist";
import {
  ChemicalReadingsFormSchema,
  RepairRequestFormSchema,
  type ChemicalReadingsForm,
  type RepairRequestForm,
  type ServiceVisit,
  type Customer,
  type EquipmentInventory,
  type ChemicalUnit,
  type PhotoType,
} from "../../src/types/database";

// ============================================================
// Form schema for chemical additions
// ============================================================
const ChemAddSchema = z.object({
  chemicals: z.array(
    z.object({
      chemical_name: z.string(),
      amount: z.string(),
      unit: z.string(),
    })
  ),
});

type ChemAddForm = z.infer<typeof ChemAddSchema>;

// ============================================================
// Visit Step tabs
// ============================================================
const STEPS = [
  { key: "arrive", label: "Arrive", icon: "location" },
  { key: "checklist", label: "Checklist", icon: "checkmark-circle" },
  { key: "chemicals", label: "Chemicals", icon: "flask" },
  { key: "photos", label: "Photos", icon: "camera" },
  { key: "notes", label: "Notes", icon: "create" },
  { key: "repair", label: "Repair", icon: "build" },
  { key: "depart", label: "Depart", icon: "flag" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getCurrentLocation, getDistanceMeters } = useLocation();
  const { isConnected, triggerSync } = useNetwork();

  const [visit, setVisit] = useState<ServiceVisit | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [equipment, setEquipment] = useState<EquipmentInventory[]>([]);
  const [currentStep, setCurrentStep] = useState<StepKey>("arrive");
  const [loading, setLoading] = useState(true);
  const [arriving, setArriving] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [arriveTime, setArriveTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("0:00");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Checklist state
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Chemical readings form
  const readingsForm = useForm<ChemicalReadingsForm>({
    resolver: zodResolver(ChemicalReadingsFormSchema) as never,
  });

  // Chemical additions form
  const chemAddForm = useForm<ChemAddForm>({
    defaultValues: { chemicals: [] },
  });
  const { fields, append, remove } = useFieldArray({
    control: chemAddForm.control,
    name: "chemicals",
  });

  // Notes
  const [notes, setNotes] = useState("");

  // Photos
  const [photos, setPhotos] = useState<
    Array<{ uri: string; type: PhotoType; caption: string }>
  >([]);
  const [selectedPhotoType, setSelectedPhotoType] = useState<PhotoType>("after");

  // Repair request form
  const repairForm = useForm<RepairRequestForm>({
    resolver: zodResolver(RepairRequestFormSchema) as never,
    defaultValues: { urgency: "medium", category: "other" },
  });
  const [showRepairForm, setShowRepairForm] = useState(false);

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
        .from("service_visits")
        .select("*")
        .eq("id", id)
        .single();

      if (visitData) {
        const v = visitData as ServiceVisit;
        setVisit(v);
        setNotes(v.notes ?? "");

        if (v.arrived_at) {
          setArriveTime(new Date(v.arrived_at));
          setCurrentStep("checklist");
        }
        if (v.status === "completed") {
          setCurrentStep("depart");
        }

        // Load checklist from visit data if available
        const existingChecklist = (v as Record<string, unknown>).checklist;
        if (existingChecklist && typeof existingChecklist === "object") {
          setChecklist(existingChecklist as Record<string, boolean>);
        }

        const { data: custData } = await supabase
          .from("customers")
          .select("*")
          .eq("id", v.customer_id)
          .single();

        if (custData) setCustomer(custData as Customer);

        const { data: equipData } = await supabase
          .from("equipment_inventory")
          .select("*")
          .eq("customer_id", v.customer_id);

        if (equipData) setEquipment(equipData as EquipmentInventory[]);
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

    if (location && customer?.lat && customer?.lng) {
      distanceMeters = getDistanceMeters(
        location.latitude,
        location.longitude,
        customer.lat,
        customer.lng
      );
      flagged = distanceMeters > 200;
    }

    const updates: Partial<ServiceVisit> = {
      status: "in_progress",
      arrived_at: now.toISOString(),
      arrived_lat: location?.latitude ?? null,
      arrived_lng: location?.longitude ?? null,
      arrived_distance_meters: distanceMeters,
      geofence_flagged: flagged,
    };

    if (flagged) {
      Alert.alert(
        "Distance Warning",
        `You are ${Math.round(distanceMeters!)}m from the customer location. Your location has been logged.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setArriving(false) },
          { text: "Continue", onPress: () => persistArrival(updates, now) },
        ]
      );
      return;
    }

    await persistArrival(updates, now);
  };

  const persistArrival = async (updates: Partial<ServiceVisit>, now: Date) => {
    try {
      if (isConnected) {
        await supabase
          .from("service_visits")
          .update(updates)
          .eq("id", id);
      } else {
        await enqueueAction("service_visits", "update", id!, {
          ...updates,
          id,
        });
      }

      setVisit((prev) => (prev ? { ...prev, ...updates } : prev));
      setArriveTime(now);
      setCurrentStep("checklist");
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

      const newPhoto = {
        uri: asset.uri,
        type: selectedPhotoType,
        caption: "",
      };
      setPhotos((prev) => [...prev, newPhoto]);

      // Queue for upload
      await enqueuePhotoUpload({
        localUri: asset.uri,
        visitId: id!,
        photoType: selectedPhotoType,
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
        const newPhoto = {
          uri: asset.uri,
          type: selectedPhotoType,
          caption: "",
        };
        setPhotos((prev) => [...prev, newPhoto]);

        await enqueuePhotoUpload({
          localUri: asset.uri,
          visitId: id!,
          photoType: selectedPhotoType,
          lat: location?.latitude,
          lng: location?.longitude,
          takenAt: new Date().toISOString(),
        });
      }
    }
  };

  // ============================================================
  // Save chemical readings
  // ============================================================
  const saveChemicals = async () => {
    const readings = readingsForm.getValues();
    const additions = chemAddForm.getValues().chemicals;

    try {
      // Save readings as a chemical_log entry
      const readingPayload = {
        visit_id: id!,
        ...readings,
        logged_at: new Date().toISOString(),
      };

      if (isConnected) {
        await supabase.from("chemical_logs").insert(readingPayload);
      } else {
        await enqueueAction("chemical_logs", "insert", crypto.randomUUID?.() ?? Date.now().toString(), readingPayload);
      }

      // Save each chemical addition
      for (const chem of additions) {
        if (!chem.chemical_name || !chem.amount) continue;
        const chemPayload = {
          visit_id: id!,
          chemical_name: chem.chemical_name,
          amount: parseFloat(chem.amount),
          unit: chem.unit as ChemicalUnit,
          logged_at: new Date().toISOString(),
        };

        if (isConnected) {
          await supabase.from("chemical_logs").insert(chemPayload);
        } else {
          await enqueueAction("chemical_logs", "insert", crypto.randomUUID?.() ?? Date.now().toString(), chemPayload);
        }
      }

      Alert.alert("Saved", "Chemical data saved successfully");
    } catch {
      Alert.alert("Error", "Failed to save chemical data");
    }
  };

  // ============================================================
  // Submit repair request
  // ============================================================
  const submitRepairRequest = async (data: RepairRequestForm) => {
    try {
      const payload = {
        visit_id: id!,
        customer_id: visit!.customer_id,
        requested_by: user!.id,
        category: data.category,
        description: data.description,
        urgency: data.urgency,
        estimated_cost: data.estimated_cost ?? null,
        status: "pending_review" as const,
        photos: photos.filter((p) => p.type === "issue").map((p) => p.uri),
      };

      if (isConnected) {
        await supabase.from("repair_requests").insert(payload);
      } else {
        await enqueueAction("repair_requests", "insert", crypto.randomUUID?.() ?? Date.now().toString(), payload);
      }

      Alert.alert("Submitted", "Repair request submitted to the office");
      setShowRepairForm(false);
      repairForm.reset();
    } catch {
      Alert.alert("Error", "Failed to submit repair request");
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

    const updates: Partial<ServiceVisit> = {
      status: "completed",
      departed_at: now.toISOString(),
      departed_lat: location?.latitude ?? null,
      departed_lng: location?.longitude ?? null,
      notes: notes || null,
    };

    try {
      if (isConnected) {
        await supabase
          .from("service_visits")
          .update(updates)
          .eq("id", id);

        // Save checklist
        await supabase
          .from("service_visits")
          .update({ checklist } as Record<string, unknown>)
          .eq("id", id);
      } else {
        await enqueueAction("service_visits", "update", id!, {
          ...updates,
          checklist,
          id,
        });
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
            await supabase.from("service_visits").update(updates).eq("id", id);
          } else {
            await enqueueAction("service_visits", "update", id!, {
              ...updates,
              id,
            });
          }
          router.back();
        },
      },
    ]);
  };

  // ============================================================
  // Render
  // ============================================================
  if (loading || !visit || !customer) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const isArrived = visit.status === "in_progress" || visit.status === "completed";
  const isCompleted = visit.status === "completed";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex1}
    >
      <SafeAreaView style={styles.flex1} edges={["top"]}>
        <View style={styles.screenContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <View style={styles.flex1}>
                <Text style={styles.headerTitle}>
                  {customer.first_name} {customer.last_name}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {customer.address_line1}, {customer.city}
                </Text>
              </View>
              <StatusBadge status={visit.status} size="md" />
            </View>

            {isArrived && (
              <View style={styles.timerRow}>
                <Ionicons name="timer-outline" size={18} color="white" />
                <Text style={styles.timerText}>
                  {elapsedTime}
                </Text>
              </View>
            )}
          </View>

          {/* Step Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScrollView}
            contentContainerStyle={{ paddingHorizontal: 8 }}
          >
            {STEPS.map((step) => {
              const isActive = currentStep === step.key;
              return (
                <TouchableOpacity
                  key={step.key}
                  onPress={() => {
                    if (step.key === "arrive" || isArrived) setCurrentStep(step.key);
                  }}
                  style={[
                    styles.tabItem,
                    isActive ? styles.tabItemActive : styles.tabItemInactive,
                  ]}
                >
                  <Ionicons
                    name={step.icon as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={isActive ? Colors.aqua[600] : Colors.gray[400]}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                    ]}
                  >
                    {step.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Step Content */}
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.stepContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* ==================== ARRIVE ==================== */}
            {currentStep === "arrive" && (
              <View>
                <Card style={styles.cardMarginBottom}>
                  <Text style={styles.sectionTitle}>
                    Customer Info
                  </Text>
                  {customer.gate_code && (
                    <View style={styles.infoRow}>
                      <Ionicons name="key" size={18} color={Colors.amber[600]} />
                      <Text style={styles.infoText}>
                        Gate Code: <Text style={styles.bold}>{customer.gate_code}</Text>
                      </Text>
                    </View>
                  )}
                  {customer.access_notes && (
                    <View style={[styles.infoRow, styles.alignStart]}>
                      <Ionicons
                        name="information-circle"
                        size={18}
                        color={Colors.aqua[600]}
                      />
                      <Text style={[styles.infoText, styles.flex1]}>
                        {customer.access_notes}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Ionicons name="water" size={18} color={Colors.aqua[600]} />
                    <Text style={[styles.infoText, styles.capitalize]}>
                      {customer.pool_type} pool
                      {customer.pool_volume_gallons
                        ? ` · ${customer.pool_volume_gallons.toLocaleString()} gal`
                        : ""}
                    </Text>
                  </View>

                  {equipment.length > 0 && (
                    <View style={styles.equipmentSection}>
                      <Text style={styles.equipmentLabel}>
                        Equipment
                      </Text>
                      {equipment.map((eq) => (
                        <View key={eq.id} style={styles.equipmentRow}>
                          <Ionicons
                            name="hardware-chip-outline"
                            size={14}
                            color={Colors.gray[500]}
                          />
                          <Text style={styles.equipmentText}>
                            {eq.brand} {eq.model} ({eq.equipment_type}) —{" "}
                            <Text
                              style={{
                                color:
                                  eq.condition === "good"
                                    ? Colors.success
                                    : eq.condition === "poor" ||
                                      eq.condition === "needs_replacement"
                                    ? Colors.error
                                    : Colors.amber[600],
                              }}
                            >
                              {eq.condition}
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>

                {!isArrived && (
                  <View style={styles.gap12}>
                    <Button
                      title="Arrive"
                      onPress={handleArrive}
                      loading={arriving}
                      size="lg"
                      haptic
                      icon={
                        <Ionicons name="location" size={20} color="white" />
                      }
                    />
                    <Button
                      title="Skip Visit"
                      onPress={handleSkip}
                      variant="outline"
                      size="sm"
                    />
                  </View>
                )}

                {isArrived && (
                  <View style={styles.arrivedBanner}>
                    <View style={styles.rowCenter}>
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={Colors.success}
                      />
                      <Text style={styles.arrivedText}>
                        Arrived at{" "}
                        {visit.arrived_at
                          ? new Date(visit.arrived_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ==================== CHECKLIST ==================== */}
            {currentStep === "checklist" && (
              <Card>
                <Text style={[styles.sectionTitle, styles.marginBottom16]}>
                  Service Checklist
                </Text>
                {SERVICE_CHECKLIST_ITEMS.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => {
                      if (isCompleted) return;
                      Haptics.selectionAsync();
                      setChecklist((prev) => ({
                        ...prev,
                        [item.key]: !prev[item.key],
                      }));
                    }}
                    style={styles.checklistItem}
                  >
                    <Ionicons
                      name={
                        checklist[item.key]
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={24}
                      color={
                        checklist[item.key] ? Colors.success : Colors.gray[300]
                      }
                    />
                    <Text
                      style={[
                        styles.checklistLabel,
                        checklist[item.key]
                          ? styles.checklistLabelDone
                          : styles.checklistLabelPending,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            {/* ==================== CHEMICALS ==================== */}
            {currentStep === "chemicals" && (
              <View>
                <Card style={styles.cardMarginBottom}>
                  <Text style={[styles.sectionTitle, styles.marginBottom16]}>
                    Water Test Readings
                  </Text>

                  <View style={[styles.rowGap12, styles.marginBottom8]}>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="ph_before"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="pH Before"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)}
                            keyboardType="decimal-pad"
                            placeholder="7.2"
                          />
                        )}
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="ph_after"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="pH After"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)}
                            keyboardType="decimal-pad"
                            placeholder="7.4"
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View style={[styles.rowGap12, styles.marginBottom8]}>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="chlorine_before"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="Chlorine Before"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)}
                            keyboardType="decimal-pad"
                            placeholder="ppm"
                            suffix="ppm"
                          />
                        )}
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="chlorine_after"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="Chlorine After"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)}
                            keyboardType="decimal-pad"
                            placeholder="ppm"
                            suffix="ppm"
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View style={[styles.rowGap12, styles.marginBottom8]}>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="alkalinity_before"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="Alkalinity Before"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                            keyboardType="number-pad"
                            suffix="ppm"
                          />
                        )}
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="alkalinity_after"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="Alkalinity After"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                            keyboardType="number-pad"
                            suffix="ppm"
                          />
                        )}
                      />
                    </View>
                  </View>

                  <View style={[styles.rowGap12, styles.marginBottom8]}>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="cya_before"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="CYA Before"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                            keyboardType="number-pad"
                            suffix="ppm"
                          />
                        )}
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Controller
                        control={readingsForm.control}
                        name="cya_after"
                        render={({ field: { onChange, value } }) => (
                          <FormInput
                            label="CYA After"
                            value={value?.toString() ?? ""}
                            onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                            keyboardType="number-pad"
                            suffix="ppm"
                          />
                        )}
                      />
                    </View>
                  </View>

                  <Controller
                    control={readingsForm.control}
                    name="calcium_hardness"
                    render={({ field: { onChange, value } }) => (
                      <FormInput
                        label="Calcium Hardness"
                        value={value?.toString() ?? ""}
                        onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                        keyboardType="number-pad"
                        suffix="ppm"
                      />
                    )}
                  />

                  {customer.pool_type === "saltwater" && (
                    <Controller
                      control={readingsForm.control}
                      name="salt_level"
                      render={({ field: { onChange, value } }) => (
                        <FormInput
                          label="Salt Level"
                          value={value?.toString() ?? ""}
                          onChangeText={(t) => onChange(t ? parseInt(t, 10) : undefined)}
                          keyboardType="number-pad"
                          suffix="ppm"
                        />
                      )}
                    />
                  )}

                  <Controller
                    control={readingsForm.control}
                    name="water_temp"
                    render={({ field: { onChange, value } }) => (
                      <FormInput
                        label="Water Temperature"
                        value={value?.toString() ?? ""}
                        onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)}
                        keyboardType="decimal-pad"
                        suffix="°F"
                      />
                    )}
                  />
                </Card>

                {/* Chemicals Added */}
                <Card style={styles.cardMarginBottom}>
                  <View style={styles.chemHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      Chemicals Added
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        append({ chemical_name: "", amount: "", unit: "oz" })
                      }
                      style={styles.addChemButton}
                    >
                      <Text style={styles.addChemButtonText}>
                        + Add
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {fields.map((field, index) => (
                    <View
                      key={field.id}
                      style={styles.chemFieldRow}
                    >
                      <View style={styles.chemFieldHeader}>
                        <Text style={styles.chemFieldLabel}>
                          Chemical #{index + 1}
                        </Text>
                        <TouchableOpacity onPress={() => remove(index)}>
                          <Ionicons name="close-circle" size={20} color={Colors.error} />
                        </TouchableOpacity>
                      </View>

                      <Controller
                        control={chemAddForm.control}
                        name={`chemicals.${index}.chemical_name`}
                        render={({ field: { onChange, value } }) => (
                          <View style={styles.marginBottom8}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                            >
                              {CHEMICAL_NAMES.map((name) => (
                                <TouchableOpacity
                                  key={name}
                                  onPress={() => onChange(name)}
                                  style={[
                                    styles.chemNameChip,
                                    value === name
                                      ? styles.chemNameChipSelected
                                      : styles.chemNameChipUnselected,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.chemNameChipText,
                                      value === name
                                        ? styles.chemNameChipTextSelected
                                        : styles.chemNameChipTextUnselected,
                                    ]}
                                  >
                                    {name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      />

                      <View style={styles.rowGap8}>
                        <View style={styles.flex1}>
                          <Controller
                            control={chemAddForm.control}
                            name={`chemicals.${index}.amount`}
                            render={({ field: { onChange, value } }) => (
                              <FormInput
                                label="Amount"
                                value={value}
                                onChangeText={onChange}
                                keyboardType="decimal-pad"
                                placeholder="0.0"
                              />
                            )}
                          />
                        </View>
                        <View style={styles.flex1}>
                          <Controller
                            control={chemAddForm.control}
                            name={`chemicals.${index}.unit`}
                            render={({ field: { onChange, value } }) => (
                              <View>
                                <Text style={styles.unitLabel}>
                                  Unit
                                </Text>
                                <View style={styles.unitRow}>
                                  {CHEMICAL_UNITS.map((u) => (
                                    <TouchableOpacity
                                      key={u}
                                      onPress={() => onChange(u)}
                                      style={[
                                        styles.unitChip,
                                        value === u
                                          ? styles.unitChipSelected
                                          : styles.unitChipUnselected,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.unitChipText,
                                          value === u
                                            ? styles.unitChipTextSelected
                                            : styles.unitChipTextUnselected,
                                        ]}
                                      >
                                        {u}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            )}
                          />
                        </View>
                      </View>
                    </View>
                  ))}

                  {fields.length === 0 && (
                    <Text style={styles.emptyChemText}>
                      No chemicals added yet
                    </Text>
                  )}
                </Card>

                <Button title="Save Chemical Data" onPress={saveChemicals} />
              </View>
            )}

            {/* ==================== PHOTOS ==================== */}
            {currentStep === "photos" && (
              <View>
                <Card style={styles.cardMarginBottom}>
                  <Text style={[styles.sectionTitle, styles.marginBottom12]}>
                    Photo Category
                  </Text>
                  <View style={styles.photoTypeRow}>
                    {PHOTO_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setSelectedPhotoType(type)}
                        style={[
                          styles.photoTypeChip,
                          selectedPhotoType === type
                            ? styles.photoTypeChipSelected
                            : styles.photoTypeChipUnselected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.photoTypeChipText,
                            selectedPhotoType === type
                              ? styles.photoTypeChipTextSelected
                              : styles.photoTypeChipTextUnselected,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Card>

                <View style={[styles.rowGap12, styles.marginBottom16]}>
                  <View style={styles.flex1}>
                    <Button
                      title="Take Photo"
                      onPress={takePhoto}
                      icon={<Ionicons name="camera" size={20} color="white" />}
                    />
                  </View>
                  <View style={styles.flex1}>
                    <Button
                      title="Gallery"
                      onPress={pickFromGallery}
                      variant="outline"
                      icon={
                        <Ionicons name="images" size={20} color={Colors.aqua[600]} />
                      }
                    />
                  </View>
                </View>

                {photos.length > 0 ? (
                  <View style={styles.photoGrid}>
                    {photos.map((photo, index) => (
                      <View
                        key={index}
                        style={styles.photoThumb}
                      >
                        <Image
                          source={{ uri: photo.uri }}
                          style={styles.photoThumbImage}
                          resizeMode="cover"
                        />
                        <View style={styles.photoCaption}>
                          <Text style={styles.photoCaptionText}>
                            {photo.type}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Card>
                    <View style={styles.emptyPhotos}>
                      <Ionicons
                        name="camera-outline"
                        size={48}
                        color={Colors.gray[300]}
                      />
                      <Text style={styles.emptyPhotosText}>
                        No photos taken yet
                      </Text>
                    </View>
                  </Card>
                )}
              </View>
            )}

            {/* ==================== NOTES ==================== */}
            {currentStep === "notes" && (
              <Card>
                <Text style={[styles.sectionTitle, styles.marginBottom12]}>
                  Visit Notes
                </Text>
                <Text style={styles.notesHint}>
                  Customer requests, equipment observations, access issues, etc.
                </Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Enter notes..."
                  placeholderTextColor="#9ca3af"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                />
              </Card>
            )}

            {/* ==================== REPAIR ==================== */}
            {currentStep === "repair" && (
              <View>
                {!showRepairForm ? (
                  <Card>
                    <View style={styles.repairEmptyState}>
                      <Ionicons
                        name="build-outline"
                        size={48}
                        color={Colors.amber[600]}
                      />
                      <Text style={styles.repairEmptyTitle}>
                        Flag an Issue
                      </Text>
                      <Text style={styles.repairEmptySubtitle}>
                        Submit a repair request to the office for this property
                      </Text>
                      <Button
                        title="Create Repair Request"
                        onPress={() => setShowRepairForm(true)}
                        variant="outline"
                        icon={
                          <Ionicons
                            name="add-circle"
                            size={20}
                            color={Colors.aqua[600]}
                          />
                        }
                      />
                    </View>
                  </Card>
                ) : (
                  <Card>
                    <Text style={[styles.sectionTitle, styles.marginBottom16]}>
                      Repair Request
                    </Text>

                    {/* Category */}
                    <Text style={styles.fieldLabel}>
                      Category
                    </Text>
                    <Controller
                      control={repairForm.control}
                      name="category"
                      render={({ field: { onChange, value } }) => (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.marginBottom16}
                        >
                          {REPAIR_CATEGORIES.map((cat) => (
                            <TouchableOpacity
                              key={cat}
                              onPress={() => onChange(cat)}
                              style={[
                                styles.repairCatChip,
                                value === cat
                                  ? styles.repairCatChipSelected
                                  : styles.repairCatChipUnselected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.repairCatChipText,
                                  value === cat
                                    ? styles.repairCatChipTextSelected
                                    : styles.repairCatChipTextUnselected,
                                ]}
                              >
                                {cat.replace("_", " ")}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    />

                    {/* Description */}
                    <Controller
                      control={repairForm.control}
                      name="description"
                      render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <View style={styles.marginBottom16}>
                          <Text style={[styles.fieldLabel, styles.marginBottom4]}>
                            Description
                          </Text>
                          <TextInput
                            style={[
                              styles.descriptionInput,
                              error
                                ? styles.descriptionInputError
                                : styles.descriptionInputNormal,
                            ]}
                            placeholder="Describe the issue..."
                            placeholderTextColor="#9ca3af"
                            value={value}
                            onChangeText={onChange}
                            multiline
                            textAlignVertical="top"
                          />
                          {error && (
                            <Text style={styles.errorText}>
                              {error.message}
                            </Text>
                          )}
                        </View>
                      )}
                    />

                    {/* Urgency */}
                    <Text style={[styles.fieldLabel, styles.marginBottom8]}>
                      Urgency
                    </Text>
                    <Controller
                      control={repairForm.control}
                      name="urgency"
                      render={({ field: { onChange, value } }) => (
                        <View style={[styles.rowGap8, styles.marginBottom16]}>
                          {URGENCY_LEVELS.map((level) => {
                            const urgColors: Record<string, string> = {
                              low: "#6b7280",
                              medium: "#d97706",
                              high: "#dc2626",
                              emergency: "#7f1d1d",
                            };
                            return (
                              <TouchableOpacity
                                key={level}
                                onPress={() => onChange(level)}
                                style={[
                                  styles.urgencyChip,
                                  value === level
                                    ? { backgroundColor: urgColors[level], borderColor: "transparent" }
                                    : styles.urgencyChipUnselected,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.urgencyChipText,
                                    value === level
                                      ? styles.urgencyChipTextSelected
                                      : styles.urgencyChipTextUnselected,
                                  ]}
                                >
                                  {level}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    />

                    {/* Estimated Cost */}
                    <Controller
                      control={repairForm.control}
                      name="estimated_cost"
                      render={({ field: { onChange, value } }) => (
                        <FormInput
                          label="Estimated Cost (optional)"
                          value={value?.toString() ?? ""}
                          onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)}
                          keyboardType="decimal-pad"
                          placeholder="$0.00"
                        />
                      )}
                    />

                    <View style={[styles.rowGap12, styles.marginTop16]}>
                      <View style={styles.flex1}>
                        <Button
                          title="Cancel"
                          onPress={() => setShowRepairForm(false)}
                          variant="outline"
                        />
                      </View>
                      <View style={styles.flex1}>
                        <Button
                          title="Submit"
                          onPress={repairForm.handleSubmit(submitRepairRequest as never)}
                          icon={
                            <Ionicons name="send" size={16} color="white" />
                          }
                        />
                      </View>
                    </View>
                  </Card>
                )}
              </View>
            )}

            {/* ==================== DEPART ==================== */}
            {currentStep === "depart" && (
              <View>
                {/* Visit Summary */}
                <Card style={styles.cardMarginBottom}>
                  <Text style={[styles.sectionTitle, styles.marginBottom16]}>
                    Visit Summary
                  </Text>

                  <View style={styles.summaryRow}>
                    <Ionicons name="timer" size={18} color={Colors.aqua[600]} />
                    <Text style={styles.summaryText}>
                      Time on site: {elapsedTime}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={Colors.success}
                    />
                    <Text style={styles.summaryText}>
                      Checklist:{" "}
                      {
                        Object.values(checklist).filter(Boolean).length
                      }/{SERVICE_CHECKLIST_ITEMS.length} completed
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Ionicons
                      name="camera"
                      size={18}
                      color={Colors.aqua[600]}
                    />
                    <Text style={styles.summaryText}>
                      {photos.length} photo{photos.length !== 1 ? "s" : ""} taken
                    </Text>
                  </View>

                  {notes ? (
                    <View style={styles.notesSummary}>
                      <Text style={styles.notesSummaryLabel}>
                        Notes
                      </Text>
                      <Text style={styles.notesSummaryText}>{notes}</Text>
                    </View>
                  ) : null}
                </Card>

                {!isCompleted && (
                  <Button
                    title="Complete & Depart"
                    onPress={handleDepart}
                    loading={departing}
                    size="lg"
                    haptic
                    icon={<Ionicons name="flag" size={20} color="white" />}
                  />
                )}

                {isCompleted && (
                  <View style={styles.completedBanner}>
                    <View style={styles.rowCenter}>
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={Colors.success}
                      />
                      <Text style={styles.completedText}>
                        Visit completed
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#6b7280",
  },
  screenContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  // Header
  header: {
    backgroundColor: "#0891b2",
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#a5f3fc",
    fontSize: 14,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timerText: {
    color: "white",
    fontSize: 18,
    marginLeft: 8,
  },
  // Step Tabs
  tabsScrollView: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
    borderBottomWidth: 2,
  },
  tabItemActive: {
    borderBottomColor: "#0891b2",
  },
  tabItemInactive: {
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  tabLabelActive: {
    color: "#0891b2",
  },
  tabLabelInactive: {
    color: "#9ca3af",
  },
  // Step content
  stepContentContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  // Common
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "bold",
  },
  cardMarginBottom: {
    marginBottom: 16,
  },
  marginBottom4: {
    marginBottom: 4,
  },
  marginBottom8: {
    marginBottom: 8,
  },
  marginBottom12: {
    marginBottom: 12,
  },
  marginBottom16: {
    marginBottom: 16,
  },
  marginTop16: {
    marginTop: 16,
  },
  bold: {
    fontWeight: "bold",
  },
  capitalize: {
    textTransform: "capitalize",
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowGap8: {
    flexDirection: "row",
    gap: 8,
  },
  rowGap12: {
    flexDirection: "row",
    gap: 12,
  },
  gap12: {
    gap: 12,
  },
  alignStart: {
    alignItems: "flex-start",
  },
  // Arrive step
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    color: "#374151",
    marginLeft: 8,
  },
  equipmentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  equipmentLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  equipmentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  equipmentText: {
    color: "#4b5563",
    fontSize: 14,
    marginLeft: 8,
  },
  arrivedBanner: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 16,
  },
  arrivedText: {
    color: "#15803d",
    fontWeight: "600",
    marginLeft: 8,
  },
  // Checklist step
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  checklistLabel: {
    marginLeft: 12,
    fontSize: 16,
  },
  checklistLabelDone: {
    color: "#6b7280",
    textDecorationLine: "line-through",
  },
  checklistLabelPending: {
    color: "#1f2937",
  },
  // Chemicals step
  chemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  addChemButton: {
    backgroundColor: "#ecfeff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addChemButtonText: {
    color: "#0891b2",
    fontWeight: "600",
    fontSize: 14,
  },
  chemFieldRow: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  chemFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  chemFieldLabel: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "500",
  },
  chemNameChip: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chemNameChipSelected: {
    backgroundColor: "#0891b2",
    borderColor: "#0891b2",
  },
  chemNameChipUnselected: {
    backgroundColor: "white",
    borderColor: "#e5e7eb",
  },
  chemNameChipText: {
    fontSize: 14,
  },
  chemNameChipTextSelected: {
    color: "white",
    fontWeight: "600",
  },
  chemNameChipTextUnselected: {
    color: "#374151",
  },
  unitLabel: {
    color: "#374151",
    fontWeight: "500",
    fontSize: 14,
    marginBottom: 4,
  },
  unitRow: {
    flexDirection: "row",
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  unitChipSelected: {
    backgroundColor: "#0891b2",
    borderColor: "#0891b2",
  },
  unitChipUnselected: {
    borderColor: "#e5e7eb",
  },
  unitChipText: {
    fontSize: 12,
  },
  unitChipTextSelected: {
    color: "white",
    fontWeight: "600",
  },
  unitChipTextUnselected: {
    color: "#4b5563",
  },
  emptyChemText: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 16,
  },
  // Photos step
  photoTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoTypeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  photoTypeChipSelected: {
    backgroundColor: "#0891b2",
    borderColor: "#0891b2",
  },
  photoTypeChipUnselected: {
    borderColor: "#e5e7eb",
  },
  photoTypeChipText: {
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  photoTypeChipTextSelected: {
    color: "white",
  },
  photoTypeChipTextUnselected: {
    color: "#374151",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoThumb: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
  },
  photoCaption: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoCaptionText: {
    color: "white",
    fontSize: 12,
    textTransform: "capitalize",
  },
  emptyPhotos: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyPhotosText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
  },
  // Notes step
  notesHint: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    minHeight: 150,
  },
  // Repair step
  repairEmptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  repairEmptyTitle: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 16,
    marginTop: 12,
  },
  repairEmptySubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  fieldLabel: {
    color: "#374151",
    fontWeight: "500",
    fontSize: 14,
    marginBottom: 8,
  },
  repairCatChip: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  repairCatChipSelected: {
    backgroundColor: "#0891b2",
    borderColor: "#0891b2",
  },
  repairCatChipUnselected: {
    borderColor: "#e5e7eb",
  },
  repairCatChipText: {
    fontSize: 14,
    textTransform: "capitalize",
  },
  repairCatChipTextSelected: {
    color: "white",
    fontWeight: "600",
  },
  repairCatChipTextUnselected: {
    color: "#374151",
  },
  descriptionInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    minHeight: 100,
  },
  descriptionInputNormal: {
    borderColor: "#e5e7eb",
  },
  descriptionInputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  urgencyChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  urgencyChipUnselected: {
    borderColor: "#e5e7eb",
  },
  urgencyChipText: {
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  urgencyChipTextSelected: {
    color: "white",
  },
  urgencyChipTextUnselected: {
    color: "#4b5563",
  },
  // Depart step
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryText: {
    color: "#374151",
    marginLeft: 8,
  },
  notesSummary: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  notesSummaryLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesSummaryText: {
    color: "#374151",
    fontSize: 14,
  },
  completedBanner: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 16,
  },
  completedText: {
    color: "#15803d",
    fontWeight: "600",
    marginLeft: 8,
  },
});
