import React, { useState } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useServiceOrders,
  type ServiceOrderItem,
  type ServiceOrderSection,
} from "../../src/hooks/useServiceOrders";
import { StatusBadge } from "../../src/components/StatusBadge";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { NotesSection } from "../../src/components/NotesSection";
import { ActivityFeed } from "../../src/components/ActivityFeed";
import { OrderSignatureSection } from "../../src/components/OrderSignatureSection";
import { Colors, UrgencyColors } from "../../src/constants/theme";

const URGENCY_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  low: { label: "Low", bg: "#f0fdf4", text: "#15803d" },
  medium: { label: "Medium", bg: "#fffbeb", text: "#b45309" },
  high: { label: "High", bg: "#fef2f2", text: "#dc2626" },
  emergency: { label: "Emergency", bg: "#fef2f2", text: "#7f1d1d" },
};

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: Colors.gray[100], text: Colors.gray[600] },
  pending: { label: "Pending", bg: "#fef3c7", text: "#92400e" },
  approved: { label: "Approved", bg: "#dbeafe", text: "#1e40af" },
  scheduled: { label: "Scheduled", bg: "#e0e7ff", text: "#3730a3" },
  in_progress: { label: "In Progress", bg: Colors.primary[50], text: Colors.primary[700] },
  completed: { label: "Completed", bg: "#dcfce7", text: "#166534" },
  invoiced: { label: "Invoiced", bg: Colors.gray[100], text: Colors.gray[600] },
  canceled: { label: "Canceled", bg: "#fecaca", text: "#991b1b" },
};

export default function OrdersScreen() {
  const { sections, loading, refresh } = useServiceOrders();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "Not scheduled";
    const d = new Date(dateStr + "T00:00:00");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const openMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
    });
    if (url) Linking.openURL(url);
  };

  const today = new Date().toISOString().split("T")[0];

  const renderOrder = ({
    item,
    section,
  }: {
    item: ServiceOrderItem;
    section: ServiceOrderSection;
  }) => {
    const isExpanded = expandedId === item.id;
    const urgency = URGENCY_LABELS[item.urgency] ?? URGENCY_LABELS.medium;
    const status = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
    const address = item.jobsite
      ? `${item.jobsite.address_line1}, ${item.jobsite.city}`
      : null;
    const isOpen = !["completed", "invoiced", "canceled"].includes(item.status);
    const isOverdue =
      isOpen && !!item.scheduled_date && item.scheduled_date < today;

    return (
      <TouchableOpacity
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <Card style={styles.card}>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={isExpanded ? undefined : 1}>
                  {item.title}
                </Text>
              </View>
              {item.jobsite && (
                <Text style={styles.siteName} numberOfLines={1}>
                  {item.jobsite.name}
                </Text>
              )}
            </View>
            <View style={styles.cardHeaderRight}>
              <View style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}>
                <Text style={[styles.urgencyText, { color: urgency.text }]}>
                  {urgency.label}
                </Text>
              </View>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={Colors.gray[400]}
                style={{ marginLeft: 6 }}
              />
            </View>
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.text }]}>
                {status.label}
              </Text>
            </View>
            {item.scheduled_date && (
              <View style={[styles.dateChip, isOverdue && styles.dateChipOverdue]}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={isOverdue ? "#991b1b" : Colors.gray[500]}
                />
                <Text style={[styles.dateText, isOverdue && styles.dateTextOverdue]}>
                  {formatDate(item.scheduled_date)}
                </Text>
              </View>
            )}
            {isOverdue && (
              <View style={styles.overdueBadge}>
                <Ionicons name="alert-circle" size={12} color="#fff" />
                <Text style={styles.overdueText}>Overdue</Text>
              </View>
            )}
            {item.requires_signature && (
              <View style={styles.sigReqBadge}>
                <Ionicons name="create-outline" size={11} color={Colors.primary[700]} />
                <Text style={styles.sigReqText}>Signature</Text>
              </View>
            )}
          </View>

          {/* Expanded details */}
          {isExpanded && (
            <View style={styles.expandedSection}>
              {/* Description */}
              {item.description && (
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionText}>{item.description}</Text>
                </View>
              )}

              {/* Signature */}
              <View style={styles.signatureWrap}>
                <OrderSignatureSection
                  serviceOrderId={item.id}
                  requiresSignature={item.requires_signature ?? false}
                />
              </View>

              {/* Details grid */}
              <View style={styles.detailsGrid}>
                {item.scheduled_date && (
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={14} color={Colors.primary[600]} />
                    <Text style={styles.detailLabel}>Scheduled</Text>
                    <Text style={styles.detailValue}>{formatDate(item.scheduled_date)}</Text>
                  </View>
                )}
                {item.requester_name && (
                  <View style={styles.detailItem}>
                    <Ionicons name="person" size={14} color={Colors.primary[600]} />
                    <Text style={styles.detailLabel}>Requested by</Text>
                    <Text style={styles.detailValue}>{item.requester_name}</Text>
                  </View>
                )}
                {item.estimated_cost != null && (
                  <View style={styles.detailItem}>
                    <Ionicons name="cash" size={14} color={Colors.primary[600]} />
                    <Text style={styles.detailLabel}>Est. Cost</Text>
                    <Text style={styles.detailValue}>
                      ${item.estimated_cost.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailItem}>
                  <Ionicons name="time" size={14} color={Colors.gray[400]} />
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {/* Site address + navigate */}
              {item.jobsite && address && (
                <TouchableOpacity
                  style={styles.addressRow}
                  onPress={() =>
                    openMaps(
                      `${item.jobsite!.address_line1}, ${item.jobsite!.city} ${item.jobsite!.state} ${item.jobsite!.zip}`
                    )
                  }
                >
                  <Ionicons name="navigate" size={16} color={Colors.primary[600]} />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressText}>
                      {item.jobsite.address_line1}, {item.jobsite.city} {item.jobsite.state}{" "}
                      {item.jobsite.zip}
                    </Text>
                    <Text style={styles.addressHint}>Tap to navigate</Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={Colors.gray[400]} />
                </TouchableOpacity>
              )}

              {/* Access notes */}
              {item.jobsite?.access_notes && (
                <View style={styles.accessNotesBox}>
                  <Ionicons name="information-circle" size={14} color={Colors.primary[600]} />
                  <Text style={styles.accessNotesText}>{item.jobsite.access_notes}</Text>
                </View>
              )}

              {/* Service Order Notes */}
              {item.jobsite_id && (
                <View style={styles.notesWrap}>
                  <NotesSection
                    jobsiteId={item.jobsite_id}
                    serviceOrderId={item.id}
                    orgId={item.org_id}
                    title="Service Order Notes"
                    compact
                    embedded
                  />
                </View>
              )}

              {/* Activity Feed */}
              {item.jobsite_id && (
                <View style={styles.notesWrap}>
                  <ActivityFeed
                    jobsiteId={item.jobsite_id}
                    serviceOrderId={item.id}
                    scope="service_order"
                  />
                </View>
              )}
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: ServiceOrderSection }) => {
    const iconName =
      section.title === "In Progress"
        ? "play-circle"
        : section.title === "Assigned"
        ? "clipboard"
        : "checkmark-circle";

    return (
      <View style={styles.sectionHeader}>
        <Ionicons
          name={iconName}
          size={16}
          color={
            section.title === "In Progress"
              ? Colors.primary[600]
              : Colors.gray[500]
          }
        />
        <Text
          style={[
            styles.sectionTitle,
            section.title === "In Progress" && styles.sectionTitleActive,
          ]}
        >
          {section.title}
        </Text>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{section.data.length}</Text>
        </View>
      </View>
    );
  };

  const isEmpty = sections.length === 0 && !loading;

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <EmptyState
          icon="clipboard-outline"
          title="No Service Orders"
          subtitle="You don't have any assigned service orders. Pull down to refresh."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={Colors.primary[600]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gray[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitleActive: {
    color: Colors.primary[600],
  },
  sectionCount: {
    backgroundColor: Colors.gray[200],
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.gray[600],
  },
  card: {
    marginBottom: 10,
    marginHorizontal: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  siteName: {
    fontSize: 14,
    color: Colors.gray[500],
    marginTop: 2,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: Colors.gray[500],
    fontWeight: "500",
  },
  dateChipOverdue: {
    // row stays the same; color handled on icon + text
  },
  dateTextOverdue: {
    color: "#991b1b",
    fontWeight: "700",
  },
  overdueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#dc2626",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  overdueText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  descriptionBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  detailsGrid: {
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.gray[500],
    minWidth: 90,
  },
  detailValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500",
    flex: 1,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary[50],
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 13,
    color: Colors.primary[800],
    fontWeight: "500",
  },
  addressHint: {
    fontSize: 11,
    color: Colors.primary[600],
    marginTop: 1,
  },
  accessNotesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#fffbeb",
    padding: 10,
    borderRadius: 8,
  },
  accessNotesText: {
    fontSize: 13,
    color: "#92400e",
    flex: 1,
  },
  notesWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  signatureWrap: {
    marginBottom: 12,
  },
  sigReqBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Colors.primary[50],
  },
  sigReqText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary[700],
  },
});
