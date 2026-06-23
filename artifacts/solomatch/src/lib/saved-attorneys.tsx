import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Visitor shortlist of attorneys, persisted on the device (no account needed).
// Clients browsing for a lawyer can save candidates as they go, then compare
// them on the /saved page. Stored as a plain array of attorney ids.
const STORAGE_KEY = "caseway:saved-attorneys";
const MAX_SAVED = 50;

function readStored(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normalize defensively: malformed/stale storage shouldn't fan out into a
    // huge query batch or a misleading badge. Keep unique positive integers,
    // capped at MAX_SAVED.
    const seen = new Set<number>();
    const ids: number[] = [];
    for (const v of parsed) {
      if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      ids.push(v);
      if (ids.length >= MAX_SAVED) break;
    }
    return ids;
  } catch {
    return [];
  }
}

interface SavedAttorneysContextValue {
  savedIds: number[];
  count: number;
  isSaved: (id: number) => boolean;
  toggle: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const SavedAttorneysContext = createContext<SavedAttorneysContextValue | null>(
  null,
);

export function SavedAttorneysProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [savedIds, setSavedIds] = useState<number[]>(() => readStored());

  // Persist on every change. Wrapped in try/catch for private-mode / quota.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
    } catch {
      // ignore — saving is best-effort
    }
  }, [savedIds]);

  // Keep multiple tabs of the same device in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSavedIds(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isSaved = useCallback(
    (id: number) => savedIds.includes(id),
    [savedIds],
  );

  const toggle = useCallback((id: number) => {
    setSavedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [id, ...prev].slice(0, MAX_SAVED),
    );
  }, []);

  const remove = useCallback((id: number) => {
    setSavedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => setSavedIds([]), []);

  const value = useMemo<SavedAttorneysContextValue>(
    () => ({
      savedIds,
      count: savedIds.length,
      isSaved,
      toggle,
      remove,
      clear,
    }),
    [savedIds, isSaved, toggle, remove, clear],
  );

  return (
    <SavedAttorneysContext.Provider value={value}>
      {children}
    </SavedAttorneysContext.Provider>
  );
}

export function useSavedAttorneys(): SavedAttorneysContextValue {
  const ctx = useContext(SavedAttorneysContext);
  if (!ctx) {
    throw new Error(
      "useSavedAttorneys must be used within a SavedAttorneysProvider",
    );
  }
  return ctx;
}
