import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/providers/AuthProvider";

export default function Index() {
  const { session, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace("/auth/login");
      return;
    }

    if (user && (user.role === "technician" || user.role === "admin")) {
      router.replace("/(tabs)");
    } else {
      router.replace("/auth/login");
    }
  }, [loading, session, user, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="white" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0891b2",
  },
});
