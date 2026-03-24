import React from "react";
import { View, Text } from "react-native";
import { VisitStatusColors } from "../constants/theme";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const LABELS: Record<string, string> = {
  scheduled: "Upcoming",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const color = VisitStatusColors[status] ?? "#9ca3af";
  const label = LABELS[status] ?? status;
  const isSmall = size === "sm";

  return (
    <View
      style={{
        backgroundColor: color + "20",
        borderColor: color,
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: isSmall ? 8 : 12,
        paddingVertical: isSmall ? 2 : 4,
      }}
    >
      <Text
        style={{
          color,
          fontWeight: "600",
          fontSize: isSmall ? 12 : 14,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
