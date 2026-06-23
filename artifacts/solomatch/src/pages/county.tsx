import { Suspense } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, MapPin, Search } from "lucide-react";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo";
import { AttorneyCard } from "@/components/attorney-card";
import { AttorneyMap } from "@/components/attorney-map-lazy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListAttorneys,
  useListCounties,
  useListPracticeAreaCounties,
  getListAttorneysQueryKey,
  getListCountiesQueryKey,
  getListPracticeAreaCountiesQueryKey,
} from "@workspace/api-client-react";
import {
  attorneyPath,
  countyPath,
  statePath,
  cityPath,
  practiceAreaCountyPath,
  slugify,
  absoluteUrl,
  truncate,
  faqPageLd,
} from "@/lib/seo";
import { FaqSection } from "@/components/faq-section";
import { countyIntro } from "@/lib/seo-content";

export default function CountyPage({
  params,
}: {
  params: { state: string; county: string };
}) {
  const [, setLocation] = useLocation();

  const { data: counties, isLoading: loadingCounties } = useListCounties({
    query: { queryKey: getListCountiesQueryKey() },
  });

  // Resolve the slugs back to the canonical state + county names via the
  // counties index, then query attorneys by exact (case-insensitive) name.
  const match = counties?.find(
    (c) =>
      slugify(c.state) === params.state && slugify(c.county) === params.county,
  );

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

  // The (state, county, practice area) index powers the "Browse by practice
  // area" internal links below, filtered to this county.
  const { data: areaCombos } = useListPracticeAreaCounties({
    query: { queryKey: getListPracticeAreaCountiesQueryKey() },
  });

  if (loadingCounties) {
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

  if (!match) {
    return (
      <Layout>
        <Seo
          title="County not found | Caseway"
          description="We couldn't find attorneys for that location."
          noindex
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32 gap-5">
          <h1 className="font-serif text-4xl font-medium text-foreground">
            No listings here yet
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            We don't have any attorneys listed for that area yet. Try searching
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
  // Practice areas available in THIS county, drawn from the visibility-gated
  // index, for the "Browse by practice area" internal links below.
  const practiceAreas = (areaCombos ?? [])
    .filter((c) => c.state === state && c.county === county)
    .map((c) => c.practiceArea);
  const canonical = absoluteUrl(countyPath(state, county));
  const heading = `${county}, ${state}`;
  const count = attorneys?.length ?? match.count;
  const metaTitle = `Attorneys in ${county}, ${state} | Caseway`;
  const metaDescription = truncate(
    `Browse ${count} independent and solo attorneys serving ${county}, ${state}. Compare practice areas, experience, and fees, then book a consultation directly on Caseway.`,
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
    itemListElement: (attorneys ?? []).map((a, i) => ({
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
      { "@type": "ListItem", position: 3, name: heading, item: canonical },
    ],
  };

  const faqItems = [
    {
      question: `How do I find an attorney in ${heading}?`,
      answer: `Browse independent and solo attorneys serving ${heading} on Caseway. Filter by practice area, compare experience and fees, then contact a lawyer directly or book a free consultation.`,
    },
    {
      question: `How much does it cost to hire a lawyer in ${county}?`,
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

  const introParas = countyIntro(county, state);
  const otherCounties = (counties ?? [])
    .filter((c) => c.state === state && c.county !== county)
    .slice(0, 24);

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
          <span className="text-foreground font-medium">{heading}</span>
        </nav>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-5 shadow-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {state}
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-4">
            Attorneys in {county}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {count > 0
              ? `Browse ${count} independent and solo ${
                  count === 1 ? "attorney" : "attorneys"
                } serving ${county}, ${state}. Compare experience, practice areas, and fees, then reach out directly.`
              : `We're still building our directory for ${county}, ${state}. Check back soon, or search from the homepage.`}
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
        ) : attorneys && attorneys.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-5">
              {attorneys.map((attorney) => (
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
                  attorneys={attorneys}
                  onSelectAttorney={(id) => {
                    const a = attorneys.find((x) => x.id === id);
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
              Be the first to list your practice in {county}.
            </p>
            <Button asChild className="rounded-full px-8">
              <Link href="/signup">List Your Practice</Link>
            </Button>
          </div>
        )}

        <section className="mt-16 pt-12 border-t border-border/60">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
            About attorneys in {county}, {state}
          </h2>
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground">
            {introParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {practiceAreas.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              Browse by practice area
            </h2>
            <p className="text-muted-foreground mb-6">
              Find {county} attorneys by the kind of legal help you need.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {practiceAreas.map((area) => (
                <Link
                  key={area}
                  href={practiceAreaCountyPath(state, county, area)}
                  className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {area}
                </Link>
              ))}
            </div>
          </section>
        )}

        {otherCounties.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              More counties in {state}
            </h2>
            <p className="text-muted-foreground mb-6">
              Browse independent and solo attorneys across {state}.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {otherCounties.map((c) => (
                <Link
                  key={c.county}
                  href={countyPath(c.state, c.county)}
                  className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {c.county}
                </Link>
              ))}
              <Link
                href={statePath(state)}
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
              >
                All attorneys in {state}
              </Link>
            </div>
          </section>
        )}

        {attorneys && attorneys.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              Browse by city
            </h2>
            <p className="text-muted-foreground mb-6">
              Find attorneys near specific towns in {county}, {state}.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {Array.from(
                new Set(
                  (attorneys ?? [])
                    .filter((a) => a.city)
                    .map((a) => a.city!),
                ),
              )
                .sort()
                .map((city) => (
                  <Link
                    key={city}
                    href={cityPath(state, county, city)}
                    className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {city}
                  </Link>
                ))}
            </div>
          </section>
        )}

        <FaqSection items={faqItems} />
      </div>
    </Layout>
  );
}
