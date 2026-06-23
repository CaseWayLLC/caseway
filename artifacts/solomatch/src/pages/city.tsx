import { useState, useEffect, useMemo, Suspense } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, MapPin, Search } from "lucide-react";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo";
import { AttorneyCard } from "@/components/attorney-card";
import { AttorneyMap } from "@/components/attorney-map-lazy";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  useListAttorneys,
  useListCounties,
  getListAttorneysQueryKey,
  getListCountiesQueryKey,
} from "@workspace/api-client-react";
import {
  attorneyPath,
  countyPath,
  statePath,
  cityPath,
  slugify,
  absoluteUrl,
  truncate,
  faqPageLd,
} from "@/lib/seo";
import { FaqSection } from "@/components/faq-section";
import { distanceMiles } from "@/lib/geo";
import { US_STATES } from "@/lib/constants";

interface Town {
  name: string;
  lat: number;
  lng: number;
}

const CITY_RADIUS_MILES = 25;

function useTowns(abbr: string | undefined) {
  const [towns, setTowns] = useState<Town[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!abbr) return;
    setLoading(true);
    fetch(`/towns/${abbr}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Town[]) => setTowns(data))
      .catch(() => setTowns([]))
      .finally(() => setLoading(false));
  }, [abbr]);

  return { towns, loading };
}

export default function CityPage({
  params,
}: {
  params: { state: string; county: string; city: string };
}) {
  const [, setLocation] = useLocation();

  const { data: counties, isLoading: loadingCounties } = useListCounties({
    query: { queryKey: getListCountiesQueryKey() },
  });

  const match = counties?.find(
    (c) =>
      slugify(c.state) === params.state && slugify(c.county) === params.county,
  );

  const stateName = match?.state;
  const countyName = match?.county;
  const stateAbbr = stateName
    ? US_STATES.find((s) => slugify(s.name) === slugify(stateName))?.abbr
    : undefined;

  const { towns, loading: loadingTowns } = useTowns(stateAbbr);

  const cityTown = useMemo(() => {
    if (!towns) return null;
    return towns.find((t) => slugify(t.name) === params.city) ?? null;
  }, [towns, params.city]);

  const listParams = match
    ? { state: match.state, county: match.county }
    : undefined;

  const { data: attorneys, isLoading: loadingAttorneys } = useListAttorneys(
    listParams ?? {},
    {
      query: {
        enabled: Boolean(listParams),
        queryKey: getListAttorneysQueryKey(listParams ?? {}),
      },
    },
  );

  const nearbyAttorneys = useMemo(() => {
    if (!cityTown || !attorneys) return [];
    const origin: [number, number] = [cityTown.lat, cityTown.lng];
    return attorneys
      .filter((a) => {
        if (a.latitude == null || a.longitude == null) return false;
        return (
          distanceMiles(origin, [a.latitude, a.longitude]) <= CITY_RADIUS_MILES
        );
      })
      .sort((a, b) => {
        const da = distanceMiles(origin, [a.latitude!, a.longitude!]);
        const db = distanceMiles(origin, [b.latitude!, b.longitude!]);
        return da - db;
      });
  }, [cityTown, attorneys]);

  if (loadingCounties || loadingTowns) {
    return (
      <Layout>
        <div className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-6 md:px-10 pt-28 md:pt-32 pb-24">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-12 w-96 mb-10" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className="overflow-hidden border-border/50 rounded-2xl"
                >
                  <CardContent className="p-6 flex gap-5">
                    <Skeleton className="h-20 w-20 rounded-full shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-5 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!match || !cityTown) {
    return (
      <Layout>
        <Seo
          title="City not found | Caseway"
          description="We couldn't find attorneys for that city."
          noindex
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32 gap-5">
          <h1 className="font-serif text-4xl font-medium text-foreground">
            No listings here yet
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            We don't have any attorneys listed for that city yet. Try searching
            from the homepage.
          </p>
          <Button asChild className="rounded-full px-8 mt-2">
            <Link href="/">Find a Lawyer</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const { state, county } = match;
  const city = cityTown.name;
  const count = nearbyAttorneys.length;
  const canonical = absoluteUrl(cityPath(state, county, city));
  const metaTitle = `Attorneys in ${city}, ${county}, ${state} | Caseway`;
  const metaDescription = truncate(
    `Browse ${count} independent and solo attorneys near ${city}, ${county}, ${state}. Compare practice areas, experience, and fees, then book a consultation directly on Caseway.`,
  );

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: metaTitle,
    description: metaDescription,
    url: canonical,
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: nearbyAttorneys.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(attorneyPath(a)),
      name: a.fullName,
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: state,
        item: absoluteUrl(statePath(state)),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${county}, ${state}`,
        item: absoluteUrl(countyPath(state, county)),
      },
      {
        "@type": "ListItem",
        position: 4,
        name: city,
        item: canonical,
      },
    ],
  };

  const faqItems = [
    {
      question: `How do I find an attorney near ${city}?`,
      answer: `Browse independent and solo attorneys within ${CITY_RADIUS_MILES} miles of ${city}, ${county} on Caseway. Compare practice areas, experience, and fees, then contact a lawyer directly or book a free consultation.`,
    },
    {
      question: `How much does it cost to hire a lawyer in ${city}?`,
      answer: `Fees vary by practice area, the complexity of your case, and the attorney's experience. Many attorneys on Caseway list their consultation fees and offer a free initial consultation, so you can compare before reaching out.`,
    },
    {
      question: `Is Caseway free for people looking for a lawyer?`,
      answer: `Yes. Searching for and contacting attorneys on Caseway is completely free. Caseway is a directory and discovery platform, not a law firm or lawyer referral service, and it does not provide legal advice.`,
    },
    {
      question: `Are the attorneys on Caseway independent?`,
      answer: `Yes. Caseway focuses on solo and independent attorneys. Each listing is reviewed before it goes live, but you should always confirm an attorney's credentials and bar standing directly before hiring.`,
    },
  ];
  const faqLd = faqPageLd(faqItems);

  return (
    <Layout>
      <Seo
        title={metaTitle}
        description={metaDescription}
        canonical={canonical}
        jsonLd={[collectionLd, itemListLd, breadcrumbLd, faqLd]}
      />

      <div className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-6 md:px-10 pt-28 md:pt-32 pb-24">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-8"
        >
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <ChevronRight className="h-4 w-4 text-border" />
          <Link
            href={statePath(state)}
            className="hover:text-primary transition-colors"
          >
            {state}
          </Link>
          <ChevronRight className="h-4 w-4 text-border" />
          <Link
            href={countyPath(state, county)}
            className="hover:text-primary transition-colors"
          >
            {county}
          </Link>
          <ChevronRight className="h-4 w-4 text-border" />
          <span className="text-foreground font-medium">{city}</span>
        </nav>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-5 shadow-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {county}, {state}
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-4">
            Attorneys in {city}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {count > 0
              ? `Browse ${count} independent and solo ${
                  count === 1 ? "attorney" : "attorneys"
                } near ${city}, ${county}, ${state}. Compare experience, practice areas, and fees, then reach out directly.`
              : `We're still building our directory for ${city}, ${county}. Check back soon, or search from the homepage.`}
          </p>
        </header>

        {loadingAttorneys ? (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className="overflow-hidden border-border/50 rounded-2xl"
                >
                  <CardContent className="p-6 flex gap-5">
                    <Skeleton className="h-20 w-20 rounded-full shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-5 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        ) : nearbyAttorneys.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-5">
              {nearbyAttorneys.map((attorney) => (
                <AttorneyCard
                  key={attorney.id}
                  attorney={attorney}
                  onClick={() => setLocation(attorneyPath(attorney))}
                />
              ))}
            </div>
            <div className="md:sticky md:top-28 h-[400px] md:h-[560px] rounded-2xl overflow-hidden border border-border/60 shadow-sm">
              <Suspense fallback={<div className="h-full w-full bg-muted/50" />}>
                <AttorneyMap
                  attorneys={nearbyAttorneys}
                  onSelectAttorney={(id) => {
                    const a = nearbyAttorneys.find((x) => x.id === id);
                    if (a) setLocation(attorneyPath(a));
                  }}
                />
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="text-center p-12 bg-card rounded-3xl border border-dashed border-border shadow-sm">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-5">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-2xl font-medium mb-3 text-foreground">
              No attorneys listed yet
            </h2>
            <p className="text-base text-muted-foreground mb-6">
              Be the first to list your practice in {city}, {county}.
            </p>
            <Button asChild className="rounded-full px-8">
              <Link href="/signup">List Your Practice</Link>
            </Button>
          </div>
        )}

        <section className="mt-16 pt-12 border-t border-border/60">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
            Browse other cities
          </h2>
          <p className="text-muted-foreground mb-6">
            See more towns and cities in {county}, {state}.
          </p>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border/60 px-7"
          >
            <Link href={countyPath(state, county)}>
              All attorneys in {county}
            </Link>
          </Button>
        </section>

        <FaqSection items={faqItems} />
      </div>
    </Layout>
  );
}
