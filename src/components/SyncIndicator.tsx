import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../providers/NetworkProvider";
import { Colors } from "../constants/theme";

export function SyncIndicator() {
  const { isConnected, syncStatus, pendingCount } = useNetwork();

  if (!isConnected) {
    return (
      <View style={[styles.container, styles.offlineBackground]}>
        <Ionicons name="cloud-offline" size={14} color="white" />
        <Text style={styles.text}>
          Offline — {pendingCount} pending
        </Text>
      </View>
    );
  }

  if (syncStatus === "error") {
    return (
      <View style={[styles.container, styles.errorBackground]}>
        <Ionicons name="warning" size={14} color="white" />
        <Text style={styles.text}>
          Sync error — {pendingCount} pending
        </Text>
      </View>
    );
  }

  if (syncStatus === "pending" || pendingCount > 0) {
    return (
      <View style={[styles.container, styles.pendingBackground]}>
        <Ionicons name="sync" size={14} color="white" />
        <Text style={styles.text}>
          Syncing ({pendingCount})...
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offlineBackground: {
    backgroundColor: "#dc2626",
  },
  errorBackground: {
    backgroundColor: "#ef4444",
  },
  pendingBackground: {
    backgroundColor: Colors.amber[500],
  },
  text: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
});
