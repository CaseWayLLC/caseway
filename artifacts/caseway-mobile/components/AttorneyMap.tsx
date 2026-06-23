import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { Attorney } from "@workspace/api-client-react";

export type AttorneyMapProps = {
  attorneys: Attorney[];
  pinColor: string;
  onSelect: (id: number) => void;
};

function computeRegion(attorneys: Attorney[]) {
  if (attorneys.length === 0) {
    // Default to Fairfield County, CT (demo data region).
    return {
      latitude: 41.14,
      longitude: -73.26,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }
  const lats = attorneys.map((a) => a.latitude);
  const lngs = attorneys.map((a) => a.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.08, (maxLng - minLng) * 1.5),
  };
}

export function AttorneyMap({
  attorneys,
  pinColor,
  onSelect,
}: AttorneyMapProps) {
  return (
    <View style={styles.wrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={computeRegion(attorneys)}
      >
        {attorneys.map((a) => (
          <Marker
            key={a.id}
            coordinate={{ latitude: a.latitude, longitude: a.longitude }}
            title={a.fullName}
            description={a.firmName}
            pinColor={pinColor}
            onCalloutPress={() => onSelect(a.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden" },
});
