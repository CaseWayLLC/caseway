import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import type { Attorney } from "@workspace/api-client-react";
import { SEARCH_RADIUS_MILES, SEARCH_RADIUS_METERS } from "@/lib/geo";

// Fix leaflet marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface AttorneyMapProps {
  attorneys: Attorney[];
  selectedAttorneyId?: number;
  onSelectAttorney: (id: number) => void;
  center?: [number, number];
  searchCenter?: [number, number] | null;
  searchLabel?: string;
}

function MapUpdater({
  center,
  zoom,
  searchCenter,
  radiusMeters,
  selectedAttorneyId,
}: {
  center: [number, number];
  zoom: number;
  searchCenter: [number, number] | null;
  radiusMeters: number;
  selectedAttorneyId?: number;
}) {
  const map = useMap();
  // De-dupe view changes so refetches (new array, same coords) don't snap the
  // map back and fight the user's manual panning. The key encodes the intended
  // view, so transitions (fit <-> fly) still re-trigger.
  const lastView = useRef<string | null>(null);

  useEffect(() => {
    // On a fresh search with nothing focused, frame the ENTIRE search circle.
    // A fixed zoom can't guarantee that — on a portrait phone the circle spills
    // past the top/bottom. fitBounds with padding clears the fixed header (top)
    // and the collapsed mobile results sheet that covers the lower ~40% of the map.
    if (searchCenter && !selectedAttorneyId) {
      const key = `fit:${searchCenter[0].toFixed(5)},${searchCenter[1].toFixed(5)}`;
      if (lastView.current === key) return;
      const isFirst = lastView.current === null;
      lastView.current = key;
      const bounds = L.latLng(searchCenter[0], searchCenter[1]).toBounds(
        radiusMeters * 2,
      );
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const paddingTopLeft = isMobile ? L.point(28, 150) : L.point(56, 56);
      const paddingBottomRight = isMobile
        ? L.point(28, Math.round(vh * 0.44))
        : L.point(56, 56);
      map.fitBounds(bounds, {
        paddingTopLeft,
        paddingBottomRight,
        animate: !isFirst,
        duration: 0.8,
      });
      return;
    }

    // Otherwise (an attorney is focused, or there's no search) fly to the point.
    const [lat, lng] = center;
    const key = `fly:${lat.toFixed(6)},${lng.toFixed(6)},${zoom}`;
    if (lastView.current === key) return;
    lastView.current = key;
    map.flyTo(center, zoom, { duration: 0.8, easeLinearity: 0.25 });
  }, [center, zoom, searchCenter, radiusMeters, selectedAttorneyId, map]);
  return null;
}

export function AttorneyMap({
  attorneys,
  selectedAttorneyId,
  onSelectAttorney,
  center = [39.8283, -98.5795],
  searchCenter,
  searchLabel,
}: AttorneyMapProps) {
  const mapCenter = useMemo(() => {
    if (selectedAttorneyId) {
      const selected = attorneys.find((a) => a.id === selectedAttorneyId);
      if (selected)
        return [selected.latitude, selected.longitude] as [number, number];
    }
    if (searchCenter) return searchCenter;
    if (attorneys.length > 0) {
      return [attorneys[0].latitude, attorneys[0].longitude] as [
        number,
        number,
      ];
    }
    return center;
  }, [selectedAttorneyId, attorneys, center, searchCenter]);

  const mapZoom = searchCenter ? 9 : attorneys.length > 0 ? 11 : 4;

  const customIcon = new L.DivIcon({
    className: "bg-transparent border-none",
    html: `<div class="relative flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full shadow-lg border-[3px] border-white cursor-pointer transition-transform hover:scale-125"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"/><path d="m16 16 6-6-2.5-2.5L22 5l-5-5-2.5 2.5L8 8l6 6z"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const selectedIcon = new L.DivIcon({
    className: "bg-transparent border-none",
    html: `<div class="relative flex items-center justify-center w-10 h-10 bg-gold text-gold-foreground rounded-full shadow-xl border-[3px] border-white z-50 transition-transform scale-125"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"/><path d="m16 16 6-6-2.5-2.5L22 5l-5-5-2.5 2.5L8 8l6 6z"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  const searchIcon = new L.DivIcon({
    className: "bg-transparent border-none",
    html: `<div class="flex items-center justify-center w-9 h-9 bg-gold text-gold-foreground rounded-full shadow-xl border-[3px] border-white"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  return (
    <div className="h-full w-full bg-muted overflow-hidden relative z-0">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        {/* Top-right so the +/- controls clear the header's back button on mobile */}
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapUpdater
          center={mapCenter}
          zoom={mapZoom}
          searchCenter={searchCenter ?? null}
          radiusMeters={SEARCH_RADIUS_METERS}
          selectedAttorneyId={selectedAttorneyId}
        />
        {searchCenter && (
          <>
            <Circle
              center={searchCenter}
              radius={SEARCH_RADIUS_METERS}
              pathOptions={{
                color: "hsl(40, 55%, 53%)",
                fillColor: "hsl(40, 55%, 53%)",
                fillOpacity: 0.08,
                weight: 1.5,
              }}
            />
            <Marker
              position={searchCenter}
              icon={searchIcon}
              zIndexOffset={1000}
            >
              {searchLabel && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -20]}
                  className="caseway-search-tooltip"
                >
                  {searchLabel}
                </Tooltip>
              )}
              <Popup className="rounded-xl shadow-xl border-0 overflow-hidden font-sans">
                <div className="p-2 min-w-[140px]">
                  <p className="font-serif font-semibold text-base text-foreground">
                    {searchLabel ?? "Your search area"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Within {SEARCH_RADIUS_MILES} miles
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}
        {attorneys.map((attorney) => (
          <Marker
            key={attorney.id}
            position={[attorney.latitude, attorney.longitude]}
            icon={
              selectedAttorneyId === attorney.id ? selectedIcon : customIcon
            }
            eventHandlers={{
              click: () => onSelectAttorney(attorney.id),
            }}
          >
            <Popup className="rounded-xl shadow-xl border-0 overflow-hidden font-sans">
              <div className="p-2 min-w-[160px]">
                <p className="font-serif font-semibold text-base mb-1 text-foreground">
                  {attorney.fullName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {attorney.firmName}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
