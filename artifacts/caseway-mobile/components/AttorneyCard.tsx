import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import { useColors } from "@/hooks/useColors";
import { resolvePhotoUrl } from "@/lib/photo";
import { fonts } from "@/lib/typography";
import type { Attorney } from "@workspace/api-client-react";

interface AttorneyCardProps {
  attorney: Attorney;
  onPress: () => void;
}

export function AttorneyCard({ attorney, onPress }: AttorneyCardProps) {
  const c = useColors();
  const photo = resolvePhotoUrl(attorney.photoUrl);

  return (
    <Pressable
      onPress={onPress}
      testID={`attorney-card-${attorney.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderRadius: c.radius,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.row}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: c.secondary },
            ]}
          >
            <Ionicons name="person" size={26} color={c.primary} />
          </View>
        )}

        <View style={styles.headerText}>
          <Text
            style={[styles.name, { color: c.cardForeground }]}
            numberOfLines={1}
          >
            {attorney.fullName}
          </Text>
          <Text
            style={[styles.title, { color: c.mutedForeground }]}
            numberOfLines={1}
          >
            {attorney.title}
          </Text>
          <Text
            style={[styles.firm, { color: c.mutedForeground }]}
            numberOfLines={1}
          >
            {attorney.firmName}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={14} color={c.mutedForeground} />
        <Text
          style={[styles.meta, { color: c.mutedForeground }]}
          numberOfLines={1}
        >
          {attorney.officeAddress}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Ionicons
          name="briefcase-outline"
          size={14}
          color={c.mutedForeground}
        />
        <Text
          style={[styles.meta, { color: c.mutedForeground }]}
          numberOfLines={1}
        >
          {attorney.yearsOfExperience} yrs experience
        </Text>
      </View>

      <View style={styles.badges}>
        {attorney.offersFreeConsultation ? (
          <Badge label="Free consult" icon="checkmark-circle" variant="gold" />
        ) : null}
        {attorney.videoConferencing ? (
          <Badge label="Video calls" icon="videocam" variant="green" />
        ) : null}
        {attorney.practiceAreas.slice(0, 2).map((area) => (
          <Badge key={area} label={area} variant="muted" />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: 18,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  firm: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    flex: 1,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
});
