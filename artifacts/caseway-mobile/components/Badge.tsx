import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { fonts } from "@/lib/typography";

interface BadgeProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "gold" | "green" | "muted";
}

export function Badge({ label, icon, variant = "muted" }: BadgeProps) {
  const c = useColors();

  const palette = {
    gold: { bg: c.goldSoft, fg: c.goldForeground },
    green: { bg: c.secondary, fg: c.primary },
    muted: { bg: c.muted, fg: c.mutedForeground },
  }[variant];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={palette.fg} /> : null}
      <Text style={[styles.text, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
});
