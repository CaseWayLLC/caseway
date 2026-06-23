import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge } from "@/components/Badge";
import { useColors } from "@/hooks/useColors";
import { useAppInsets } from "@/lib/insets";
import { resolvePhotoUrl } from "@/lib/photo";
import { track } from "@/lib/track";
import { fonts } from "@/lib/typography";
import {
  getGetAttorneyQueryKey,
  getGetSimilarAttorneysQueryKey,
  useGetAttorney,
  useGetSimilarAttorneys,
  type Attorney,
} from "@workspace/api-client-react";

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactRow,
        { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.contactIcon, { backgroundColor: c.secondary }]}>
        <Ionicons name={icon} size={18} color={c.primary} />
      </View>
      <View style={styles.contactText}>
        <Text style={[styles.contactLabel, { color: c.mutedForeground }]}>
          {label}
        </Text>
        <Text
          style={[styles.contactValue, { color: c.foreground }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
    </Pressable>
  );
}

export default function AttorneyDetailScreen() {
  const c = useColors();
  const insets = useAppInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const attorneyId = Number(id);

  const {
    data: attorney,
    isLoading,
    isError,
    refetch,
  } = useGetAttorney(attorneyId, {
    query: {
      enabled: Number.isFinite(attorneyId),
      queryKey: getGetAttorneyQueryKey(attorneyId),
    },
  });
  const { data: similar } = useGetSimilarAttorneys(attorneyId, {
    query: {
      enabled: Number.isFinite(attorneyId),
      queryKey: getGetSimilarAttorneysQueryKey(attorneyId),
    },
  });

  useEffect(() => {
    if (Number.isFinite(attorneyId)) {
      track({ type: "attorney_view", attorneyId });
    }
  }, [attorneyId]);

  const open = async (url: string, eventType?: string) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (eventType) track({ type: eventType, attorneyId });
    try {
      await Linking.openURL(url);
    } catch {
      // No-op if the device can't handle the URL scheme.
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (isError || !attorney) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Ionicons
          name="alert-circle-outline"
          size={40}
          color={c.mutedForeground}
        />
        <Text style={[styles.errTitle, { color: c.foreground }]}>
          Attorney not found
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={[
            styles.retry,
            { backgroundColor: c.primary, borderRadius: c.radius - 4 },
          ]}
        >
          <Text style={[styles.retryText, { color: c.primaryForeground }]}>
            Try again
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.linkBtn}>
          <Text style={[styles.linkText, { color: c.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const photo = resolvePhotoUrl(attorney.photoUrl);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Pressable
        onPress={() => router.back()}
        style={[
          styles.floatingBack,
          { top: insets.top + 8, backgroundColor: c.card },
        ]}
        hitSlop={10}
        testID="back-button"
      >
        <Ionicons name="chevron-back" size={24} color={c.foreground} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.hero,
            { backgroundColor: c.secondary, paddingTop: insets.top + 60 },
          ]}
        >
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
                { backgroundColor: c.card },
              ]}
            >
              <Ionicons name="person" size={48} color={c.primary} />
            </View>
          )}
          <Text style={[styles.name, { color: c.foreground }]}>
            {attorney.fullName}
          </Text>
          <Text style={[styles.title, { color: c.mutedForeground }]}>
            {attorney.title}
          </Text>
          <Text style={[styles.firm, { color: c.primary }]}>
            {attorney.firmName}
          </Text>

          <View style={styles.heroBadges}>
            {attorney.offersFreeConsultation ? (
              <Badge
                label="Free consultation"
                icon="checkmark-circle"
                variant="gold"
              />
            ) : null}
            {attorney.videoConferencing ? (
              <Badge label="Video calls" icon="videocam" variant="green" />
            ) : null}
            <Badge
              label={`${attorney.yearsOfExperience} yrs exp`}
              icon="ribbon"
              variant="muted"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>
            About
          </Text>
          <Text style={[styles.bio, { color: c.mutedForeground }]}>
            {attorney.bio}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>
            Practice areas
          </Text>
          <View style={styles.chips}>
            {attorney.practiceAreas.map((area) => (
              <Badge key={area} label={area} variant="green" />
            ))}
          </View>
        </View>

        {attorney.jurisdictions.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Jurisdictions
            </Text>
            <View style={styles.chips}>
              {attorney.jurisdictions.map((j) => (
                <Badge key={j} label={j} variant="muted" />
              ))}
            </View>
          </View>
        ) : null}

        {attorney.languages.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Languages
            </Text>
            <View style={styles.chips}>
              {attorney.languages.map((l) => (
                <Badge key={l} label={l} variant="muted" />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>
            Contact
          </Text>

          <View style={{ gap: 10, marginTop: 12 }}>
            <ContactRow
              icon="location-outline"
              label="Office"
              value={attorney.officeAddress}
              onPress={() => {}}
            />
            <ContactRow
              icon="call-outline"
              label="Phone"
              value={attorney.phone}
              onPress={() => open(`tel:${attorney.phone}`, "phone_click")}
            />
            <ContactRow
              icon="mail-outline"
              label="Email"
              value={attorney.email}
              onPress={() => open(`mailto:${attorney.email}`, "email_click")}
            />
            {attorney.websiteUrl ? (
              <ContactRow
                icon="globe-outline"
                label="Website"
                value={attorney.websiteUrl}
                onPress={() =>
                  open(attorney.websiteUrl as string, "website_click")
                }
              />
            ) : null}
          </View>
        </View>

        {similar && similar.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Similar attorneys
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
            >
              {similar.map((s: Attorney) => {
                const sPhoto = resolvePhotoUrl(s.photoUrl);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push(`/attorney/${s.id}`)}
                    style={({ pressed }) => [
                      styles.similarCard,
                      {
                        backgroundColor: c.card,
                        borderColor: c.border,
                        borderRadius: c.radius,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    {sPhoto ? (
                      <Image
                        source={{ uri: sPhoto }}
                        style={styles.similarAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.similarAvatar,
                          styles.avatarFallback,
                          { backgroundColor: c.secondary },
                        ]}
                      >
                        <Ionicons name="person" size={22} color={c.primary} />
                      </View>
                    )}
                    <Text
                      style={[styles.similarName, { color: c.foreground }]}
                      numberOfLines={1}
                    >
                      {s.fullName}
                    </Text>
                    <Text
                      style={[styles.similarFirm, { color: c.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {s.firmName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {attorney.calendlyUrl ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: c.card,
              borderTopColor: c.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <Pressable
            onPress={() => open(attorney.calendlyUrl!, "consultation_click")}
            style={({ pressed }) => [
              styles.bookBtn,
              {
                backgroundColor: c.primary,
                borderRadius: c.radius - 4,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            testID="book-consultation"
          >
            <Ionicons name="calendar" size={18} color={c.primaryForeground} />
            <Text style={[styles.bookText, { color: c.primaryForeground }]}>
              {attorney.offersFreeConsultation
                ? "Book free consultation"
                : "Book consultation"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  errTitle: { fontFamily: fonts.serif, fontSize: 18 },
  retry: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 4 },
  retryText: { fontFamily: fonts.semibold, fontSize: 15 },
  linkBtn: { paddingVertical: 8 },
  linkText: { fontFamily: fonts.medium, fontSize: 15 },
  floatingBack: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#142620",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 4,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: { width: 110, height: 110, borderRadius: 55, marginBottom: 12 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.serif, fontSize: 26, textAlign: "center" },
  title: { fontFamily: fonts.medium, fontSize: 15 },
  firm: { fontFamily: fonts.semibold, fontSize: 15, marginTop: 2 },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
  },
  section: { paddingHorizontal: 24, paddingTop: 24 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 19, marginBottom: 12 },
  bio: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  contactIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  contactText: { flex: 1 },
  contactLabel: { fontFamily: fonts.regular, fontSize: 12 },
  contactValue: { fontFamily: fonts.medium, fontSize: 15, marginTop: 1 },
  similarCard: {
    width: 140,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  similarAvatar: { width: 56, height: 56, borderRadius: 28 },
  similarName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    textAlign: "center",
  },
  similarFirm: { fontFamily: fonts.regular, fontSize: 12, textAlign: "center" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
  },
  bookText: { fontFamily: fonts.semibold, fontSize: 16 },
});
