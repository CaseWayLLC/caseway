import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { fonts } from "@/lib/typography";
import type { Attorney } from "@workspace/api-client-react";

export type AttorneyMapProps = {
  attorneys: Attorney[];
  pinColor: string;
  onSelect: (id: number) => void;
};

// react-native-maps has no web implementation, so the web preview shows a
// tappable location list instead. The interactive map renders on native (Expo Go).
export function AttorneyMap({
  attorneys,
  pinColor,
  onSelect,
}: AttorneyMapProps) {
  const c = useColors();
  return (
    <View style={[styles.wrap, { backgroundColor: c.muted }]}>
      <View style={styles.note}>
        <Ionicons name="map-outline" size={18} color={c.mutedForeground} />
        <Text style={[styles.noteText, { color: c.mutedForeground }]}>
          Open the app on your phone for the interactive map
        </Text>
      </View>
      <FlatList
        data={attorneys}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item.id)}
            style={[
              styles.row,
              {
                backgroundColor: c.card,
                borderColor: c.border,
                borderRadius: c.radius - 4,
              },
            ]}
          >
            <Ionicons name="location" size={18} color={pinColor} />
            <View style={styles.rowText}>
              <Text
                style={[styles.name, { color: c.foreground }]}
                numberOfLines={1}
              >
                {item.fullName}
              </Text>
              <Text
                style={[styles.firm, { color: c.mutedForeground }]}
                numberOfLines={1}
              >
                {item.officeAddress || item.firmName}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={c.mutedForeground}
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  noteText: { fontFamily: fonts.medium, fontSize: 13, textAlign: "center" },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  rowText: { flex: 1 },
  name: { fontFamily: fonts.semibold, fontSize: 15 },
  firm: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
