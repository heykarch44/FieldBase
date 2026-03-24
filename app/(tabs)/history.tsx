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

interface VisitItem {
  id: string;
  scheduled_date: string;
  status: string;
  arrived_at: string | null;
  departed_at: string | null;
  notes: string | null;
  jobsite: {
    id: string;
    name: string;
    address_line1: string;
    city: string;
  };
  photos: Array<{ id: string }>;
  service_orders: Array<{
    id: string;
    title: string;
    urgency: string;
    description: string | null;
  }>;
}

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

  const renderVisit = ({ item }: { item: VisitItem }) => {
    const isExpanded = expandedVisit === item.id;

    return (
      <TouchableOpacity
        onPress={() => setExpandedVisit(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.jobsiteName}>
                {item.jobsite.name}
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
                <Ionicons name="timer-outline" size={16} color={Colors.primary[600]} />
                <Text style={styles.timeOnSiteText}>
                  Time on site: {getTimeOnSite(item.arrived_at, item.departed_at)}
                </Text>
              </View>

              {/* Location */}
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={Colors.gray[500]} />
                <Text style={styles.locationText}>
                  {item.jobsite.address_line1}, {item.jobsite.city}
                </Text>
              </View>

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

              {/* Service Orders */}
              {item.service_orders.length > 0 && (
                <View style={styles.ordersSection}>
                  <Text style={styles.sectionLabelSmallMargin}>Service Orders</Text>
                  {item.service_orders.map((order) => (
                    <View key={order.id} style={styles.orderItem}>
                      <Text style={styles.orderTitle}>
                        {order.title} — {order.urgency}
                      </Text>
                      {order.description && (
                        <Text style={styles.orderDescription}>
                          {order.description}
                        </Text>
                      )}
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
          data={visits as VisitItem[]}
          keyExtractor={(item) => item.id}
          renderItem={renderVisit}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
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
  jobsiteName: {
    color: "#111827",
    fontWeight: "bold",
    fontSize: 16,
  },
  dateTime: {
    color: "#6b7280",
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
    borderTopColor: "#f3f4f6",
  },
  timeOnSiteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  timeOnSiteText: {
    color: "#374151",
    fontSize: 14,
    marginLeft: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationText: {
    color: "#4b5563",
    fontSize: 14,
    marginLeft: 8,
  },
  sectionLabelSmallMargin: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  photosRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  photosText: {
    color: "#4b5563",
    fontSize: 14,
    marginLeft: 8,
  },
  notesBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  notesText: {
    color: "#374151",
    fontSize: 14,
  },
  ordersSection: {
    marginTop: 12,
  },
  orderItem: {
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  orderTitle: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  orderDescription: {
    color: "#b45309",
    fontSize: 14,
  },
});
