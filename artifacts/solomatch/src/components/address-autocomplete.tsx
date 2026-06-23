import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  geocodeAddress,
  isCityOrNarrowerPrediction,
  loadPlacesLibrary,
  placeInState,
  searchPlacesKeyless,
} from "@/lib/geocode";

interface Suggestion {
  id: string;
  primary: string;
  secondary: string;
  full: string;
  /** Set on Google-backed suggestions; resolved via fetchFields on select. */
  prediction?: google.maps.places.PlacePrediction;
  /** Set on keyless (Photon) suggestions; coordinates are already resolved. */
  coords?: [number, number];
}

type InputProps = React.ComponentProps<typeof Input>;

interface AddressAutocompleteProps extends Omit<
  InputProps,
  "onKeyDown" | "onChange"
> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddressChange: (value: string) => void;
  onSelectPlace?: (place: google.maps.places.Place) => void;
  /**
   * Fired when a keyless (Photon) suggestion is picked. Its coordinates are
   * already resolved, so the parent can set them without a follow-up lookup.
   */
  onSelectCoords?: (coords: [number, number]) => void;
  onEnterSearch?: () => void;
  /**
   * Limit results to towns/cities and finer (street addresses, etc.), hiding
   * broader regions like counties and states. Used by the client search box.
   */
  excludeBroadRegions?: boolean;
  /**
   * Full state name (e.g. "Connecticut") to scope suggestions to. When set,
   * keyless results are biased toward and filtered to that state, and
   * submit-time resolution appends the state so a typed town resolves in-state.
   */
  stateName?: string;
}

export interface AddressAutocompleteHandle {
  /** Resolve the best-matching coordinates for a free-text query via the Places API. */
  resolveCoords: (query: string) => Promise<[number, number] | null>;
}

export const AddressAutocomplete = forwardRef<
  AddressAutocompleteHandle,
  AddressAutocompleteProps
>(function AddressAutocomplete(
  {
    onChange,
    onAddressChange,
    onSelectPlace,
    onSelectCoords,
    onEnterSearch,
    excludeBroadRegions = false,
    stateName,
    ...inputProps
  },
  ref,
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();

  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Monotonic id so only the latest in-flight request can update state.
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadPlacesLibrary().then((lib) => {
      if (!cancelled && lib) placesLibRef.current = lib;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear any pending timers on unmount to avoid setState-after-unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // When the state scope changes, drop any suggestions/dropdown from the prior
  // state (and cancel in-flight requests) so a freshly cleared town field can't
  // reopen stale, out-of-state hits.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestIdRef.current++;
    setSuggestions([]);
    setNoResults(false);
    setOpen(false);
    setActiveIndex(-1);
  }, [stateName]);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      const lib = placesLibRef.current;
      const trimmed = input.trim();
      // Bump the request id up front so any in-flight response (including one that
      // resolves after the input is cleared/shortened) is treated as stale.
      const requestId = ++requestIdRef.current;
      // Google autocomplete works from 2 chars; the keyless service from 3.
      if (trimmed.length < (lib ? 2 : 3)) {
        setSuggestions([]);
        setNoResults(false);
        setOpen(false);
        return;
      }
      // Keyless path: no Google key, so use the OSM/Photon autocomplete service.
      if (!lib) {
        const results = await searchPlacesKeyless(trimmed, {
          excludeBroadRegions,
          stateName,
        });
        if (requestId !== requestIdRef.current) return;
        const mapped: Suggestion[] = results.map((r) => ({
          id: r.id,
          primary: r.primary,
          secondary: r.secondary,
          full: r.full,
          coords: r.coords,
        }));
        setSuggestions(mapped);
        setNoResults(mapped.length === 0);
        setOpen(true);
        setActiveIndex(-1);
        return;
      }
      try {
        if (!tokenRef.current) {
          tokenRef.current = new lib.AutocompleteSessionToken();
        }
        const { suggestions: results } =
          await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            // Bias Google results toward the chosen state when one is set.
            input: stateName ? `${input}, ${stateName}` : input,
            includedRegionCodes: ["us"],
            sessionToken: tokenRef.current,
          });
        // Ignore stale responses that resolved after a newer request started.
        if (requestId !== requestIdRef.current) return;
        const mapped: Suggestion[] = results
          .filter((s) => s.placePrediction)
          .filter(
            (s) =>
              !excludeBroadRegions ||
              isCityOrNarrowerPrediction(s.placePrediction!.types),
          )
          .map((s) => {
            const pp = s.placePrediction!;
            return {
              id: pp.placeId,
              primary: pp.mainText?.text ?? pp.text.text,
              secondary: pp.secondaryText?.text ?? "",
              full: pp.text.text,
              prediction: pp,
            };
          });
        setSuggestions(mapped);
        setNoResults(mapped.length === 0);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setNoResults(false);
        setOpen(false);
      }
    },
    [excludeBroadRegions, stateName],
  );

  const resolveCoords = useCallback(
    (query: string): Promise<[number, number] | null> =>
      // geocodeAddress biases toward AND verifies the chosen state when set.
      geocodeAddress(query, placesLibRef.current, {
        excludeBroadRegions,
        stateName,
      }),
    [excludeBroadRegions, stateName],
  );

  useImperativeHandle(ref, () => ({ resolveCoords }), [resolveCoords]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 220);
  };

  // Keyless (Photon) street suggestions don't carry a house number, but the
  // office-address field requires a building number. If the user already typed a
  // leading building number, keep it on the label the suggestion writes back, so
  // a valid "123 Main St, ..." survives instead of being reduced to "Main St".
  const preserveTypedHouseNumber = (label: string): string => {
    const typed =
      typeof inputProps.value === "string" ? inputProps.value.trim() : "";
    const lead = typed.match(/^\d+[A-Za-z]?/);
    if (lead && !/^\d/.test(label.trim())) {
      return `${lead[0]} ${label.trim()}`;
    }
    return label;
  };

  const selectSuggestion = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    // Keyless suggestions already carry their resolved coordinates.
    if (s.coords) {
      onAddressChange(preserveTypedHouseNumber(s.full));
      onSelectCoords?.(s.coords);
      return;
    }
    if (!s.prediction) {
      onAddressChange(preserveTypedHouseNumber(s.full));
      return;
    }
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({
        fields: stateName
          ? ["formattedAddress", "location", "displayName", "addressComponents"]
          : ["formattedAddress", "location", "displayName"],
      });
      onAddressChange(
        preserveTypedHouseNumber(place.formattedAddress ?? s.full),
      );
      // When scoped to a state, only accept an in-state pick; otherwise leave
      // coords unset so submit-time geocoding re-validates and rejects it.
      if (!stateName || placeInState(place, stateName)) {
        onSelectPlace?.(place);
      }
    } catch {
      onAddressChange(preserveTypedHouseNumber(s.full));
    }
    // Start a fresh billing session after a completed selection.
    tokenRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          void selectSuggestion(suggestions[activeIndex]);
          return;
        }
        setOpen(false);
        onEnterSearch?.();
        return;
      }
    } else if (e.key === "Enter") {
      onEnterSearch?.();
    }
  };

  return (
    <div className="relative flex-1 flex items-center">
      <MapPin className="absolute left-4 w-5 h-5 text-gold z-10 pointer-events-none" />
      <Input
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => (suggestions.length > 0 || noResults) && setOpen(true)}
        onBlur={() => {
          blurTimeoutRef.current = setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && (suggestions.length > 0 || noResults)}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        aria-label="Search by city, town, or street address"
        {...inputProps}
      />
      {open && (suggestions.length > 0 || noResults) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-card border border-border rounded-2xl shadow-2xl shadow-foreground/10 overflow-hidden p-1.5 text-left"
        >
          {noResults && (
            <li
              role="status"
              className="flex items-center gap-3 px-3 py-3 text-sm text-muted-foreground"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              No matching places found
            </li>
          )}
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                if (blurTimeoutRef.current)
                  clearTimeout(blurTimeoutRef.current);
                void selectSuggestion(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
                i === activeIndex ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground truncate">
                  {s.primary}
                </span>
                {s.secondary && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {s.secondary}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
