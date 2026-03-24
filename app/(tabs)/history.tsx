import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVisitHistory } from "../../src/hooks/useVisitHistory";
import { Card } from "../../src/components/Card";
import { StatusBadge } from "../../src/components/StatusBadge";
import { EmptyState } from "../../src/components/EmptyState";
import { Colors } from "../../src/constants/theme";
import type { VisitDetail } from "../../src/types/database";

export default function HistoryScreen() {
  const { visits, loading, refresh } = useVisitHistory();
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return "—";
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTimeOnSite = (arrived: string | null, departed: string | null): string => {
    if (!arrived || !departed) return "—";
    const diff = new Date(departed).getTime() - new Date(arrived).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const renderVisit = ({ item }: { item: VisitDetail }) => {
    const isExpanded = expandedVisit === item.id;
    const readings = item.chemical_logs.find((cl) => cl.ph_before !== null);

    return (
      <TouchableOpacity
        onPress={() => setExpandedVisit(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.customerName}>
                {item.customer.first_name} {item.customer.last_name}
              </Text>
              <Text style={styles.dateTime}>
                {formatDate(item.scheduled_date)} · {formatTime(item.arrived_at)} –{" "}
                {formatTime(item.departed_at)}
              </Text>
            </View>
            <View style={styles.cardHeaderRight}>
              <StatusBadge status={item.status} />
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={Colors.gray[400]}
                style={{ marginLeft: 8 }}
              />
            </View>
          </View>

          {isExpanded && (
            <View style={styles.expandedSection}>
              {/* Time on site */}
              <View style={styles.timeOnSiteRow}>
                <Ionicons name="timer-outline" size={16} color={Colors.aqua[600]} />
                <Text style={styles.timeOnSiteText}>
                  Time on site: {getTimeOnSite(item.arrived_at, item.departed_at)}
                </Text>
              </View>

              {/* Chemical Readings */}
              {readings && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Chemical Readings</Text>
                  <View style={styles.badgeRow}>
                    {readings.ph_before != null && (
                      <View style={styles.aquaBadge}>
                        <Text style={styles.aquaBadgeText}>
                          pH: {readings.ph_before}→{readings.ph_after ?? "—"}
                        </Text>
                      </View>
                    )}
                    {readings.chlorine_before != null && (
                      <View style={styles.aquaBadge}>
                        <Text style={styles.aquaBadgeText}>
                          Cl: {readings.chlorine_before}→{readings.chlorine_after ?? "—"}
                        </Text>
                      </View>
                    )}
                    {readings.alkalinity_before != null && (
                      <View style={styles.aquaBadge}>
                        <Text style={styles.aquaBadgeText}>
                          Alk: {readings.alkalinity_before}→{readings.alkalinity_after ?? "—"}
                        </Text>
                      </View>
                    )}
                    {readings.water_temp != null && (
                      <View style={styles.amberBadge}>
                        <Text style={styles.amberBadgeText}>
                          {readings.water_temp}°F
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Chemicals Added */}
              {item.chemical_logs.filter((cl) => cl.chemical_name).length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabelSmallMargin}>Chemicals Added</Text>
                  {item.chemical_logs
                    .filter((cl) => cl.chemical_name)
                    .map((cl) => (
                      <Text key={cl.id} style={styles.chemicalItem}>
                        {cl.chemical_name}: {cl.amount} {cl.unit}
                      </Text>
                    ))}
                </View>
              )}

              {/* Photos */}
              {item.photos.length > 0 && (
                <View style={styles.photosRow}>
                  <Ionicons name="camera-outline" size={16} color={Colors.gray[500]} />
                  <Text style={styles.photosText}>
                    {item.photos.length} photo{item.photos.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}

              {/* Notes */}
              {item.notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{item.notes}</Text>
                </View>
              )}

              {/* Repair Requests */}
              {item.repair_requests.length > 0 && (
                <View style={styles.repairSection}>
                  <Text style={styles.sectionLabelSmallMargin}>Repair Requests</Text>
                  {item.repair_requests.map((rr) => (
                    <View key={rr.id} style={styles.repairItem}>
                      <Text style={styles.repairTitle}>
                        {rr.category} — {rr.urgency}
                      </Text>
                      <Text style={styles.repairDescription}>
                        {rr.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {visits.length === 0 && !loading ? (
        <EmptyState
          icon="time-outline"
          title="No Recent Visits"
          subtitle="Completed visits from the last 7 days will appear here."
        />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id}
          renderItem={renderVisit}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={Colors.aqua[600]}
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
    backgroundColor: "#f9fafb", // gray-50
  },
  card: {
    marginBottom: 12,
    marginHorizontal: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flex: 1,
  },
  customerName: {
    color: "#111827", // gray-900
    fontWeight: "bold",
    fontSize: 16,
  },
  dateTime: {
    color: "#6b7280", // gray-500
    fontSize: 14,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6", // gray-100
  },
  timeOnSiteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  timeOnSiteText: {
    color: "#374151", // gray-700
    fontSize: 14,
    marginLeft: 8,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: "#6b7280", // gray-500
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sectionLabelSmallMargin: {
    color: "#6b7280", // gray-500
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aquaBadge: {
    backgroundColor: "#ecfeff", // aqua-50
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aquaBadgeText: {
    color: "#0e7490", // aqua-700
    fontSize: 12,
  },
  amberBadge: {
    backgroundColor: "#fffbeb", // amber-50
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  amberBadgeText: {
    color: "#b45309", // amber-700
    fontSize: 12,
  },
  chemicalItem: {
    color: "#374151", // gray-700
    fontSize: 14,
  },
  photosRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  photosText: {
    color: "#4b5563", // gray-600
    fontSize: 14,
    marginLeft: 8,
  },
  notesBox: {
    backgroundColor: "#f9fafb", // gray-50
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  notesText: {
    color: "#374151", // gray-700
    fontSize: 14,
  },
  repairSection: {
    marginTop: 12,
  },
  repairItem: {
    backgroundColor: "#fffbeb", // amber-50
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  repairTitle: {
    color: "#92400e", // amber-800
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  repairDescription: {
    color: "#b45309", // amber-700
    fontSize: 14,
  },
});
