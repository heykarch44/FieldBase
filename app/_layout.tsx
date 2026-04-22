import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/providers/AuthProvider";
import { NetworkProvider } from "../src/providers/NetworkProvider";
import { OrgProvider } from "../src/providers/OrgProvider";
// Registers the TaskManager.defineTask at module evaluation — must be
// imported before any Location.startGeofencingAsync call.
import "../src/lib/backgroundGeofenceTask";
import { useGeofenceRegistration } from "../src/hooks/useGeofenceRegistration";
import { useGeofencePermissions } from "../src/hooks/useGeofencePermissions";

function GeofenceBootstrap({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { background } = useGeofencePermissions();
  useGeofenceRegistration({ enabled: !!session && background });
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NetworkProvider>
          <OrgProvider>
            <GeofenceBootstrap>
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
            </GeofenceBootstrap>
          </OrgProvider>
        </NetworkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
