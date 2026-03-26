import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/theme";
import { SyncIndicator } from "../../src/components/SyncIndicator";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrg } from "../../src/providers/OrgProvider";

export default function TabLayout() {
  const { routesEnabled } = useOrg();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primary[600] }} edges={["top"]}>
      <SyncIndicator />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary[600],
          tabBarInactiveTintColor: Colors.gray[400],
          tabBarStyle: {
            backgroundColor: "white",
            borderTopColor: Colors.gray[100],
            height: 88,
            paddingBottom: 28,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
          headerStyle: {
            backgroundColor: Colors.primary[600],
          },
          headerTintColor: "white",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: routesEnabled ? "Route" : "Schedule",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={routesEnabled ? "map" : "calendar"}
                size={size}
                color={color}
              />
            ),
            headerTitle: routesEnabled ? "Today's Route" : "My Schedule",
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time" size={size} color={color} />
            ),
            headerTitle: "Visit History",
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
            headerTitle: "Profile & Settings",
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
