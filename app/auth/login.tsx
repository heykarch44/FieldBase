import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/providers/AuthProvider";
import { Button } from "../../src/components/Button";

export default function LoginScreen() {
  const { signIn, session, user, loading, biometricEnabled, authenticateWithBiometrics } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && session && user) {
      if (user.org_role === "technician" || user.org_role === "admin" || user.org_role === "owner") {
        router.replace("/(tabs)");
      }
    }
  }, [loading, session, user, router]);

  useEffect(() => {
    if (session && biometricEnabled) {
      handleBiometricLogin();
    }
  }, [session, biometricEnabled]);

  const handleBiometricLogin = async () => {
    const success = await authenticateWithBiometrics();
    if (success && user && (user.org_role === "technician" || user.org_role === "admin" || user.org_role === "owner")) {
      router.replace("/(tabs)");
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setSigningIn(true);
    const { error } = await signIn(email.trim(), password);
    setSigningIn(false);

    if (error) {
      Alert.alert("Login Failed", error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0d9488" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="white" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d9488" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 32 }}>
          {/* Logo / Brand */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <View
              style={{
                width: 80,
                height: 80,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="layers" size={48} color="white" />
            </View>
            <Text style={{ color: "white", fontSize: 30, fontWeight: "bold" }}>
              FieldIQ
            </Text>
            <Text style={{ color: "#99f6e4", fontSize: 16, marginTop: 4 }}>
              Field Service Intelligence
            </Text>
          </View>

          {/* Login Form */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text style={{ color: "#1f2937", fontSize: 20, fontWeight: "bold", marginBottom: 24 }}>
              Sign In
            </Text>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: "#4b5563", fontSize: 14, fontWeight: "500", marginBottom: 6 }}>
                Email
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f9fafb",
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                }}
              >
                <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 12, fontSize: 16, color: "#111827" }}
                  placeholder="tech@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: "#4b5563", fontSize: 14, fontWeight: "500", marginBottom: 6 }}>
                Password
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f9fafb",
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                }}
              >
                <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 12, fontSize: 16, color: "#111827" }}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={signingIn}
              size="lg"
            />

            {biometricEnabled && (
              <TouchableOpacity
                onPress={handleBiometricLogin}
                style={{ marginTop: 16, alignItems: "center", paddingVertical: 12 }}
              >
                <Ionicons name="finger-print" size={32} color="#0d9488" />
                <Text style={{ color: "#0d9488", fontSize: 14, fontWeight: "500", marginTop: 4 }}>
                  Use biometrics
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
