import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Logo } from "@/components/Logo";
import { useColors } from "@/hooks/useColors";
import { useAppInsets } from "@/lib/insets";
import { track } from "@/lib/track";
import { fonts } from "@/lib/typography";

export default function HomeScreen() {
  const c = useColors();
  const insets = useAppInsets();
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);

  const handleContinue = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = location.trim();
    track({ type: "search", query: q || null });
    router.push({ pathname: "/category", params: { location: q } });
  };

  const handleUseLocation = async () => {
    if (Platform.OS === "web") return;
    try {
      setLocating(true);
      Haptics.selectionAsync();
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const city = place?.city ?? place?.subregion ?? place?.region ?? "";
      const region = place?.region ?? "";
      setLocation([city, region].filter(Boolean).join(", "));
    } catch {
      // Ignore failures; user can type manually.
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LinearGradient
        colors={[c.primary, "#1A3F2D"]}
        style={[styles.hero, { paddingTop: insets.top + 28 }]}
      >
        <Logo size={26} color={c.primaryForeground} />

        <View style={styles.heroBody}>
          <Text style={[styles.headline, { color: c.primaryForeground }]}>
            Find your way to the right attorney
          </Text>
          <Text style={[styles.subhead, { color: "#CBD8CF" }]}>
            Answer a couple of plain-language questions and browse trusted solo
            and independent attorneys near you.
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              borderRadius: c.radius,
            },
          ]}
        >
          <Text style={[styles.label, { color: c.foreground }]}>
            Where do you need help?
          </Text>

          <View
            style={[
              styles.inputRow,
              { borderColor: c.input, borderRadius: c.radius - 4 },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color={c.mutedForeground}
            />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="City, county, or ZIP"
              placeholderTextColor={c.mutedForeground}
              style={[styles.input, { color: c.foreground }]}
              returnKeyType="search"
              onSubmitEditing={handleContinue}
              testID="location-input"
            />
          </View>

          {Platform.OS !== "web" ? (
            <Pressable
              onPress={handleUseLocation}
              style={styles.locateBtn}
              disabled={locating}
              testID="use-location"
            >
              {locating ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <Ionicons
                  name="navigate-circle-outline"
                  size={18}
                  color={c.primary}
                />
              )}
              <Text style={[styles.locateText, { color: c.primary }]}>
                Use my current location
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: c.primary,
                borderRadius: c.radius - 4,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            testID="continue-button"
          >
            <Text style={[styles.ctaText, { color: c.primaryForeground }]}>
              Continue
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={c.primaryForeground}
            />
          </Pressable>

          <Text style={[styles.hint, { color: c.mutedForeground }]}>
            Browsing is always free. No account required.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 28,
  },
  heroBody: { gap: 12 },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 40,
  },
  subhead: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -24,
  },
  card: {
    borderWidth: 1,
    padding: 20,
    gap: 14,
    shadowColor: "#142620",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 52,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    height: "100%",
  },
  locateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  locateText: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
  },
  ctaText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
  },
});
