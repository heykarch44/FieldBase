import React from "react";
import { View, Text, TextInput, TextInputProps, StyleSheet } from "react-native";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  suffix?: string;
}

export function FormInput({ label, error, suffix, ...props }: FormInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, error ? styles.inputError : styles.inputNormal]}
          placeholderTextColor="#9ca3af"
          {...props}
        />
        {suffix && (
          <Text style={styles.suffix}>{suffix}</Text>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    color: "#374151",
    fontWeight: "500",
    fontSize: 14,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  inputNormal: {
    borderColor: "#e5e7eb",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  suffix: {
    color: "#6b7280",
    fontSize: 14,
    marginLeft: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
});
