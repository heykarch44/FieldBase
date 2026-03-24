import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  haptic?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  haptic = false,
}: ButtonProps) {
  const handlePress = async () => {
    if (haptic) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const variantStyle = {
    primary: styles.variantPrimary,
    secondary: styles.variantSecondary,
    danger: styles.variantDanger,
    outline: styles.variantOutline,
  }[variant];

  const textVariantStyle = {
    primary: styles.textVariantWhite,
    secondary: styles.textVariantWhite,
    danger: styles.textVariantWhite,
    outline: styles.textVariantAqua,
  }[variant];

  const sizeStyle = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  }[size];

  const textSizeStyle = {
    sm: styles.textSizeSm,
    md: styles.textSizeMd,
    lg: styles.textSizeLg,
  }[size];

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        variantStyle,
        sizeStyle,
        disabled ? styles.disabled : styles.enabled,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" ? "#0891b2" : "white"}
          size="small"
        />
      ) : (
        <View style={styles.innerRow}>
          {icon}
          <Text style={[styles.textBase, textVariantStyle, textSizeStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // Variants
  variantPrimary: {
    backgroundColor: "#0891b2",
  },
  variantSecondary: {
    backgroundColor: "#4b5563",
  },
  variantDanger: {
    backgroundColor: "#dc2626",
  },
  variantOutline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#0891b2",
  },
  // Sizes (padding)
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  sizeLg: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  // Opacity states
  disabled: {
    opacity: 0.5,
  },
  enabled: {
    opacity: 1,
  },
  // Inner row
  innerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Text base
  textBase: {
    fontWeight: "bold",
    textAlign: "center",
  },
  // Text variant colors
  textVariantWhite: {
    color: "white",
  },
  textVariantAqua: {
    color: "#0891b2",
  },
  // Text sizes (Tailwind: sm=14, base=16, lg=18)
  textSizeSm: {
    fontSize: 14,
  },
  textSizeMd: {
    fontSize: 16,
  },
  textSizeLg: {
    fontSize: 18,
  },
});
