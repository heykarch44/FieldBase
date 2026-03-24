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
    const scheme = Platform.OS === "ios" ? "maps:" : "geo:";
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
    if (firstStop?.customer.lat && firstStop?.customer.lng) {
      openNavigation(
        firstStop.customer.lat,
        firstStop.customer.lng,
        `${firstStop.customer.first_name} ${firstStop.customer.last_name}`
      );
    }
  };

  const completedCount = stops.filter((s) => s.status === "completed").length;

  const renderStop = ({ item }: { item: RouteStop }) => {
    const isExpanded = expandedStop === item.id;
    const address = `${item.customer.address_line1}, ${item.customer.city}`;

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
                <Text style={styles.stopName}>
                  {item.customer.first_name} {item.customer.last_name}
                </Text>
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
              {item.customer.gate_code && (
                <View style={styles.expandedRow}>
                  <Ionicons name="key" size={16} color={Colors.amber[600]} />
                  <Text style={styles.expandedText}>
                    Gate: {item.customer.gate_code}
                  </Text>
                </View>
              )}
              {item.customer.access_notes && (
                <View style={styles.expandedRowStart}>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={Colors.aqua[600]}
                  />
                  <Text style={[styles.expandedText, styles.expandedTextFlex]}>
                    {item.customer.access_notes}
                  </Text>
                </View>
              )}
              <View style={styles.expandedRow}>
                <Ionicons name="water" size={16} color={Colors.aqua[600]} />
                <Text style={[styles.expandedText, styles.capitalizeText]}>
                  {item.customer.pool_type} pool
                  {item.customer.pool_volume_gallons
                    ? ` · ${item.customer.pool_volume_gallons.toLocaleString()} gal`
                    : ""}
                </Text>
              </View>
              {item.equipment.length > 0 && (
                <View style={styles.equipmentSection}>
                  <Text style={styles.equipmentLabel}>Equipment</Text>
                  {item.equipment.map((eq) => (
                    <Text key={eq.id} style={styles.equipmentItem}>
                      {eq.brand} {eq.model} ({eq.equipment_type}) —{" "}
                      {eq.condition}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.actionRow}>
                <View style={styles.actionButtonFlex}>
                  <Button
                    title={item.status === 'completed' ? 'Service Complete' : item.status === 'in_progress' ? 'Continue Service' : 'Start Service'}
                    onPress={() => router.push(`/visit/${item.id}`)}
                    size="sm"
                    variant={item.status === 'completed' ? 'outline' : 'primary'}
                  />
                </View>
                {item.customer.lat && item.customer.lng && (
                  <TouchableOpacity
                    onPress={() =>
                      openNavigation(
                        item.customer.lat!,
                        item.customer.lng!,
                        `${item.customer.first_name} ${item.customer.last_name}`
                      )
                    }
                    style={styles.navigateButton}
                  >
                    <Ionicons
                      name="navigate"
                      size={20}
                      color={Colors.aqua[600]}
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
    stops.length > 0 && stops[0].customer.lat && stops[0].customer.lng
      ? {
          latitude: stops[0].customer.lat,
          longitude: stops[0].customer.lng,
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
    .filter((s) => s.customer.lat && s.customer.lng)
    .map((s) => ({
      latitude: s.customer.lat!,
      longitude: s.customer.lng!,
    }));

  return (
    <View style={styles.container}>
      {/* Header Summary */}
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
                color={Colors.aqua[600]}
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
              tintColor={Colors.aqua[600]}
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
              if (!stop.customer.lat || !stop.customer.lng) return null;
              return (
                <Marker
                  key={stop.id}
                  coordinate={{
                    latitude: stop.customer.lat,
                    longitude: stop.customer.lng,
                  }}
                  title={`${index + 1}. ${stop.customer.first_name} ${stop.customer.last_name}`}
                  description={stop.customer.address_line1}
                  pinColor={VisitStatusColors[stop.status]}
                  onCalloutPress={() => router.push(`/visit/${stop.id}`)}
                />
              );
            })}
            {polylineCoords.length > 1 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor={Colors.aqua[600]}
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
    backgroundColor: "#f9fafb", // gray-50
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6", // gray-100
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeName: {
    color: "#111827", // gray-900
    fontWeight: "700",
    fontSize: 18,
  },
  completedCount: {
    color: "#6b7280", // gray-500
    fontSize: 14,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewToggle: {
    backgroundColor: "#ecfeff", // aqua-50
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
    color: "#111827", // gray-900
    fontWeight: "700",
    fontSize: 16,
  },
  stopAddress: {
    color: "#6b7280", // gray-500
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
    borderTopColor: "#f3f4f6", // gray-100
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
    color: "#374151", // gray-700
    fontSize: 14,
    marginLeft: 8,
  },
  expandedTextFlex: {
    flex: 1,
  },
  capitalizeText: {
    textTransform: "capitalize",
  },
  equipmentSection: {
    marginBottom: 12,
  },
  equipmentLabel: {
    color: "#6b7280", // gray-500
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  equipmentItem: {
    color: "#4b5563", // gray-600
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
    backgroundColor: "#f3f4f6", // gray-100
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
