import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronsUpDown, MapPin, Loader2, Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Town {
  name: string;
  lat: number;
  lng: number;
}

interface TownComboboxProps {
  /** Two-letter abbreviation of the chosen state (e.g. "CT"), or "" when none. */
  stateAbbr: string;
  /** Full state name, used for placeholder copy (e.g. "Connecticut"). */
  stateName: string;
  /** Selected town name, or "" when none. */
  value: string;
  onSelect: (town: { name: string; coords: [number, number] }) => void;
  disabled?: boolean;
  className?: string;
}

// Cache fetched town lists per state so re-opening or switching back is instant.
const townCache = new Map<string, Town[]>();
const ROW_HEIGHT = 36;

/**
 * Searchable town picker scoped to the selected state. Loads the per-state JSON
 * file generated into public/towns and shows the FULL, browsable list — every
 * town in the state is rendered (virtualized so even 1,000+ town states stay
 * smooth), with coordinates baked in so a pick centers the search instantly (no
 * geocoding round-trip). Typing narrows the list; arrow keys + Enter select.
 */
export function TownCombobox({
  stateAbbr,
  stateName,
  value,
  onSelect,
  disabled,
  className,
}: TownComboboxProps) {
  const [open, setOpen] = useState(false);
  const [towns, setTowns] = useState<Town[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // Monotonic token: bumped on every state change so a slow fetch for a
  // previous state can never overwrite the current list.
  const reqRef = useRef(0);
  // Track the scroll element in STATE (not a ref) so that when the popover
  // mounts its content the virtualizer re-renders and measures the now-in-DOM
  // element — otherwise the list renders blank until the user scrolls.
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setSearch("");
    setActiveIndex(0);
    const id = ++reqRef.current;
    if (!stateAbbr) {
      setTowns([]);
      setLoading(false);
      return;
    }
    const cached = townCache.get(stateAbbr);
    if (cached) {
      setTowns(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTowns([]);
    fetch(`${import.meta.env.BASE_URL}towns/${stateAbbr}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Town[]>) : []))
      .then((data) => {
        townCache.set(stateAbbr, data);
        if (reqRef.current === id) setTowns(data);
      })
      .catch(() => {
        if (reqRef.current === id) setTowns([]);
      })
      .finally(() => {
        if (reqRef.current === id) setLoading(false);
      });
  }, [stateAbbr]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? towns.filter((t) => t.name.toLowerCase().includes(q)) : towns;
  }, [towns, search]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listEl,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Keep the highlighted row within bounds as the filtered list shrinks/grows.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Force a re-measure once the popover is open and the scroll element exists,
  // so the full alphabetical list is visible immediately (no blank-until-scroll).
  useEffect(() => {
    if (!open || !listEl) return;
    const raf = requestAnimationFrame(() => virtualizer.measure());
    return () => cancelAnimationFrame(raf);
  }, [open, listEl, towns, virtualizer]);

  const choose = (t: Town) => {
    onSelect({ name: t.name, coords: [t.lat, t.lng] });
    setSearch("");
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    // Nothing to navigate/select when the list is empty.
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, filtered.length - 1);
      setActiveIndex(next);
      virtualizer.scrollToIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      virtualizer.scrollToIndex(prev);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = filtered[activeIndex];
      if (t) choose(t);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a town"
          disabled={disabled}
          className={cn(
            "h-10 justify-start gap-2 rounded-xl px-3 font-medium text-sm hover-elevate",
            !value && "text-muted-foreground/70",
            className,
          )}
        >
          <MapPin className="w-4 h-4 shrink-0 text-gold" />
          <span className="flex-1 truncate text-left">
            {value ||
              (stateName ? `Town in ${stateName}` : "Pick a state first")}
          </span>
          <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
              // Jump back to the top so the highlighted first match (index 0)
              // is visible — otherwise Enter could select an off-screen row.
              if (listEl) listEl.scrollTop = 0;
            }}
            onKeyDown={onKeyDown}
            placeholder="Search town..."
            aria-label="Search town"
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading towns...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No town found.
          </div>
        ) : (
          <>
            <div
              ref={setListEl}
              role="listbox"
              className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1"
            >
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((vi) => {
                  const t = filtered[vi.index];
                  const isActive = vi.index === activeIndex;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      role="option"
                      aria-selected={value === t.name}
                      onMouseMove={() => setActiveIndex(vi.index)}
                      onClick={() => choose(t)}
                      className={cn(
                        "absolute left-0 top-0 flex w-full items-center gap-2 rounded-sm px-2 text-left text-sm outline-none",
                        isActive && "bg-accent text-accent-foreground",
                      )}
                      style={{
                        height: vi.size,
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === t.name ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {!search.trim() && (
              <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                {filtered.length} town{filtered.length === 1 ? "" : "s"}
                {stateName ? ` in ${stateName}` : ""}
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
