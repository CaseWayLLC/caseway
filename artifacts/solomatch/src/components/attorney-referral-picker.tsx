import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, X, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useListAttorneys,
  getListAttorneysQueryKey,
  type Attorney,
} from "@workspace/api-client-react";
import { resolvePhotoUrl } from "@/lib/photo";

const MIN_CHARS = 2;
const MAX_RESULTS = 6;

export interface ReferrerSelection {
  id: number;
  fullName: string;
  firmName: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

// Typeahead for picking the attorney who referred a new sign-up. Mirrors the
// look of the landing-page AttorneyNameSearch but, instead of navigating to a
// profile, it returns the chosen attorney to the parent via onSelect and shows
// a selected state with a clear button.
export function AttorneyReferralPicker({
  value,
  onSelect,
}: {
  value: ReferrerSelection | null;
  onSelect: (attorney: ReferrerSelection | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce so we only hit the API after the user pauses typing.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= MIN_CHARS;
  const params = { name: debounced };
  const { data, isFetching } = useListAttorneys(params, {
    query: { enabled, queryKey: getListAttorneysQueryKey(params) },
  });

  const results = useMemo(() => (data ?? []).slice(0, MAX_RESULTS), [data]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(a: Attorney) {
    onSelect({ id: a.id, fullName: a.fullName, firmName: a.firmName });
    setOpen(false);
    setQuery("");
  }

  // Once an attorney is chosen, show a compact confirmation card instead of the
  // search input. The clear button returns to the search state.
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-4 w-4 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {value.fullName}
          </span>
          {value.firmName && (
            <span className="block truncate text-xs text-muted-foreground">
              {value.firmName}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Clear referring attorney"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const showDropdown = open && enabled;

  return (
    <div ref={containerRef} className="relative text-left">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              pick(results[0]);
            }
          }}
          placeholder="Search the attorney who referred you"
          aria-label="Search the attorney who referred you"
          className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-9 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          {results.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => pick(a)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <Avatar className="h-9 w-9 shrink-0 border border-border">
                      <AvatarImage
                        src={resolvePhotoUrl(a.photoUrl)}
                        alt={a.fullName}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-xs font-medium">
                        {initials(a.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {a.fullName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.firmName} &middot; {a.officeAddress.split(",")[0]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {isFetching
                ? "Searching..."
                : `No attorneys match "${debounced}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
