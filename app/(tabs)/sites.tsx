import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useAssignedSites,
  type AssignedSiteItem,
} from "../../src/hooks/useAssignedSites";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Colors } from "../../src/constants/theme";
import { useOrg } from "../../src/providers/OrgProvider";

export default function SitesScreen() {
  const { sites, loading, refresh } = useAssignedSites();
  const { orgSettings } = useOrg();
  const router = useRouter();

  const siteLabel =
    (orgSettings["jobsite_label"] as string | undefined) ?? "Site";
  const siteLabelSingular = siteLabel.replace(/s$/i, "") || "Site";

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "No upcoming visit";
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

  const renderSite = ({ item }: { item: AssignedSiteItem }) => {
    const fullAddress = `${item.address_line1}, ${item.city} ${item.state} ${item.zip}`;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/site/${item.id}`)}
        activeOpacity={0.7}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="location" size={20} color={Colors.primary[600]} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.siteName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                {item.address_line1}, {item.city} {item.state}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.gray[300]}
            />
          </View>

          <View style={styles.metaRow}>
            {item.open_orders_count > 0 && (
              <View style={styles.openOrdersBadge}>
                <Ionicons
                  name="clipboard"
                  size={12}
                  color={Colors.primary[700]}
                />
                <Text style={styles.openOrdersText}>
                  {item.open_orders_count} open order
                  {item.open_orders_count !== 1 ? "s" : ""}
                </Text>
              </View>
            )}
            {item.next_visit_date && (
              <View style={styles.visitChip}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={Colors.gray[500]}
                />
                <Text style={styles.visitText}>
                  {formatDate(item.next_visit_date)}
                </Text>
              </View>
            )}
          </View>

          {item.contact_name && (
            <View style={styles.contactRow}>
              <Ionicons
                name="person-outline"
                size={14}
                color={Colors.gray[400]}
              />
              <Text style={styles.contactText}>{item.contact_name}</Text>
              {item.contact_phone && (
                <>
                  <Text style={styles.contactDot}>·</Text>
                  <Text style={styles.contactText}>{item.contact_phone}</Text>
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.navigateButton}
            onPress={(e) => {
              e.stopPropagation();
              openMaps(fullAddress);
            }}
          >
            <Ionicons name="navigate" size={14} color={Colors.primary[600]} />
            <Text style={styles.navigateText}>Navigate</Text>
          </TouchableOpacity>
        </Card>
      </TouchableOpacity>
    );
  };

  const isEmpty = sites.length === 0 && !loading;

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <EmptyState
          icon="location-outline"
          title={`No ${siteLabel} Assigned`}
          subtitle={`You don't have any assigned ${siteLabel.toLowerCase()}. Pull down to refresh.`}
        />
      ) : (
        <FlatList
          data={sites}
          keyExtractor={(item) => item.id}
          renderItem={renderSite}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={Colors.primary[600]}
            />
          }
          ListHeaderComponent={
            sites.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {sites.length} {sites.length === 1 ? siteLabelSingular.toLowerCase() : siteLabel.toLowerCase()} assigned
                </Text>
              </View>
            ) : null
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
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  listHeaderText: {
    fontSize: 13,
    color: Colors.gray[500],
    fontWeight: "500",
  },
  card: {
    marginBottom: 10,
    marginHorizontal: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  address: {
    fontSize: 13,
    color: Colors.gray[500],
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  openOrdersBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  openOrdersText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary[700],
  },
  visitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  visitText: {
    fontSize: 12,
    color: Colors.gray[500],
    fontWeight: "500",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  contactText: {
    fontSize: 12,
    color: Colors.gray[500],
  },
  contactDot: {
    color: Colors.gray[300],
    marginHorizontal: 2,
  },
  navigateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary[50],
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  navigateText: {
    fontSize: 12,
    color: Colors.primary[700],
    fontWeight: "600",
  },
});
