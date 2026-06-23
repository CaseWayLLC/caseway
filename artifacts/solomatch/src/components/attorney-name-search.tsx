import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useListAttorneys,
  getListAttorneysQueryKey,
  type Attorney,
} from "@workspace/api-client-react";
import { resolvePhotoUrl } from "@/lib/photo";
import { attorneyPath } from "@/lib/seo";
import { useTrack } from "@/lib/analytics";

const MIN_CHARS = 2;
const MAX_RESULTS = 6;

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

// Landing-page typeahead that looks an attorney up directly by name (or firm)
// and jumps to their profile, bypassing the location/category flow.
export function AttorneyNameSearch() {
  const [, navigate] = useLocation();
  const track = useTrack();
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

  function goTo(attorney: Attorney) {
    track({ type: "attorney_view", attorneyId: attorney.id });
    setOpen(false);
    navigate(attorneyPath(attorney));
  }

  const showDropdown = open && enabled;

  return (
    <div ref={containerRef} className="relative text-left">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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
              goTo(results[0]);
            }
          }}
          placeholder="Or search by attorney name"
          aria-label="Search attorneys by name"
          className="w-full h-12 pl-11 pr-10 rounded-xl border border-border bg-background text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear name search"
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
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => goTo(a)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10 border border-border shrink-0">
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
                      <span className="block font-medium text-foreground truncate">
                        {a.fullName}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
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
