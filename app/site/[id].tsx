import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Colors } from "../../src/constants/theme";
import { useOrg } from "../../src/providers/OrgProvider";
import type {
  Jobsite,
  ServiceOrder,
  Visit,
  Equipment,
} from "../../src/types/database";

interface SiteDocument {
  id: string;
  name: string;
  doc_type: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_url: string;
  created_at: string;
}

const URGENCY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "#f0fdf4", text: "#15803d" },
  medium: { bg: "#fffbeb", text: "#b45309" },
  high: { bg: "#fef2f2", text: "#dc2626" },
  emergency: { bg: "#fef2f2", text: "#7f1d1d" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: Colors.gray[100], text: Colors.gray[600] },
  pending: { bg: "#fef3c7", text: "#92400e" },
  approved: { bg: "#dbeafe", text: "#1e40af" },
  scheduled: { bg: "#e0e7ff", text: "#3730a3" },
  in_progress: { bg: Colors.primary[50], text: Colors.primary[700] },
  completed: { bg: "#dcfce7", text: "#166534" },
  invoiced: { bg: Colors.gray[100], text: Colors.gray[600] },
  canceled: { bg: "#fecaca", text: "#991b1b" },
};

const VISIT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#e0e7ff", text: "#3730a3" },
  en_route: { bg: Colors.primary[50], text: Colors.primary[700] },
  in_progress: { bg: Colors.primary[50], text: Colors.primary[700] },
  completed: { bg: "#dcfce7", text: "#166534" },
  skipped: { bg: "#fecaca", text: "#991b1b" },
  canceled: { bg: "#fecaca", text: "#991b1b" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export default function SiteDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { orgSettings } = useOrg();
  const siteLabel =
    (orgSettings["jobsite_label"] as string | undefined) ?? "Site";
  const siteLabelSingular = siteLabel.replace(/s$/i, "") || "Site";

  const [site, setSite] = useState<Jobsite | null>(null);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setNotFound(false);

    const [siteRes, ordersRes, visitsRes, equipmentRes, documentsRes] =
      await Promise.all([
        supabase.from("jobsites").select("*").eq("id", id).single(),
        supabase
          .from("service_orders")
          .select("*")
          .eq("jobsite_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("visits")
          .select("*")
          .eq("jobsite_id", id)
          .order("scheduled_date", { ascending: false }),
        supabase
          .from("equipment")
          .select("*")
          .eq("jobsite_id", id)
          .order("name"),
        supabase
          .from("documents")
          .select("id, name, doc_type, mime_type, file_size_bytes, storage_url, created_at")
          .eq("entity_type", "jobsite")
          .eq("entity_id", id)
          .order("created_at", { ascending: false }),
      ]);

    if (!siteRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setSite(siteRes.data as Jobsite);
    setServiceOrders((ordersRes.data ?? []) as ServiceOrder[]);
    setVisits((visitsRes.data ?? []) as Visit[]);
    setEquipment((equipmentRes.data ?? []) as Equipment[]);
    setDocuments((documentsRes.data ?? []) as SiteDocument[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openMaps = () => {
    if (!site) return;
    const address = `${site.address_line1}, ${site.city} ${site.state} ${site.zip}`;
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
    });
    if (url) Linking.openURL(url);
  };

  const callContact = () => {
    if (site?.contact_phone) {
      Linking.openURL(`tel:${site.contact_phone}`);
    }
  };

  const emailContact = () => {
    if (site?.contact_email) {
      Linking.openURL(`mailto:${site.contact_email}`);
    }
  };

  const openDocument = async (doc: SiteDocument) => {
    const { data, error } = await supabase.storage
      .from("fieldbase")
      .createSignedUrl(doc.storage_url, 3600);
    if (error || !data?.signedUrl) return;
    Linking.openURL(data.signedUrl);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </SafeAreaView>
    );
  }

  if (notFound || !site) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <Ionicons name="alert-circle" size={48} color={Colors.gray[300]} />
        <Text style={styles.notFoundText}>
          {siteLabelSingular} not found
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const activeOrders = serviceOrders.filter(
    (o) => !["completed", "canceled", "invoiced"].includes(o.status)
  );
  const pastVisits = visits.filter((v) => v.status === "completed");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {site.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchData}
            tintColor={Colors.primary[600]}
          />
        }
      >
        {/* Site info card */}
        <Card style={styles.card}>
          <View style={styles.siteHeader}>
            <View style={styles.siteIconBox}>
              <Ionicons name="location" size={24} color={Colors.primary[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.siteName}>{site.name}</Text>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      site.status === "active"
                        ? "#dcfce7"
                        : site.status === "lead"
                        ? "#fef3c7"
                        : Colors.gray[100],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color:
                        site.status === "active"
                          ? "#166534"
                          : site.status === "lead"
                          ? "#92400e"
                          : Colors.gray[600],
                    },
                  ]}
                >
                  {capitalize(site.status)}
                </Text>
              </View>
            </View>
          </View>

          {/* Address */}
          <TouchableOpacity style={styles.addressRow} onPress={openMaps}>
            <Ionicons name="navigate" size={18} color={Colors.primary[600]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressText}>
                {site.address_line1}
                {site.address_line2 ? `, ${site.address_line2}` : ""}
              </Text>
              <Text style={styles.addressSubtext}>
                {site.city}, {site.state} {site.zip}
              </Text>
              <Text style={styles.addressHint}>Tap to navigate</Text>
            </View>
            <Ionicons
              name="open-outline"
              size={14}
              color={Colors.primary[600]}
            />
          </TouchableOpacity>

          {/* Contact */}
          {(site.contact_name || site.contact_phone || site.contact_email) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Contact</Text>
              {site.contact_name && (
                <View style={styles.contactItem}>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={Colors.gray[500]}
                  />
                  <Text style={styles.contactValue}>{site.contact_name}</Text>
                </View>
              )}
              {site.contact_phone && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={callContact}
                >
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color={Colors.primary[600]}
                  />
                  <Text
                    style={[
                      styles.contactValue,
                      { color: Colors.primary[700] },
                    ]}
                  >
                    {site.contact_phone}
                  </Text>
                </TouchableOpacity>
              )}
              {site.contact_email && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={emailContact}
                >
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={Colors.primary[600]}
                  />
                  <Text
                    style={[
                      styles.contactValue,
                      { color: Colors.primary[700] },
                    ]}
                  >
                    {site.contact_email}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Access notes */}
          {site.access_notes && (
            <View style={styles.accessNotes}>
              <Ionicons
                name="information-circle"
                size={16}
                color={Colors.amber[700]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.accessLabel}>Access Notes</Text>
                <Text style={styles.accessText}>{site.access_notes}</Text>
              </View>
            </View>
          )}

          {/* Tags */}
          {site.tags && site.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <View style={styles.tagsRow}>
                {site.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Service orders */}
        <View style={styles.sectionHeader}>
          <Ionicons
            name="clipboard"
            size={16}
            color={Colors.primary[600]}
          />
          <Text style={styles.sectionHeaderText}>
            Service Orders ({serviceOrders.length})
          </Text>
        </View>

        {serviceOrders.length === 0 ? (
          <Card style={styles.card}>
            <View style={styles.emptyBox}>
              <Ionicons
                name="clipboard-outline"
                size={32}
                color={Colors.gray[300]}
              />
              <Text style={styles.emptyText}>No service orders</Text>
            </View>
          </Card>
        ) : (
          serviceOrders.map((order) => {
            const urgency =
              URGENCY_COLORS[order.urgency] ?? URGENCY_COLORS.medium;
            const status = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;

            return (
              <Card key={order.id} style={styles.card}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderTitle} numberOfLines={1}>
                    {order.title}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: urgency.bg },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: urgency.text }]}
                    >
                      {capitalize(order.urgency)}
                    </Text>
                  </View>
                </View>
                {order.description && (
                  <Text style={styles.orderDesc} numberOfLines={2}>
                    {order.description}
                  </Text>
                )}
                <View style={styles.orderMeta}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: status.bg },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: status.text }]}
                    >
                      {capitalize(order.status)}
                    </Text>
                  </View>
                  {order.scheduled_date && (
                    <View style={styles.metaChip}>
                      <Ionicons
                        name="calendar-outline"
                        size={12}
                        color={Colors.gray[500]}
                      />
                      <Text style={styles.metaChipText}>
                        {formatDate(order.scheduled_date)}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            );
          })
        )}

        {/* Equipment */}
        {equipment.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="build"
                size={16}
                color={Colors.primary[600]}
              />
              <Text style={styles.sectionHeaderText}>
                Equipment ({equipment.length})
              </Text>
            </View>
            {equipment.map((eq) => (
              <Card key={eq.id} style={styles.card}>
                <View style={styles.equipmentRow}>
                  <Ionicons
                    name="hardware-chip-outline"
                    size={18}
                    color={Colors.gray[500]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.equipmentName}>{eq.name}</Text>
                    {(eq.brand || eq.model) && (
                      <Text style={styles.equipmentSub}>
                        {[eq.brand, eq.model].filter(Boolean).join(" ")}
                      </Text>
                    )}
                    {eq.serial_number && (
                      <Text style={styles.equipmentSub}>
                        S/N: {eq.serial_number}
                      </Text>
                    )}
                  </View>
                  {eq.condition && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            eq.condition === "good"
                              ? "#dcfce7"
                              : eq.condition === "fair"
                              ? "#fef3c7"
                              : eq.condition === "poor"
                              ? "#fecaca"
                              : Colors.gray[100],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color:
                              eq.condition === "good"
                                ? "#166534"
                                : eq.condition === "fair"
                                ? "#92400e"
                                : eq.condition === "poor"
                                ? "#991b1b"
                                : Colors.gray[600],
                          },
                        ]}
                      >
                        {capitalize(eq.condition)}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="document-text"
                size={16}
                color={Colors.primary[600]}
              />
              <Text style={styles.sectionHeaderText}>
                Documents ({documents.length})
              </Text>
            </View>
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => openDocument(doc)}
                activeOpacity={0.7}
              >
                <Card style={styles.card}>
                  <View style={styles.docRow}>
                    <Ionicons
                      name={
                        doc.mime_type?.startsWith("image/")
                          ? "image"
                          : doc.mime_type === "application/pdf"
                          ? "document-text"
                          : "document"
                      }
                      size={20}
                      color={Colors.primary[600]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text style={styles.docMeta}>
                        {capitalize(doc.doc_type)} · {formatDate(doc.created_at)}
                      </Text>
                    </View>
                    <Ionicons
                      name="open-outline"
                      size={16}
                      color={Colors.gray[400]}
                    />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Past visits */}
        {pastVisits.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="time"
                size={16}
                color={Colors.primary[600]}
              />
              <Text style={styles.sectionHeaderText}>
                Past Visits ({pastVisits.length})
              </Text>
            </View>
            {pastVisits.slice(0, 10).map((visit) => {
              const vStatus =
                VISIT_STATUS_COLORS[visit.status] ??
                VISIT_STATUS_COLORS.scheduled;
              return (
                <Card key={visit.id} style={styles.card}>
                  <View style={styles.visitRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitDate}>
                        {formatDate(visit.scheduled_date)}
                      </Text>
                      {visit.notes && (
                        <Text style={styles.visitNotes} numberOfLines={2}>
                          {visit.notes}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: vStatus.bg },
                      ]}
                    >
                      <Text
                        style={[styles.badgeText, { color: vStatus.text }]}
                      >
                        {capitalize(visit.status)}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {/* All visits section if there are non-completed visits */}
        {visits.filter((v) => v.status !== "completed").length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="calendar"
                size={16}
                color={Colors.primary[600]}
              />
              <Text style={styles.sectionHeaderText}>Upcoming / Other Visits</Text>
            </View>
            {visits
              .filter((v) => v.status !== "completed")
              .slice(0, 10)
              .map((visit) => {
                const vStatus =
                  VISIT_STATUS_COLORS[visit.status] ??
                  VISIT_STATUS_COLORS.scheduled;
                return (
                  <Card key={visit.id} style={styles.card}>
                    <View style={styles.visitRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.visitDate}>
                          {formatDate(visit.scheduled_date)}
                        </Text>
                        {visit.scheduled_time && (
                          <Text style={styles.visitNotes}>
                            at {visit.scheduled_time}
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: vStatus.bg },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: vStatus.text }]}
                        >
                          {capitalize(visit.status)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.gray[600],
    marginTop: 12,
    fontWeight: "500",
  },
  backButton: {
    marginTop: 16,
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 10,
    marginHorizontal: 16,
  },
  siteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  siteIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  siteName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.primary[50],
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary[800],
  },
  addressSubtext: {
    fontSize: 13,
    color: Colors.primary[700],
    marginTop: 2,
  },
  addressHint: {
    fontSize: 11,
    color: Colors.primary[600],
    marginTop: 2,
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: Colors.gray[500],
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  contactValue: {
    fontSize: 14,
    color: "#111827",
  },
  accessNotes: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fffbeb",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    alignItems: "flex-start",
  },
  accessLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.amber[800],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accessText: {
    fontSize: 13,
    color: Colors.amber[900],
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary[700],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.gray[600],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.gray[400],
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  orderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  orderDesc: {
    fontSize: 13,
    color: Colors.gray[500],
    marginTop: 6,
    lineHeight: 18,
  },
  orderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaChipText: {
    fontSize: 12,
    color: Colors.gray[500],
    fontWeight: "500",
  },
  equipmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  equipmentSub: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 2,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  docName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  docMeta: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 2,
  },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  visitDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  visitNotes: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 4,
  },
});
