import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Image,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Colors } from "../../src/constants/theme";
import { useOrg } from "../../src/providers/OrgProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { useSitePhotos, getSignedPhotoUrl } from "../../src/hooks/useSitePhotos";
import type { SitePhoto } from "../../src/hooks/useSitePhotos";
import { useUploadSitePhotos } from "../../src/hooks/useUploadSitePhotos";
import { useSiteDocuments, getSignedDocumentUrl } from "../../src/hooks/useSiteDocuments";
import type { SiteDocument } from "../../src/hooks/useSiteDocuments";
import { PhotoViewer } from "../../src/components/PhotoViewer";
import { NotesSection } from "../../src/components/NotesSection";
import { TimeClockCard } from "../../src/components/TimeClockCard";
import { ActivityFeed } from "../../src/components/ActivityFeed";
import type {
  Jobsite,
  ServiceOrder,
  Visit,
  Equipment,
} from "../../src/types/database";

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SiteDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { orgSettings } = useOrg();
  const siteLabel =
    (orgSettings["jobsite_label"] as string | undefined) ?? "Site";
  const siteLabelSingular = siteLabel.replace(/s$/i, "") || "Site";

  const { user, memberships } = useAuth();

  const [site, setSite] = useState<Jobsite | null>(null);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { documents } = useSiteDocuments(id);
  const [previewDoc, setPreviewDoc] = useState<SiteDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { photos, refetch: refetchPhotos } = useSitePhotos(id);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string | null>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const {
    pickFromCamera,
    pickFromLibrary,
    uploading,
    progress,
  } = useUploadSitePhotos({
    jobsiteId: id,
    onUploaded: refetchPhotos,
  });

  const isManager = useMemo(() => {
    if (!site) return false;
    const m = memberships.find((mm) => mm.org_id === site.org_id);
    return !!m && (m.role === "owner" || m.role === "admin" || m.role === "manager");
  }, [memberships, site]);

  const canDeletePhoto = useCallback(
    (p: SitePhoto) => isManager || p.uploaded_by === user?.id,
    [isManager, user?.id]
  );

  useEffect(() => {
    let cancelled = false;
    const missing = photos.filter((p) => thumbUrls[p.id] === undefined);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (p) => {
          const url = await getSignedPhotoUrl(p.storage_path, 3600);
          return [p.id, url] as const;
        })
      );
      if (cancelled) return;
      setThumbUrls((prev) => {
        const next = { ...prev };
        for (const [id2, url] of entries) next[id2] = url;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, thumbUrls]);

  const handleDeletePhoto = useCallback(
    async (p: SitePhoto) => {
      Alert.alert(
        "Delete photo?",
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await supabase.storage.from("site-photos").remove([p.storage_path]);
              const { error } = await supabase
                .from("site_photos")
                .delete()
                .eq("id", p.id);
              if (error) {
                Alert.alert("Delete failed", error.message);
                return;
              }
              setViewerIndex(null);
              refetchPhotos();
            },
          },
        ]
      );
    },
    [refetchPhotos]
  );

  const confirmAddPhotos = useCallback(() => {
    Alert.alert("Add Photos", "Choose a source", [
      { text: "Take Photo", onPress: () => pickFromCamera() },
      { text: "Choose from Library", onPress: () => pickFromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [pickFromCamera, pickFromLibrary]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setNotFound(false);

    const [siteRes, ordersRes, visitsRes, equipmentRes] =
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
    const isImage = doc.mime_type?.startsWith("image/");
    if (isImage) {
      setPreviewDoc(doc);
      setPreviewUrl(null);
      setPreviewLoading(true);
      const url = await getSignedDocumentUrl(doc.storage_url, 3600);
      setPreviewLoading(false);
      if (!url) {
        setPreviewDoc(null);
        Alert.alert("Couldn't open document");
        return;
      }
      setPreviewUrl(url);
      return;
    }
    const url = await getSignedDocumentUrl(doc.storage_url, 3600);
    if (!url) {
      Alert.alert("Couldn't open document");
      return;
    }
    Linking.openURL(url);
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
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

        {/* Time Clock */}
        <TimeClockCard
          jobsiteId={id}
          siteLat={site.lat}
          siteLng={site.lng}
          radius={
            (site as unknown as { geofence_radius_m?: number | null })
              .geofence_radius_m ?? 100
          }
        />

        {/* Activity Feed */}
        <View style={styles.activityWrap}>
          <ActivityFeed jobsiteId={id} scope="site" />
        </View>

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
        {documents.length === 0 ? (
          <Card style={styles.card}>
            <View style={styles.emptyBox}>
              <Ionicons
                name="document-outline"
                size={32}
                color={Colors.gray[300]}
              />
              <Text style={styles.emptyText}>No documents yet</Text>
            </View>
          </Card>
        ) : (
          documents.map((doc) => (
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
                      {capitalize(doc.doc_type)} ·{" "}
                      {formatFileSize(doc.file_size_bytes)} ·{" "}
                      {formatDate(doc.created_at)}
                    </Text>
                    {doc.uploader?.full_name && (
                      <Text style={styles.docMeta}>
                        by {doc.uploader.full_name}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="open-outline"
                    size={16}
                    color={Colors.gray[400]}
                  />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* Notes */}
        <NotesSection
          jobsiteId={id}
          orgId={site.org_id}
          title="Site Notes"
        />

        {/* Photos */}
        <View style={styles.sectionHeader}>
          <Ionicons name="images" size={16} color={Colors.primary[600]} />
          <Text style={styles.sectionHeaderText}>
            Photos ({photos.length})
          </Text>
        </View>

        <View style={styles.photoActionsRow}>
          <TouchableOpacity
            style={[styles.photoActionBtn, uploading && styles.photoActionBtnDisabled]}
            onPress={() => pickFromCamera()}
            disabled={uploading}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={18} color="white" />
            <Text style={styles.photoActionBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.photoActionBtnAlt, uploading && styles.photoActionBtnDisabled]}
            onPress={() => pickFromLibrary()}
            disabled={uploading}
            activeOpacity={0.7}
          >
            <Ionicons name="images" size={18} color={Colors.primary[700]} />
            <Text style={styles.photoActionBtnAltText}>Add from Gallery</Text>
          </TouchableOpacity>
        </View>

        {uploading && (
          <View style={styles.uploadBanner}>
            <ActivityIndicator size="small" color={Colors.primary[600]} />
            <Text style={styles.uploadBannerText}>
              Uploading {progress.done + progress.failed + 1} of {progress.total}…
            </Text>
          </View>
        )}

        {photos.length === 0 ? (
          <Card style={styles.card}>
            <View style={styles.emptyBox}>
              <Ionicons
                name="images-outline"
                size={32}
                color={Colors.gray[300]}
              />
              <Text style={styles.emptyText}>No photos yet</Text>
              <TouchableOpacity
                style={styles.emptyPhotoBtn}
                onPress={confirmAddPhotos}
              >
                <Text style={styles.emptyPhotoBtnText}>Add the first photo</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((p, idx) => {
              const url = thumbUrls[p.id];
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.photoThumbWrap}
                  activeOpacity={0.8}
                  onPress={() => setViewerIndex(idx)}
                  onLongPress={() => {
                    if (canDeletePhoto(p)) handleDeletePhoto(p);
                  }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={styles.photoThumb} />
                  ) : (
                    <View style={[styles.photoThumb, styles.photoThumbLoading]}>
                      {url === null ? (
                        <Ionicons
                          name="alert-circle-outline"
                          size={20}
                          color={Colors.gray[400]}
                        />
                      ) : (
                        <ActivityIndicator
                          size="small"
                          color={Colors.primary[600]}
                        />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
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

      <PhotoViewer
        visible={viewerIndex !== null}
        photos={photos}
        startIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        onDelete={handleDeletePhoto}
        canDelete={canDeletePhoto}
      />

      <Modal
        visible={previewDoc !== null}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {previewDoc?.name ?? ""}
            </Text>
            <TouchableOpacity
              onPress={closePreview}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={26} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.previewBody}>
            {previewLoading || !previewUrl ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <Image
                source={{ uri: previewUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
          </View>
          {previewDoc && previewUrl && (
            <TouchableOpacity
              style={styles.previewOpenBtn}
              onPress={() => Linking.openURL(previewUrl)}
            >
              <Ionicons name="open-outline" size={16} color="white" />
              <Text style={styles.previewOpenBtnText}>Open externally</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
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
  activityWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
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
  photoActionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary[600],
    paddingVertical: 10,
    borderRadius: 10,
  },
  photoActionBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
  photoActionBtnAlt: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary[50],
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  photoActionBtnAltText: {
    color: Colors.primary[700],
    fontWeight: "600",
    fontSize: 13,
  },
  photoActionBtnDisabled: {
    opacity: 0.6,
  },
  uploadBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.primary[50],
    borderRadius: 10,
  },
  uploadBannerText: {
    fontSize: 13,
    color: Colors.primary[700],
    fontWeight: "500",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 4,
  },
  photoThumbWrap: {
    width: (Dimensions.get("window").width - 32) / 3,
    aspectRatio: 1,
    padding: 2,
  },
  photoThumb: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: Colors.gray[100],
  },
  photoThumbLoading: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPhotoBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary[600],
  },
  emptyPhotoBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 50,
    gap: 12,
  },
  previewTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  previewBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewOpenBtn: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  previewOpenBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
});
