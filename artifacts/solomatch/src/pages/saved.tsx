import { useState } from "react";
import { Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import {
  getAttorney,
  getGetAttorneyQueryKey,
  type Attorney,
} from "@workspace/api-client-react";
import {
  Bookmark,
  LayoutGrid,
  Columns3,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo";
import { AttorneyCard } from "@/components/attorney-card";
import { AttorneyProfilePanel } from "@/components/attorney-profile-panel";
import { AttorneyCompareTable } from "@/components/attorney-compare-table";
import { Button } from "@/components/ui/button";
import { useSavedAttorneys } from "@/lib/saved-attorneys";
import { cn } from "@/lib/utils";

export default function SavedPage() {
  const { savedIds, count, remove, clear } = useSavedAttorneys();
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<number | null>(
    null,
  );
  const [view, setView] = useState<"grid" | "compare">("grid");

  const results = useQueries({
    queries: savedIds.map((id) => ({
      queryKey: getGetAttorneyQueryKey(id),
      queryFn: () => getAttorney(id),
      staleTime: 30_000,
      // A saved listing may have been removed/unpublished — don't retry those,
      // so they drop from the list promptly instead of stalling the page.
      retry: false,
    })),
  });

  // A saved listing may have been removed or unpublished — those error out and
  // simply drop from the list rather than blocking the rest.
  const attorneys = results
    .map((r) => r.data)
    .filter((a): a is Attorney => Boolean(a));
  const isLoading = count > 0 && results.some((r) => r.isLoading);

  return (
    <Layout solidHeader>
      <Seo
        title="Saved lawyers — Caseway"
        description="Your shortlist of saved attorneys on Caseway. Compare experience, practice areas, fees, and more side by side."
        noindex
      />
      <div className="container mx-auto max-w-6xl px-4 pb-20 pt-28">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Saved lawyers
          </h1>
          <p className="mt-2 text-muted-foreground">
            {count === 0
              ? "Shortlist attorneys as you browse, then compare them here."
              : `You've saved ${count} ${
                  count === 1 ? "attorney" : "attorneys"
                }. Compare them side by side before reaching out.`}
          </p>
        </header>

        {count === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="inline-flex rounded-full border border-border/60 bg-card p-1">
                <ViewToggle
                  active={view === "grid"}
                  onClick={() => setView("grid")}
                  icon={<LayoutGrid className="h-4 w-4" />}
                  label="List"
                />
                <ViewToggle
                  active={view === "compare"}
                  onClick={() => setView("compare")}
                  icon={<Columns3 className="h-4 w-4" />}
                  label="Compare"
                />
              </div>
              <Button
                variant="ghost"
                onClick={clear}
                className="gap-2 font-medium text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                Loading your saved lawyers…
              </div>
            ) : attorneys.length === 0 ? (
              <UnavailableState />
            ) : view === "grid" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {attorneys.map((a) => (
                  <AttorneyCard
                    key={a.id}
                    attorney={a}
                    onClick={(id) => setSelectedAttorneyId(id)}
                  />
                ))}
              </div>
            ) : (
              <AttorneyCompareTable
                attorneys={attorneys}
                onRemove={remove}
                onView={(id) => setSelectedAttorneyId(id)}
              />
            )}
          </>
        )}
      </div>

      <AttorneyProfilePanel
        id={selectedAttorneyId}
        onClose={() => setSelectedAttorneyId(null)}
        onSelectSimilar={(id) => setSelectedAttorneyId(id)}
      />
    </Layout>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/50 px-6 py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bookmark className="h-8 w-8" />
      </div>
      <h2 className="mb-2 font-serif text-2xl text-foreground">
        No saved lawyers yet
      </h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        Tap the bookmark on any attorney to add them to your shortlist. Your
        list is saved on this device — no account needed.
      </p>
      <Button asChild className="rounded-full px-8">
        <Link href="/">
          Find a lawyer <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function UnavailableState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/50 px-6 py-20 text-center">
      <p className="max-w-md text-muted-foreground">
        The lawyers you saved aren't available right now. They may have updated
        or removed their listing.
      </p>
    </div>
  );
}
