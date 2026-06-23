import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";

// Fix leaflet marker icons (same asset wiring as attorney-map).
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface PinMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  zoom?: number;
}

// Keeps the map view centered on the current coordinates when they change
// from outside (e.g. geocoding the address or picking a Places suggestion),
// without fighting the user's manual panning.
function RecenterOnChange({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  const last = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const [lat, lng] = center;
    const prev = last.current;
    const unchanged =
      prev !== null &&
      Math.abs(prev.lat - lat) < 1e-6 &&
      Math.abs(prev.lng - lng) < 1e-6;
    if (unchanged) return;
    last.current = { lat, lng };
    map.setView(center, map.getZoom() < zoom ? zoom : map.getZoom(), {
      animate: true,
    });
  }, [center, zoom, map]);
  return null;
}

function ClickToPlace({
  onChange,
}: {
  onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// The map often mounts inside a hidden (display:none) wizard step, so Leaflet
// measures a 0x0 container and renders gray/broken tiles until it's resized.
// A ResizeObserver fires when the step becomes visible, letting us recompute
// the size so tiles paint correctly on first view.
function InvalidateOnVisible() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    // A couple of deferred passes catch the initial show + layout settle.
    const t1 = setTimeout(() => map.invalidateSize(), 0);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    return () => {
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

export function PinMap({
  latitude,
  longitude,
  onChange,
  zoom = 14,
}: PinMapProps) {
  const center = useMemo<[number, number]>(
    () => [latitude, longitude],
    [latitude, longitude],
  );
  const markerRef = useRef<L.Marker>(null);

  return (
    <div className="h-72 w-full overflow-hidden rounded-2xl border border-border/60 bg-muted relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <RecenterOnChange center={center} zoom={zoom} />
        <InvalidateOnVisible />
        <ClickToPlace onChange={onChange} />
        <Marker
          position={center}
          draggable
          ref={markerRef}
          eventHandlers={{
            dragend() {
              const marker = markerRef.current;
              if (!marker) return;
              const { lat, lng } = marker.getLatLng();
              onChange(lat, lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
