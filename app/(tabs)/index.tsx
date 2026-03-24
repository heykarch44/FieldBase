import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Platform,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useRouteData } from "../../src/hooks/useRouteData";
import { useNotifications } from "../../src/hooks/useNotifications";
import { StatusBadge } from "../../src/components/StatusBadge";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { Colors, VisitStatusColors } from "../../src/constants/theme";
import type { RouteStop } from "../../src/types/database";

export default function RouteScreen() {
  useNotifications();
  const router = useRouter();
  const { route, stops, loading, refresh } = useRouteData();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const openNavigation = (lat: number, lng: number, label: string) => {
    const url =
      Platform.OS === "ios"
        ? `maps:?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open maps");
    });
  };

  const startRoute = () => {
    const firstStop = stops.find((s) => s.status === "scheduled");
    if (firstStop?.jobsite.lat && firstStop?.jobsite.lng) {
      openNavigation(
        firstStop.jobsite.lat,
        firstStop.jobsite.lng,
        firstStop.jobsite.name
      );
    }
  };

  const completedCount = stops.filter((s) => s.status === "completed").length;

  const renderStop = ({ item }: { item: RouteStop }) => {
    const isExpanded = expandedStop === item.id;
    const address = `${item.jobsite.address_line1}, ${item.jobsite.city}`;

    return (
      <TouchableOpacity
        onPress={() => setExpandedStop(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <Card style={styles.stopCard}>
          <View style={styles.stopHeader}>
            <View style={styles.stopHeaderLeft}>
              <View
                style={[
                  styles.stopIndexBadge,
                  {
                    backgroundColor:
                      VisitStatusColors[item.status] ?? Colors.gray[400],
                  },
                ]}
              >
                <Text style={styles.stopIndexText}>
                  {item.order_index + 1}
                </Text>
              </View>
              <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{item.jobsite.name}</Text>
                <Text style={styles.stopAddress}>{address}</Text>
              </View>
            </View>
            <View style={styles.stopHeaderRight}>
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
              {item.jobsite.access_notes && (
                <View style={styles.expandedRowStart}>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={Colors.primary[600]}
                  />
                  <Text style={[styles.expandedText, styles.expandedTextFlex]}>
                    {item.jobsite.access_notes}
                  </Text>
                </View>
              )}
              {item.jobsite.contact_name && (
                <View style={styles.expandedRow}>
                  <Ionicons name="person" size={16} color={Colors.gray[500]} />
                  <Text style={styles.expandedText}>
                    {item.jobsite.contact_name}
                    {item.jobsite.contact_phone ? ` · ${item.jobsite.contact_phone}` : ""}
                  </Text>
                </View>
              )}
              {item.equipment.length > 0 && (
                <View style={styles.equipmentSection}>
                  <Text style={styles.equipmentLabel}>Equipment</Text>
                  {item.equipment.map((eq) => (
                    <Text key={eq.id} style={styles.equipmentItem}>
                      {eq.name}
                      {eq.brand ? ` — ${eq.brand}` : ""}
                      {eq.model ? ` ${eq.model}` : ""}
                      {eq.condition ? ` (${eq.condition})` : ""}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.actionRow}>
                <View style={styles.actionButtonFlex}>
                  <Button
                    title={item.status === 'completed' ? 'View Visit' : item.status === 'in_progress' ? 'Continue Service' : 'Start Service'}
                    onPress={() => router.push(`/visit/${item.id}`)}
                    size="sm"
                    variant={item.status === 'completed' ? 'outline' : 'primary'}
                  />
                </View>
                {item.jobsite.lat && item.jobsite.lng && (
                  <TouchableOpacity
                    onPress={() =>
                      openNavigation(
                        item.jobsite.lat!,
                        item.jobsite.lng!,
                        item.jobsite.name
                      )
                    }
                    style={styles.navigateButton}
                  >
                    <Ionicons
                      name="navigate"
                      size={20}
                      color={Colors.primary[600]}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  const mapRegion =
    stops.length > 0 && stops[0].jobsite.lat && stops[0].jobsite.lng
      ? {
          latitude: stops[0].jobsite.lat,
          longitude: stops[0].jobsite.lng,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }
      : {
          latitude: 33.4484,
          longitude: -112.074,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        };

  const polylineCoords = stops
    .filter((s) => s.jobsite.lat && s.jobsite.lng)
    .map((s) => ({
      latitude: s.jobsite.lat!,
      longitude: s.jobsite.lng!,
    }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.routeName}>
              {route?.name ?? "No Route Today"}
            </Text>
            <Text style={styles.completedCount}>
              {completedCount}/{stops.length} completed
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() =>
                setViewMode(viewMode === "list" ? "map" : "list")
              }
              style={styles.viewToggle}
            >
              <Ionicons
                name={viewMode === "list" ? "map-outline" : "list-outline"}
                size={20}
                color={Colors.primary[600]}
              />
            </TouchableOpacity>
            {stops.length > 0 && (
              <Button
                title="Start Route"
                onPress={startRoute}
                size="sm"
                haptic
              />
            )}
          </View>
        </View>
      </View>

      {stops.length === 0 && !loading ? (
        <EmptyState
          icon="car-outline"
          title="No Stops Today"
          subtitle="Your route is empty for today. Pull down to refresh."
        />
      ) : viewMode === "list" ? (
        <FlatList
          data={stops}
          keyExtractor={(item) => item.id}
          renderItem={renderStop}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={Colors.primary[600]}
            />
          }
        />
      ) : (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {stops.map((stop, index) => {
              if (!stop.jobsite.lat || !stop.jobsite.lng) return null;
              return (
                <Marker
                  key={stop.id}
                  coordinate={{
                    latitude: stop.jobsite.lat,
                    longitude: stop.jobsite.lng,
                  }}
                  title={`${index + 1}. ${stop.jobsite.name}`}
                  description={stop.jobsite.address_line1}
                  pinColor={VisitStatusColors[stop.status]}
                  onCalloutPress={() => router.push(`/visit/${stop.id}`)}
                />
              );
            })}
            {polylineCoords.length > 1 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor={Colors.primary[600]}
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeName: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 18,
  },
  completedCount: {
    color: "#6b7280",
    fontSize: 14,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewToggle: {
    backgroundColor: "#ecfeff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopCard: {
    marginBottom: 12,
    marginHorizontal: 16,
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  stopHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  stopIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stopIndexText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16,
  },
  stopAddress: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 2,
  },
  stopHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  expandedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  expandedRowStart: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  expandedText: {
    color: "#374151",
    fontSize: 14,
    marginLeft: 8,
  },
  expandedTextFlex: {
    flex: 1,
  },
  equipmentSection: {
    marginBottom: 12,
  },
  equipmentLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  equipmentItem: {
    color: "#4b5563",
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionButtonFlex: {
    flex: 1,
  },
  navigateButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
