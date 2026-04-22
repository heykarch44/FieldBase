import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export const ACTIVITY_COLOR_KEYS = [
  "teal",
  "red",
  "orange",
  "amber",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "slate",
] as const;

export type ActivityColorKey = typeof ACTIVITY_COLOR_KEYS[number];

export interface ActivityColor {
  bg: string;
  fg: string;
  soft: string;
}

const COLORS: Record<ActivityColorKey, ActivityColor> = {
  teal:   { bg: "#ccfbf1", fg: "#0f766e", soft: "#f0fdfa" },
  red:    { bg: "#fee2e2", fg: "#b91c1c", soft: "#fef2f2" },
  orange: { bg: "#ffedd5", fg: "#c2410c", soft: "#fff7ed" },
  amber:  { bg: "#fef3c7", fg: "#b45309", soft: "#fffbeb" },
  yellow: { bg: "#fef9c3", fg: "#a16207", soft: "#fefce8" },
  green:  { bg: "#dcfce7", fg: "#15803d", soft: "#f0fdf4" },
  blue:   { bg: "#dbeafe", fg: "#1d4ed8", soft: "#eff6ff" },
  purple: { bg: "#ede9fe", fg: "#6d28d9", soft: "#f5f3ff" },
  pink:   { bg: "#fce7f3", fg: "#be185d", soft: "#fdf2f8" },
  slate:  { bg: "#e2e8f0", fg: "#334155", soft: "#f8fafc" },
};

export function activityColorForKey(color: string | null | undefined): ActivityColor {
  if (color && (ACTIVITY_COLOR_KEYS as readonly string[]).includes(color)) {
    return COLORS[color as ActivityColorKey];
  }
  return COLORS.slate;
}

// Map lucide icon names to Ionicons equivalents
const ICON_MAP: Record<string, IoniconName> = {
  "flag": "flag",
  "alert-triangle": "warning",
  "alert-octagon": "alert-circle",
  "alert-circle": "alert-circle",
  "message-circle": "chatbubble-ellipses",
  "wrench": "construct",
  "sticky-note": "reader",
  "check-circle": "checkmark-circle",
  "x-circle": "close-circle",
  "camera": "camera",
  "phone": "call",
  "clock": "time",
  "calendar": "calendar",
  "map-pin": "location",
  "tool": "build",
  "clipboard": "clipboard",
  "clipboard-check": "clipboard",
  "truck": "car",
  "dollar-sign": "cash",
  "file-text": "document-text",
};

export function activityIconForKey(icon: string | null | undefined): IoniconName {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  return "pulse";
}
