import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/providers/AuthProvider";
import { useNetwork } from "../../src/providers/NetworkProvider";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { Colors } from "../../src/constants/theme";
import Constants from "expo-constants";

export default function ProfileScreen() {
  const {
    user,
    memberships,
    signOut,
    biometricEnabled,
    biometricAvailable,
    toggleBiometric,
  } = useAuth();
  const { isConnected, syncStatus, pendingCount, triggerSync } = useNetwork();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const getSyncStatusLabel = () => {
    if (!isConnected) return { label: "Offline", color: Colors.error, icon: "cloud-offline" as const };
    if (syncStatus === "error") return { label: "Sync Error", color: Colors.error, icon: "warning" as const };
    if (syncStatus === "pending") return { label: `Syncing (${pendingCount})`, color: Colors.amber[600], icon: "sync" as const };
    return { label: "All synced", color: Colors.success, icon: "checkmark-circle" as const };
  };

  const sync = getSyncStatusLabel();

  return (
    <ScrollView style={styles.scrollView}>
      {/* Profile Card */}
      <Card style={styles.profileCard}>
        <View style={styles.profileCenter}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text style={styles.fullName}>
            {user?.full_name ?? "—"}
          </Text>
          <Text style={styles.emailText}>{user?.email ?? "—"}</Text>
          {user?.phone && (
            <Text style={styles.phoneText}>{user.phone}</Text>
          )}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {memberships?.[0]?.role ?? "—"}
            </Text>
          </View>
        </View>
      </Card>

      {/* Sync Status */}
      <Card style={styles.sectionCard}>
        <TouchableOpacity
          onPress={triggerSync}
          style={styles.syncRow}
        >
          <View style={styles.syncLeft}>
            <Ionicons name={sync.icon} size={22} color={sync.color} />
            <View style={styles.syncTextGroup}>
              <Text style={styles.syncTitle}>Sync Status</Text>
              <Text style={[styles.syncLabel, { color: sync.color }]}>
                {sync.label}
              </Text>
            </View>
          </View>
          <Ionicons name="refresh" size={20} color={Colors.gray[400]} />
        </TouchableOpacity>
      </Card>

      {/* Settings */}
      <Text style={styles.sectionHeader}>
        Settings
      </Text>

      <Card style={styles.settingsCard}>
        {biometricAvailable && (
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="finger-print"
                size={22}
                color={Colors.primary[600]}
              />
              <Text style={styles.settingLabel}>
                Biometric Login
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: Colors.gray[300], true: Colors.primary[400] }}
              thumbColor={biometricEnabled ? Colors.primary[600] : Colors.gray[100]}
            />
          </View>
        )}

        <View style={styles.settingRowBordered}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={Colors.primary[600]}
            />
            <Text style={styles.settingLabel}>
              Push Notifications
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: Colors.gray[300], true: Colors.primary[400] }}
            thumbColor={notificationsEnabled ? Colors.primary[600] : Colors.gray[100]}
          />
        </View>
      </Card>

      {/* App Info */}
      <Text style={styles.sectionHeader}>
        About
      </Text>

      <Card style={styles.settingsCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>
            {Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
        <View style={styles.infoRowSpaced}>
          <Text style={styles.infoLabel}>Build</Text>
          <Text style={styles.infoValue}>Expo SDK 54</Text>
        </View>
      </Card>

      {/* Logout */}
      <View style={styles.logoutContainer}>
        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={20} color="white" />}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f9fafb", // gray-50
  },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  profileCenter: {
    alignItems: "center",
    paddingVertical: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    backgroundColor: "#cffafe", // teal-100
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#0891b2", // teal-600
    fontSize: 24,
    fontWeight: "bold",
  },
  fullName: {
    color: "#111827", // gray-900
    fontSize: 20,
    fontWeight: "bold",
  },
  emailText: {
    color: "#6b7280", // gray-500
    fontSize: 14,
  },
  phoneText: {
    color: "#6b7280", // gray-500
    fontSize: 14,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: "#ecfeff", // teal-50
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleText: {
    color: "#0e7490", // teal-700
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  syncLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncTextGroup: {
    marginLeft: 12,
  },
  syncTitle: {
    color: "#111827", // gray-900
    fontWeight: "600",
  },
  syncLabel: {
    fontSize: 14,
  },
  sectionHeader: {
    color: "#6b7280", // gray-500
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  settingsCard: {
    marginHorizontal: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  settingRowBordered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6", // gray-100
    marginTop: 8,
    paddingTop: 16,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingLabel: {
    color: "#111827", // gray-900
    fontWeight: "500",
    marginLeft: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoRowSpaced: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 8,
  },
  infoLabel: {
    color: "#374151", // gray-700
  },
  infoValue: {
    color: "#6b7280", // gray-500
  },
  logoutContainer: {
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 48,
  },
});
