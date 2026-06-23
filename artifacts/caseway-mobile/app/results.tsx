import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AttorneyCard } from "@/components/AttorneyCard";
import { AttorneyMap } from "@/components/AttorneyMap";
import { useColors } from "@/hooks/useColors";
import { PRACTICE_AREAS } from "@/lib/constants";
import { useAppInsets } from "@/lib/insets";
import { fonts } from "@/lib/typography";
import { useListAttorneys, type Attorney } from "@workspace/api-client-react";

type ViewMode = "list" | "map";

export default function ResultsScreen() {
  const c = useColors();
  const insets = useAppInsets();
  const router = useRouter();
  const { location, category } = useLocalSearchParams<{
    location?: string;
    category?: string;
  }>();
  const [mode, setMode] = useState<ViewMode>("list");

  const q = (location ?? "").trim();
  const { data, isLoading, isError, refetch, isRefetching } = useListAttorneys(
    q ? { q } : undefined,
  );

  const attorneys = useMemo<Attorney[]>(() => {
    const all = data ?? [];
    if (!category || !PRACTICE_AREAS[category]) return all;
    const groupAreas = new Set(PRACTICE_AREAS[category]);
    return all.filter((a) =>
      a.practiceAreas.some((area) => groupAreas.has(area)),
    );
  }, [data, category]);

  const openAttorney = (id: number) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.push(`/attorney/${id}`);
  };

  const toggleMode = (next: ViewMode) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setMode(next);
  };

  const mappable = attorneys.filter((a) => a.latitude && a.longitude);

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
        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerTitle, { color: c.foreground }]}
            numberOfLines={1}
          >
            {category ?? "Attorneys"}
          </Text>
          {q ? (
            <Text
              style={[styles.headerSub, { color: c.mutedForeground }]}
              numberOfLines={1}
            >
              near {q}
            </Text>
          ) : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.toolbar, { paddingHorizontal: 20 }]}>
        <Text style={[styles.count, { color: c.mutedForeground }]}>
          {isLoading
            ? "Searching..."
            : `${attorneys.length} attorney${attorneys.length === 1 ? "" : "s"}`}
        </Text>
        <View
          style={[
            styles.segment,
            { backgroundColor: c.muted, borderRadius: 999 },
          ]}
        >
          <Pressable
            onPress={() => toggleMode("list")}
            style={[
              styles.segBtn,
              mode === "list" && { backgroundColor: c.card },
            ]}
            testID="view-list"
          >
            <Ionicons
              name="list"
              size={16}
              color={mode === "list" ? c.primary : c.mutedForeground}
            />
            <Text
              style={[
                styles.segText,
                { color: mode === "list" ? c.primary : c.mutedForeground },
              ]}
            >
              List
            </Text>
          </Pressable>
          <Pressable
            onPress={() => toggleMode("map")}
            style={[
              styles.segBtn,
              mode === "map" && { backgroundColor: c.card },
            ]}
            testID="view-map"
          >
            <Ionicons
              name="map"
              size={16}
              color={mode === "map" ? c.primary : c.mutedForeground}
            />
            <Text
              style={[
                styles.segText,
                { color: mode === "map" ? c.primary : c.mutedForeground },
              ]}
            >
              Map
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline-outline"
            size={40}
            color={c.mutedForeground}
          />
          <Text style={[styles.emptyTitle, { color: c.foreground }]}>
            Couldn&apos;t load attorneys
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
        </View>
      ) : attorneys.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={40} color={c.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: c.foreground }]}>
            No attorneys found
          </Text>
          <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
            Try a different location or category.
          </Text>
        </View>
      ) : mode === "list" ? (
        <FlatList
          data={attorneys}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <AttorneyCard
              attorney={item}
              onPress={() => openAttorney(item.id)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      ) : (
        <AttorneyMap
          attorneys={mappable}
          pinColor={c.primary}
          onSelect={openAttorney}
        />
      )}
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
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 16 },
  headerSub: { fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  count: { fontFamily: fonts.medium, fontSize: 14 },
  segment: { flexDirection: "row", padding: 3 },
  segBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  segText: { fontFamily: fonts.medium, fontSize: 13 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 18 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, textAlign: "center" },
  retry: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 4 },
  retryText: { fontFamily: fonts.semibold, fontSize: 15 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },
});
