import React from "react";
import { View, ViewProps, StyleSheet } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  padding?: boolean;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  padding: {
    padding: 16,
  },
});

export function Card({ children, padding = true, style, ...props }: CardProps) {
  return (
    <View
      style={[styles.card, padding && styles.padding, style]}
      {...props}
    >
      {children}
    </View>
  );
}
