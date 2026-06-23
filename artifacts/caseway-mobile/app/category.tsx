import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { CATEGORIES, type Category } from "@/lib/constants";
import { useAppInsets } from "@/lib/insets";
import { track } from "@/lib/track";
import { fonts } from "@/lib/typography";

export default function CategoryScreen() {
  const c = useColors();
  const insets = useAppInsets();
  const router = useRouter();
  const { location } = useLocalSearchParams<{ location?: string }>();

  const handleSelect = (category: Category) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track({
      type: "category_select",
      category: category.value,
      query: location || null,
    });
    router.push({
      pathname: "/results",
      params: { location: location ?? "", category: category.value },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: c.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          testID="back-button"
        >
          <Ionicons name="chevron-back" size={26} color={c.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>
          Choose a category
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lead, { color: c.foreground }]}>
          What kind of legal help do you need?
        </Text>
        <Text style={[styles.sub, { color: c.mutedForeground }]}>
          Select the option that best describes your situation.
        </Text>

        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.value}
              onPress={() => handleSelect(cat)}
              testID={`category-${cat.value}`}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: c.card,
                  borderColor: c.border,
                  borderRadius: c.radius,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: c.secondary }]}>
                <Ionicons name={cat.icon} size={24} color={c.primary} />
              </View>
              <Text style={[styles.tileLabel, { color: c.cardForeground }]}>
                {cat.label}
              </Text>
              <Text
                style={[styles.tileDesc, { color: c.mutedForeground }]}
                numberOfLines={1}
              >
                {cat.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 17 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  lead: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  tile: {
    width: "48%",
    borderWidth: 1,
    padding: 16,
    gap: 10,
    minHeight: 132,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19 },
  tileDesc: { fontFamily: fonts.regular, fontSize: 12 },
});
