import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/providers/AuthProvider";
import { NetworkProvider } from "../src/providers/NetworkProvider";
import { OrgProvider } from "../src/providers/OrgProvider";


export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NetworkProvider>
          <OrgProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="auth/login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="visit/[id]"
                options={{
                  headerShown: false,
                  presentation: "card",
                }}
              />
              <Stack.Screen
                name="site/[id]"
                options={{
                  headerShown: false,
                  presentation: "card",
                }}
              />
            </Stack>
          </OrgProvider>
        </NetworkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
