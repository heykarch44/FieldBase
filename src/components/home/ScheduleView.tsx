import React, { useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useScheduleData,
  type ScheduleItem,
  type ScheduleSection,
} from "../../hooks/useScheduleData";
import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import { Colors } from "../../constants/theme";

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "#e5e7eb", text: "#374151" },
  pending: { label: "Pending", bg: "#fef3c7", text: "#92400e" },
  approved: { label: "Approved", bg: "#dbeafe", text: "#1e40af" },
  scheduled: { label: "Scheduled", bg: "#e0e7ff", text: "#3730a3" },
  in_progress: { label: "In Progress", bg: "#d1fae5", text: "#065f46" },
  completed: { label: "Completed", bg: "#d1fae5", text: "#065f46" },
  invoiced: { label: "Invoiced", bg: "#ede9fe", text: "#5b21b6" },
  canceled: { label: "Canceled", bg: "#fee2e2", text: "#991b1b" },
};

const URGENCY_COLORS: Record<string, string> = {
  emergency: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#64748b",
};

export default function ScheduleView() {
  const router = useRouter();
  const { sections, loading, refresh } = useScheduleData();

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "Unscheduled";
    const d = new Date(dateStr + "T00:00:00");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const renderItem = ({ item }: { item: ScheduleItem; section: ScheduleSection }) => {
    const status = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
    const urgencyColor = URGENCY_COLORS[item.urgency] ?? Colors.gray[400];
    const address = item.jobsite
      ? `${item.jobsite.address_line1}, ${item.jobsite.city}`
      : "Unknown site";

    return (
      <TouchableOpacity
        onPress={() =>
          item.jobsite ? router.push(`/site/${item.jobsite.id}`) : undefined
        }
        activeOpacity={0.7}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.urgencyDot, { backgroundColor: urgencyColor }]} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {item.jobsite && (
                  <Text style={styles.cardSiteName} numberOfLines={1}>
                    {item.jobsite.name}
                  </Text>
                )}
                <Text style={styles.cardAddress} numberOfLines={1}>{address}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.text }]}>
                {status.label}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.gray[500]} />
            <Text style={styles.metaText}>{formatDate(item.scheduled_date)}</Text>
            {item.requires_signature && (
              <>
                <View style={styles.metaDivider} />
                <Ionicons name="create-outline" size={14} color={Colors.primary[600]} />
                <Text style={[styles.metaText, { color: Colors.primary[700] }]}>Signature</Text>
              </>
            )}
          </View>
          {item.jobsite?.access_notes ? (
            <View style={styles.accessNotesRow}>
              <Ionicons name="information-circle" size={14} color={Colors.primary[600]} />
              <Text style={styles.accessNotesText} numberOfLines={2}>
                {item.jobsite.access_notes}
              </Text>
            </View>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: ScheduleSection }) => (
    <View style={styles.sectionHeader}>
      <Ionicons
        name={
          section.title === "In Progress"
            ? "play-circle"
            : section.title === "Today"
            ? "today"
            : "calendar"
        }
        size={16}
        color={
          section.title === "In Progress" ? Colors.primary[600] : Colors.gray[500]
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

  const isEmpty = sections.length === 0 && !loading;

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <EmptyState
          icon="calendar-outline"
          title="No scheduled work"
          subtitle="You have no scheduled or upcoming service orders. Pull down to refresh."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
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
    gap: 10,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  urgencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  cardSiteName: {
    fontSize: 14,
    color: Colors.primary[700],
    fontWeight: "600",
    marginTop: 2,
  },
  cardAddress: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  metaText: {
    fontSize: 13,
    color: Colors.gray[600],
    fontWeight: "500",
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray[300],
    marginHorizontal: 4,
  },
  accessNotesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#fffbeb",
    padding: 8,
    borderRadius: 6,
  },
  accessNotesText: {
    fontSize: 13,
    color: "#92400e",
    flex: 1,
  },
});
