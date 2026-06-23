import { Layout } from "@/components/layout";
import { AttorneyCard } from "@/components/attorney-card";
import { AttorneyProfilePanel } from "@/components/attorney-profile-panel";
import { MobileResultsSheet } from "@/components/mobile-results-sheet";
import { StateCombobox } from "@/components/state-combobox";
import { TownCombobox } from "@/components/town-combobox";
import { AttorneyNameSearch } from "@/components/attorney-name-search";
import { FaqSection } from "@/components/faq-section";
import {
  useListAttorneys,
  getListAttorneysQueryKey,
} from "@workspace/api-client-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { findCityBySlug } from "@/lib/cities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Scale,
  ArrowRight,
  UserCheck,
  Home as HomeIcon,
  Car,
  Stethoscope,
  Briefcase,
  Building,
  ShieldAlert,
  ScrollText,
  Globe,
  Activity,
  Loader2,
} from "lucide-react";
import { DISCOVERY_QUESTIONS } from "@/lib/discovery";
import { PRACTICE_AREAS, US_STATES } from "@/lib/constants";
import { distanceMiles, SEARCH_RADIUS_MILES } from "@/lib/geo";
import { useTrack } from "@/lib/analytics";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import heroScale from "@assets/golden-justice-scale_1781611708653.jpg";

// Leaflet + react-leaflet are ~150KB and the map only renders after a search,
// never on the initial landing view. Lazy-load it so the SEO landing critical
// path doesn't pay for the mapping stack up front.
const AttorneyMap = lazy(() =>
  import("@/components/attorney-map").then((m) => ({ default: m.AttorneyMap })),
);

// Map string icon names to Lucide components
const ICONS: Record<string, React.ElementType> = {
  Home: HomeIcon,
  Car: Car,
  Bandage: Activity,
  Stethoscope: Stethoscope,
  Briefcase: Briefcase,
  Building: Building,
  UserCheck: UserCheck,
  ShieldAlert: ShieldAlert,
  ScrollText: ScrollText,
  Globe: Globe,
};

// Home FAQ — keep these questions/answers in sync with the static FAQPage
// JSON-LD in index.html so non-JS crawlers and answer engines read the same Q&A.
const HOME_FAQ = [
  {
    question: "What is Caseway?",
    answer:
      "Caseway is a directory and discovery platform that helps you find solo and independent attorneys across the United States. Pick a state and town, choose a legal category, and browse matching lawyers on an interactive map with their practice areas, fees, and contact details.",
  },
  {
    question: "How do I find an attorney on Caseway?",
    answer:
      "Choose your state and town, select the kind of legal help you need, and Caseway shows matching attorneys near you on a map. Open any profile to see practice areas, languages, and fees, then contact the lawyer directly or book a free consultation.",
  },
  {
    question: "Is Caseway free to use?",
    answer:
      "Yes. Searching for and contacting attorneys on Caseway is completely free for people looking for legal help.",
  },
  {
    question: "Does Caseway provide legal advice?",
    answer:
      "No. Caseway is a directory and discovery platform, not a law firm or lawyer referral service, and it does not provide legal advice. Always confirm an attorney's credentials and bar standing directly before hiring.",
  },
  {
    question: "How can attorneys list their practice on Caseway?",
    answer:
      "Solo and independent attorneys can create a listing from the sign-up page. Listings are reviewed before they go live so clients searching in your area can find and contact you.",
  },
];

// Forward navigation (dir >= 0) slides the outgoing step up and out and brings
// the next step in from below; going back (dir < 0) mirrors it so the two
// directions always feel like reverses of each other. The live direction is fed
// in through AnimatePresence's `custom` so the EXIT of the leaving step matches
// the chosen direction, not the one it entered with.
// Asymmetric timing: the outgoing step accelerates away fast (ease-in, 0.2s) so
// the mode="wait" gap is barely there, then the incoming step settles in with a
// slower ease-out (0.4s). A symmetric same-speed swap is what read as a "weird
// load" — a slow fade-out then slow fade-in looks like a page reload.
const slideVariants: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    y: dir >= 0 ? 24 : -24,
  }),
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir >= 0 ? -14 : 14,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  }),
};

// The results step is a pure cross-fade — a full-screen Leaflet map is far too
// expensive to translate, and fading avoids a per-frame map repaint. Inner
// content (the attorney list) supplies its own gentle reveal.
const mapVariants: Variants = {
  enter: { opacity: 0 },
  center: {
    opacity: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

export default function Home() {
  const [step, setStep] = useState<"landing" | "question" | "results">(
    "landing",
  );
  // Navigation direction for the step transitions: 1 = forward (deeper into the
  // flow), -1 = back. Drives the shared slide variants above.
  const [direction, setDirection] = useState(1);
  const [selectedState, setSelectedState] = useState("");
  const [locationStr, setLocationStr] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [selectedAttorneyId, setSelectedAttorneyId] = useState<number | null>(
    null,
  );
  const [searchCoords, setSearchCoords] = useState<[number, number] | null>(
    null,
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  // Town name backing the picker's selected value; locationStr holds the full
  // "Town, State" label shown in the results header / map / tracking.
  const [selectedTown, setSelectedTown] = useState("");

  // Two-letter code for the chosen state — selects which town file to load.
  const selectedStateAbbr = useMemo(
    () => US_STATES.find((s) => s.name === selectedState)?.abbr ?? "",
    [selectedState],
  );

  const track = useTrack();

  // Single entry point for moving between flow steps so the transition direction
  // is always set in lockstep with the step it animates to.
  const navStep = (next: typeof step, dir: number) => {
    setDirection(dir);
    setStep(next);
  };

  // Deep link from the footer "Browse by city" shortcuts: /?city=<slug> pre-fills
  // the location (with hardcoded coords) and jumps straight to the category step.
  const search = useSearch();
  const [, navigate] = useLocation();
  useEffect(() => {
    const citySlug = new URLSearchParams(search).get("city");
    if (!citySlug) return;
    const city = findCityBySlug(citySlug);
    if (!city) return;
    const label = `${city.name}, ${city.state}`;
    track({ type: "search", query: label });
    setSelectedAttorneyId(null);
    setLocationStr(label);
    setSearchCoords(city.coords);
    navStep("question", 1);
    navigate("/", { replace: true });
  }, [search]);

  // The category selection should always start at the very top, regardless of
  // how far the user had scrolled the landing page before searching.
  useEffect(() => {
    if (step === "question") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [step]);

  // When we have resolved coordinates we filter by distance client-side (see
  // below), so we fetch the whole approved directory rather than text-matching
  // the location string — a city like "Trumbull" rarely appears verbatim in a
  // nearby attorney's address. Without coords (e.g. no Maps key) we fall back
  // to the server-side text search.
  const listParams = {
    q: searchCoords ? undefined : locationStr || undefined,
  };
  const { data: allAttorneys, isLoading: loadingAttorneys } = useListAttorneys(
    listParams,
    {
      query: {
        enabled: step === "results" || step === "question",
        queryKey: getListAttorneysQueryKey(listParams),
      },
    },
  );

  const attorneys = useMemo(() => {
    if (!allAttorneys) return allAttorneys;
    let list = allAttorneys;
    if (selectedCategory) {
      const groupAreas = PRACTICE_AREAS[selectedCategory] ?? [];
      if (groupAreas.length > 0) {
        list = list.filter((a) =>
          a.practiceAreas.some((p) => groupAreas.includes(p)),
        );
      }
    }
    // Keep only attorneys inside the search radius (matches the circle drawn on
    // the map) and order them nearest-first.
    if (searchCoords) {
      list = list
        .map((a) => ({
          a,
          d: distanceMiles(searchCoords, [a.latitude, a.longitude]),
        }))
        .filter((x) => x.d <= SEARCH_RADIUS_MILES)
        // Ranking (mirrors the server order): Pro (paid) listings first, then
        // top referrers (the referral reward), then nearest. The radius filter
        // above keeps a referral boost from surfacing far-away attorneys.
        .sort(
          (x, y) =>
            Number(y.a.isPro) - Number(x.a.isPro) ||
            (y.a.referralCount ?? 0) - (x.a.referralCount ?? 0) ||
            x.d - y.d,
        )
        .map((x) => x.a);
    }
    return list;
  }, [allAttorneys, selectedCategory, searchCoords]);

  const handleStartSearch = () => {
    if (!selectedState) {
      setLocationError("Pick a state first.");
      return;
    }
    // Picking a town from the list always sets coords, so a missing value means
    // the user hasn't chosen a town yet.
    if (!searchCoords) {
      setLocationError("Pick a town from the list.");
      return;
    }
    setSelectedAttorneyId(null);
    setLocationError(null);
    track({ type: "search", query: locationStr });
    navStep("question", 1);
  };

  const handleSelectCategory = (value: string) => {
    track({
      type: "category_select",
      category: value,
      query: locationStr.trim() || null,
    });
    setSelectedCategory(value);
    navStep("results", 1);
  };

  const handleSelectAttorney = (id: number) => {
    track({ type: "attorney_view", attorneyId: id });
    setSelectedAttorneyId(id);
  };

  const countLabel = loadingAttorneys
    ? "Searching directory..."
    : `${attorneys?.length || 0} Attorneys Found`;

  const resultsList = loadingAttorneys ? (
    <div className="space-y-5 md:space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="overflow-hidden border-border/50 rounded-2xl">
          <CardContent className="p-5 md:p-8 flex gap-4 md:gap-6">
            <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-full shrink-0" />
            <div className="flex-1 space-y-4 py-1">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-6 w-full mt-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : attorneys && attorneys.length > 0 ? (
    <div className="space-y-5 md:space-y-6 pb-2 md:pb-6">
      {attorneys.map((attorney) => (
        <AttorneyCard
          key={attorney.id}
          attorney={attorney}
          onClick={handleSelectAttorney}
          selected={selectedAttorneyId === attorney.id}
        />
      ))}
    </div>
  ) : (
    <div className="text-center p-6 md:p-12 mt-2 md:mt-8 bg-card rounded-3xl border border-dashed border-border shadow-sm">
      <div className="w-14 h-14 md:w-20 md:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
        <Search className="w-7 h-7 md:w-10 md:h-10 text-muted-foreground" />
      </div>
      <h3 className="font-serif text-2xl md:text-3xl font-medium mb-2 md:mb-3 text-foreground tracking-tight">
        No attorneys found
      </h3>
      <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8">
        Try adjusting your location or category to see more results.
      </p>
      <Button
        variant="outline"
        size="lg"
        onClick={() => navStep("landing", -1)}
        className="shadow-sm rounded-full px-8"
      >
        Start New Search
      </Button>
    </div>
  );

  return (
    <Layout
      hideFooter={step === "results"}
      hideAuthNav={step === "results" || step === "question"}
      solidHeader={step === "results"}
      fullWidthHeader={step === "results"}
      onBack={step === "results" ? () => navStep("question", -1) : undefined}
      onLogoClick={() => navStep("landing", -1)}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {step === "landing" && (
          <motion.div
            key="landing"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex-1 flex flex-col w-full relative"
          >
            <div className="relative min-h-screen flex flex-col">
              <div className="absolute inset-0 z-0 overflow-hidden bg-background">
                <img
                  src={heroScale}
                  alt="Golden balance scale of justice"
                  fetchPriority="high"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover object-left opacity-[0.12] md:opacity-100"
                />
                {/* Legibility wash: fade the image into the clean background on the right */}
                <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-background/60 to-background md:from-transparent md:via-background/10 md:to-background" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
              </div>

              <div className="flex-1 flex flex-col justify-center px-5 sm:px-6 md:px-12 lg:px-20 w-full max-w-7xl mx-auto relative z-10 pt-24 pb-12 md:py-16">
                {/* Fade only — the step container provides the single slide.
                    A second translate here would compound with it, and moving a
                    backdrop-blur card re-samples the backdrop every frame. */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full md:max-w-lg lg:max-w-xl md:ml-auto text-center md:text-left bg-card/95 backdrop-blur-sm border border-border rounded-[1.75rem] shadow-xl shadow-foreground/5 p-6 sm:p-8 md:p-8"
                >
                  <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-background/70 backdrop-blur px-4 py-2 mb-5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-gold" />
                    <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Trusted independent attorneys
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-medium tracking-tight mb-4 text-foreground leading-[1.08]">
                    Find your way to the{" "}
                    <span className="text-gold italic">right</span> attorney.
                  </h1>

                  <p className="text-sm sm:text-base text-muted-foreground mb-6 font-normal leading-relaxed">
                    Facing a legal issue is overwhelming. We connect you
                    directly with trustworthy, independent lawyers who can
                    actually help.
                  </p>

                  <div className="w-full relative">
                    <div className="flex flex-col gap-2 bg-background border border-border rounded-2xl p-1.5 shadow-sm">
                      <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        <StateCombobox
                          value={selectedState}
                          onChange={(state) => {
                            setSelectedState(state);
                            // Town belongs to the previous state — clear it so the
                            // next pick is scoped to the new state.
                            setSelectedTown("");
                            setLocationStr("");
                            setSearchCoords(null);
                            setLocationError(null);
                          }}
                          className="w-full sm:flex-1"
                        />
                        <div className="hidden sm:block w-px self-stretch bg-border/70 my-1" />
                        <TownCombobox
                          stateAbbr={selectedStateAbbr}
                          stateName={selectedState}
                          value={selectedTown}
                          disabled={!selectedState}
                          onSelect={({ name, coords }) => {
                            setSelectedTown(name);
                            setLocationStr(`${name}, ${selectedState}`);
                            setSearchCoords(coords);
                            setLocationError(null);
                          }}
                          className="w-full sm:flex-1"
                        />
                      </div>
                      <Button
                        size="lg"
                        className="w-full h-10 text-sm font-semibold shadow-md hover-elevate rounded-xl transition-all duration-300"
                        onClick={handleStartSearch}
                        disabled={!selectedState || !searchCoords}
                      >
                        Find lawyers <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
                    {locationError && (
                      <p
                        role="alert"
                        className="mt-3 ml-1 text-sm text-destructive text-left"
                      >
                        {locationError}
                      </p>
                    )}
                  </div>

                  {/* Secondary path: jump straight to a known attorney by name */}
                  <div className="mt-4">
                    <AttorneyNameSearch />
                  </div>

                  <div className="flex flex-nowrap justify-center md:justify-start items-center gap-5 sm:gap-6 md:gap-8 mt-7 pt-6 border-t border-border">
                    <div className="flex flex-col items-center md:items-start">
                      <span className="text-2xl md:text-3xl font-serif font-medium text-foreground mb-0.5">
                        100k+
                      </span>
                      <span className="text-[10px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.16em]">
                        Independent Lawyers
                      </span>
                    </div>
                    <div className="h-10 w-px bg-border"></div>
                    <div className="flex flex-col items-center md:items-start">
                      <span className="text-2xl md:text-3xl font-serif font-medium text-foreground mb-0.5">
                        50
                      </span>
                      <span className="text-[10px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.16em]">
                        States Covered
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="bg-background px-5 sm:px-6 md:px-12 lg:px-20 w-full max-w-7xl mx-auto pb-24">
              <FaqSection
                items={HOME_FAQ}
                title="Questions about finding an attorney"
              />
            </div>
          </motion.div>
        )}

        {step === "question" && (
          <motion.div
            key="question"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex-1 flex flex-col items-center px-5 sm:px-6 pb-10 max-w-5xl mx-auto w-full pt-24 md:pt-32 relative z-10"
          >
            <div className="w-full text-center mb-10 md:mb-16">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navStep("landing", -1)}
                className="mb-6 md:mb-10 text-muted-foreground hover:text-foreground group rounded-full px-6"
              >
                <ArrowRight className="w-4 h-4 mr-2 rotate-180 group-hover:-translate-x-1 transition-transform" />{" "}
                Back to location
              </Button>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-serif font-medium mb-6 text-foreground tracking-tight">
                What kind of legal help do you need?
              </h2>
              <p className="text-muted-foreground text-xl md:text-2xl">
                Select the category that best describes your situation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-4xl">
              {DISCOVERY_QUESTIONS[0].options.map((option) => {
                const IconComponent =
                  ICONS[option.icon as keyof typeof ICONS] || Scale;
                return (
                  <div key={option.value}>
                    <Button
                      variant="outline"
                      className="w-full h-auto p-6 md:p-8 flex justify-start items-center gap-6 hover:border-primary/40 hover:bg-card text-left transition-all duration-300 shadow-sm hover:shadow-xl bg-card border-border/60 group rounded-2xl"
                      onClick={() => handleSelectCategory(option.value)}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors border border-primary/5">
                        <IconComponent className="w-7 h-7 text-primary" />
                      </div>
                      <span className="font-medium text-xl whitespace-normal break-words text-foreground group-hover:text-primary transition-colors">
                        {option.label}
                      </span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === "results" && (
          <motion.div
            key="results"
            variants={mapVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="h-screen flex flex-col md:flex-row overflow-hidden relative"
          >
            {/* Desktop sidebar list */}
            <div className="hidden md:flex md:flex-col md:w-[500px] lg:w-[650px] border-r border-border/50 bg-background/95 backdrop-blur-xl md:h-auto z-10 shadow-2xl relative">
              <div className="px-8 pb-8 pt-24 border-b border-border/50 flex flex-col gap-6 shrink-0 bg-card">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navStep("question", -1)}
                    className="shrink-0 h-12 w-12 rounded-full hover:bg-muted shadow-sm"
                  >
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <div className="flex-1 bg-muted/40 border border-border/60 rounded-full px-6 py-3 flex items-center gap-3 text-base text-muted-foreground shadow-inner">
                    <span className="font-medium text-foreground">
                      {locationStr}
                    </span>
                    <span className="text-border">&bull;</span>
                    <span className="truncate">{selectedCategory}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm px-2">
                  <span className="font-medium text-muted-foreground tracking-wide uppercase text-xs">
                    {countLabel}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-8 bg-muted/20">
                {resultsList}
              </div>
            </div>

            {/* Map — full-screen behind the sheet on mobile, a column on desktop */}
            <div className="absolute inset-0 md:static md:flex-1 md:h-auto z-0 bg-muted/50">
              <div className="relative w-full h-full">
                {attorneys && (
                  <Suspense fallback={<div className="absolute inset-0 bg-muted/50" />}>
                    <AttorneyMap
                      attorneys={attorneys}
                      selectedAttorneyId={selectedAttorneyId || undefined}
                      onSelectAttorney={handleSelectAttorney}
                      searchCenter={searchCoords}
                      searchLabel={locationStr}
                    />
                  </Suspense>
                )}
                {loadingAttorneys && (
                  <div className="absolute inset-0 z-[5] flex items-center justify-center bg-background/40 backdrop-blur-[2px] pointer-events-none">
                    <div className="flex items-center gap-3 rounded-full bg-card/95 border border-border/60 px-5 py-3 shadow-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        Updating map...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile floating search summary (over the map) */}
            <div className="md:hidden absolute top-0 left-0 right-0 z-20 pt-[5.5rem] px-4 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navStep("question", -1)}
                  className="shrink-0 h-12 w-12 rounded-full bg-background shadow-lg border border-border/60 flex items-center justify-center"
                  aria-label="Refine search"
                >
                  <Search className="h-5 w-5 text-muted-foreground" />
                </button>
                <div className="flex-1 min-w-0 bg-background shadow-lg border border-border/60 rounded-full px-5 py-3 flex items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground truncate">
                    {locationStr}
                  </span>
                  <span className="text-border shrink-0">&bull;</span>
                  <span className="truncate text-muted-foreground">
                    {selectedCategory}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile bottom sheet (Zillow-style) */}
            <MobileResultsSheet countLabel={countLabel}>
              {resultsList}
            </MobileResultsSheet>

            {/* Profile Overlay */}
            <AttorneyProfilePanel
              id={selectedAttorneyId}
              onClose={() => setSelectedAttorneyId(null)}
              onSelectSimilar={handleSelectAttorney}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
