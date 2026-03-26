import React, { useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useScheduleData, type ScheduleItem, type ScheduleSection } from "../../hooks/useScheduleData";
import { StatusBadge } from "../StatusBadge";
import { Card } from "../Card";
import { Button } from "../Button";
import { EmptyState } from "../EmptyState";
import { Colors, VisitStatusColors } from "../../constants/theme";

export default function ScheduleView() {
  const router = useRouter();
  const { sections, loading, refresh } = useScheduleData();

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const getDayIndicator = (scheduledDate: string): string => {
    const start = new Date(scheduledDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return `Day ${diffDays}`;
  };

  const formatTime = (time: string | null): string | null => {
    if (!time) return null;
    try {
      const [hours, minutes] = time.split(":");
      const h = parseInt(hours, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const renderActiveItem = (item: ScheduleItem) => {
    const address = `${item.jobsite.address_line1}, ${item.jobsite.city}`;
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusDot, { backgroundColor: VisitStatusColors[item.status] ?? Colors.gray[400] }]} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.jobsite.name}</Text>
              <Text style={styles.cardAddress}>{address}</Text>
            </View>
          </View>
          <View style={styles.dayBadge}>
            <Text style={styles.dayBadgeText}>{getDayIndicator(item.scheduled_date)}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Button
            title="Continue Service"
            onPress={() => router.push(`/visit/${item.id}`)}
            size="sm"
          />
        </View>
      </Card>
    );
  };

  const renderTodayItem = (item: ScheduleItem) => {
    const address = `${item.jobsite.address_line1}, ${item.jobsite.city}`;
    const time = formatTime(item.scheduled_time);
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusDot, { backgroundColor: VisitStatusColors[item.status] ?? Colors.gray[400] }]} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.jobsite.name}</Text>
              <Text style={styles.cardAddress}>{address}</Text>
              {time && <Text style={styles.cardTime}>{time}</Text>}
            </View>
          </View>
          <StatusBadge status={item.status} />
        </View>
        {item.jobsite.access_notes && (
          <View style={styles.accessNotesRow}>
            <Ionicons name="information-circle" size={14} color={Colors.primary[600]} />
            <Text style={styles.accessNotesText}>{item.jobsite.access_notes}</Text>
          </View>
        )}
        <View style={styles.cardActions}>
          <Button
            title={
              item.status === "completed"
                ? "View Visit"
                : item.status === "in_progress"
                ? "Continue Service"
                : "Start Service"
            }
            onPress={() => router.push(`/visit/${item.id}`)}
            size="sm"
            variant={item.status === "completed" ? "outline" : "primary"}
          />
        </View>
      </Card>
    );
  };

  const renderUpcomingItem = (item: ScheduleItem) => {
    const time = formatTime(item.scheduled_time);
    return (
      <Card style={styles.cardUpcoming}>
        <View style={styles.upcomingRow}>
          <View style={styles.upcomingDateCol}>
            <Text style={styles.upcomingDate}>{formatDate(item.scheduled_date)}</Text>
            {time && <Text style={styles.upcomingTime}>{time}</Text>}
          </View>
          <View style={styles.upcomingInfo}>
            <Text style={styles.upcomingName}>{item.jobsite.name}</Text>
            <Text style={styles.upcomingAddress}>
              {item.jobsite.address_line1}, {item.jobsite.city}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray[300]} />
        </View>
      </Card>
    );
  };

  const renderItem = ({ item, section }: { item: ScheduleItem; section: ScheduleSection }) => {
    switch (section.title) {
      case "Active":
        return renderActiveItem(item);
      case "Today":
        return renderTodayItem(item);
      case "Upcoming":
        return renderUpcomingItem(item);
      default:
        return renderTodayItem(item);
    }
  };

  const renderSectionHeader = ({ section }: { section: ScheduleSection }) => (
    <View style={styles.sectionHeader}>
      <Ionicons
        name={
          section.title === "Active"
            ? "play-circle"
            : section.title === "Today"
            ? "today"
            : "calendar"
        }
        size={16}
        color={section.title === "Active" ? Colors.primary[600] : Colors.gray[500]}
      />
      <Text
        style={[
          styles.sectionTitle,
          section.title === "Active" && styles.sectionTitleActive,
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
          title="No Appointments"
          subtitle="You have no scheduled visits. Pull down to refresh."
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
  cardUpcoming: {
    marginBottom: 8,
    marginHorizontal: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  cardAddress: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  cardTime: {
    fontSize: 13,
    color: Colors.primary[600],
    fontWeight: "600",
    marginTop: 4,
  },
  dayBadge: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary[700],
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
  cardActions: {
    marginTop: 12,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  upcomingDateCol: {
    minWidth: 80,
  },
  upcomingDate: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.gray[700],
  },
  upcomingTime: {
    fontSize: 12,
    color: Colors.gray[500],
    marginTop: 2,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  upcomingAddress: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 1,
  },
});
