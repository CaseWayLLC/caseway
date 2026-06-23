import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { fonts } from "@/lib/typography";

interface LogoProps {
  size?: number;
  color?: string;
}

export function Logo({ size = 24, color }: LogoProps) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <MaterialCommunityIcons
        name="scale-balance"
        size={size + 4}
        color={c.gold}
      />
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: size,
          color: color ?? c.primary,
          letterSpacing: 0.2,
        }}
      >
        Caseway
      </Text>
    </View>
  );
}
