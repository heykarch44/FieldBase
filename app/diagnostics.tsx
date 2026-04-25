import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
  readDiag,
  clearDiag,
  readSamples,
  clearSamples,
  readSiteOutsideMap,
  type DiagEntry,
  type CachedPosition,
} from "../src/lib/sessionCache";
import { GEOFENCE_TASK } from "../src/lib/backgroundGeofenceTask";
import { LOCATION_TASK } from "../src/lib/backgroundLocationTask";
import { Colors } from "../src/constants/theme";

// Local palette so we don't depend on theme keys that may not exist.
const C = {
  bg: "#f9fafb", // gray-50
  surface: "#ffffff",
  text: "#111827", // gray-900
  textMuted: "#6b7280", // gray-500
  border: "#e5e7eb", // gray-200
  ok: Colors.success,
  err: Colors.error,
  tag: "#b45309", // amber-700
};

interface PermStatus {
  fg: string;
  bg: string;
  geofenceRunning: boolean;
  locationRunning: boolean;
}

function fmtTs(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const mo = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${mo}/${day} ${hh}:${mm}:${ss}`;
}

function ageStr(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3600_000) return `${Math.round(delta / 60_000)}m ago`;
  return `${(delta / 3_600_000).toFixed(1)}h ago`;
}

export default function DiagnosticsScreen() {
  const router = useRouter();
  const [diag, setDiag] = useState<DiagEntry[]>([]);
  const [samples, setSamples] = useState<CachedPosition[]>([]);
  const [outsideMap, setOutsideMap] = useState<Record<string, number>>({});
  const [perms, setPerms] = useState<PermStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [d, s, om] = await Promise.all([
      readDiag(),
      readSamples(),
      readSiteOutsideMap(),
    ]);
    setDiag(d.slice().reverse());
    setSamples(s.slice().reverse());
    setOutsideMap(om as Record<string, number>);

    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      const geofenceRunning =
        await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
      const locationRunning =
        await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
      setPerms({
        fg: fg.status,
        bg: bg.status,
        geofenceRunning,
        locationRunning,
      });
    } catch {
      setPerms(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleClearLog = () => {
    Alert.alert("Clear log?", "This wipes diagnostic log + sample buffer.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearDiag();
          await clearSamples();
          await load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diagnostics</Text>
        <TouchableOpacity
          onPress={handleClearLog}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={22} color={C.err} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          {perms ? (
            <>
              <Row
                k="Foreground location"
                v={perms.fg}
                ok={perms.fg === "granted"}
              />
              <Row
                k="Background location"
                v={perms.bg}
                ok={perms.bg === "granted"}
              />
              <Row
                k="Geofence task"
                v={perms.geofenceRunning ? "running" : "STOPPED"}
                ok={perms.geofenceRunning}
              />
              <Row
                k="Dwell task"
                v={perms.locationRunning ? "running" : "STOPPED"}
                ok={perms.locationRunning}
              />
            </>
          ) : (
            <Text style={styles.muted}>loading…</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            First-outside markers ({Object.keys(outsideMap).length})
          </Text>
          {Object.keys(outsideMap).length === 0 ? (
            <Text style={styles.muted}>none</Text>
          ) : (
            Object.entries(outsideMap).map(([siteId, ts]) => (
              <Row
                key={siteId}
                k={siteId.slice(0, 8) + "…"}
                v={`${fmtTs(ts as number)} (${ageStr(ts as number)})`}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Recent samples ({samples.length})
          </Text>
          {samples.length === 0 ? (
            <Text style={styles.muted}>
              none — dwell tracker is not delivering samples
            </Text>
          ) : (
            samples.slice(0, 10).map((s, i) => (
              <View key={i} style={styles.sampleRow}>
                <Text style={styles.sampleTime}>{fmtTs(s.sampledAt)}</Text>
                <Text style={styles.sampleCoord}>
                  {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                </Text>
                <Text style={styles.sampleAccuracy}>
                  ±{s.accuracyM == null ? "?" : Math.round(s.accuracyM)}m
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event log ({diag.length})</Text>
          {diag.length === 0 ? (
            <Text style={styles.muted}>empty</Text>
          ) : (
            diag.map((e, i) => (
              <View key={i} style={styles.logRow}>
                <Text style={styles.logTime}>{fmtTs(e.ts)}</Text>
                <Text style={styles.logTag}>[{e.tag}]</Text>
                <Text style={styles.logMsg}>{e.msg}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  k,
  v,
  ok,
}: {
  k: string;
  v: string;
  ok?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text
        style={[
          styles.rowVal,
          ok === true && { color: C.ok },
          ok === false && { color: C.err },
        ]}
      >
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  section: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  sectionTitle: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  muted: { color: C.textMuted, fontSize: 13, fontStyle: "italic" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowKey: { color: C.textMuted, fontSize: 13 },
  rowVal: { color: C.text, fontSize: 13 },
  sampleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  sampleTime: { color: C.textMuted, fontSize: 11, flex: 1.2 },
  sampleCoord: { color: C.text, fontSize: 11, flex: 1.6 },
  sampleAccuracy: {
    color: C.text,
    fontSize: 11,
    flex: 0.6,
    textAlign: "right",
  },
  logRow: { flexDirection: "row", paddingVertical: 2 },
  logTime: { color: C.textMuted, fontSize: 10, width: 90 },
  logTag: { color: C.tag, fontSize: 10, width: 70 },
  logMsg: { color: C.text, fontSize: 10, flex: 1 },
});
