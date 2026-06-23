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
  useListPracticeAreaCounties,
  getListAttorneysQueryKey,
  getListPracticeAreaCountiesQueryKey,
} from "@workspace/api-client-react";
import {
  attorneyPath,
  countyPath,
  statePath,
  practiceAreaCountyPath,
  practiceAreaPath,
  slugify,
  absoluteUrl,
  truncate,
  faqPageLd,
} from "@/lib/seo";
import { FaqSection } from "@/components/faq-section";
import { practiceAreaCountyIntro } from "@/lib/seo-content";

export default function PracticeAreaCountyPage({
  params,
}: {
  params: { state: string; county: string; area: string };
}) {
  const [, setLocation] = useLocation();

  const { data: combos, isLoading: loadingCombos } =
    useListPracticeAreaCounties({
      query: { queryKey: getListPracticeAreaCountiesQueryKey() },
    });

  // Resolve the slugs back to the canonical state + county + practice area via
  // the index, then query attorneys by exact (case-insensitive) names.
  const match = combos?.find(
    (c) =>
      slugify(c.state) === params.state &&
      slugify(c.county) === params.county &&
      slugify(c.practiceArea) === params.area,
  );

  const listParams = match
    ? {
        state: match.state,
        county: match.county,
        practiceArea: match.practiceArea,
      }
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

  if (loadingCombos) {
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
          title="No listings here yet | Caseway"
          description="We couldn't find attorneys for that practice area and location."
          noindex
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32 gap-5">
          <h1 className="font-serif text-4xl font-medium text-foreground">
            No listings here yet
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            We don't have any attorneys listed for that practice area and area
            yet. Try searching from the homepage.
          </p>
          <Button asChild className="rounded-full px-8 mt-2">
            <Link href="/">Find a Lawyer</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const { state, county, practiceArea } = match;
  const canonical = absoluteUrl(
    practiceAreaCountyPath(state, county, practiceArea),
  );
  const countyHeading = `${county}, ${state}`;
  const count = attorneys?.length ?? match.count;
  const metaTitle = `${practiceArea} Attorneys in ${county}, ${state} | Caseway`;
  const metaDescription = truncate(
    `Browse ${count} ${practiceArea} ${
      count === 1 ? "attorney" : "attorneys"
    } serving ${county}, ${state}. Compare experience and fees, then book a consultation directly on Caseway.`,
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
      {
        "@type": "ListItem",
        position: 3,
        name: countyHeading,
        item: absoluteUrl(countyPath(state, county)),
      },
      { "@type": "ListItem", position: 4, name: practiceArea, item: canonical },
    ],
  };

  const faqItems = [
    {
      question: `How do I find a ${practiceArea} attorney in ${countyHeading}?`,
      answer: `Browse ${practiceArea} attorneys serving ${countyHeading} on Caseway. Compare their experience and fees, then contact them directly or book a free consultation.`,
    },
    {
      question: `How much does a ${practiceArea} lawyer cost in ${county}?`,
      answer: `Costs depend on the complexity of your case and the attorney's experience. Many ${practiceArea} attorneys on Caseway list their fees and offer a free initial consultation, so you can compare before reaching out.`,
    },
    {
      question: `Is Caseway free to use?`,
      answer: `Yes. Searching for and contacting ${practiceArea} attorneys on Caseway is completely free for people looking for legal help.`,
    },
    {
      question: `Is Caseway a law firm?`,
      answer: `No. Caseway is a directory and discovery platform that helps you find independent and solo attorneys. It is not a law firm or lawyer referral service and does not provide legal advice.`,
    },
  ];
  const faqLd = faqPageLd(faqItems);

  const introParas = practiceAreaCountyIntro(practiceArea, county, state);
  const otherAreas = (combos ?? [])
    .filter(
      (c) =>
        c.state === state &&
        c.county === county &&
        c.practiceArea !== practiceArea,
    )
    .map((c) => c.practiceArea);

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
            {countyHeading}
          </Link>
          <ChevronRight className="h-4 w-4 text-border" />
          <span className="text-foreground font-medium">{practiceArea}</span>
        </nav>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-5 shadow-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {countyHeading}
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-4">
            {practiceArea} Attorneys in {county}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {count > 0
              ? `Browse ${count} ${practiceArea} ${
                  count === 1 ? "attorney" : "attorneys"
                } serving ${county}, ${state}. Compare experience, fees, and availability, then reach out directly.`
              : `We're still building our ${practiceArea} directory for ${county}, ${state}. Check back soon, or search from the homepage.`}
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
              Be the first to list your {practiceArea} practice in {county}.
            </p>
            <Button asChild className="rounded-full px-8">
              <Link href="/signup">List Your Practice</Link>
            </Button>
          </div>
        )}

        <section className="mt-16 pt-12 border-t border-border/60">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
            About {practiceArea} attorneys in {county}, {state}
          </h2>
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground">
            {introParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {otherAreas.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              Other practice areas in {county}
            </h2>
            <p className="text-muted-foreground mb-6">
              Find {county} attorneys by the kind of legal help you need.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {otherAreas.map((area) => (
                <Link
                  key={area}
                  href={practiceAreaCountyPath(state, county, area)}
                  className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {area}
                </Link>
              ))}
              <Link
                href={practiceAreaPath(practiceArea)}
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
              >
                {practiceArea} attorneys nationwide
              </Link>
              <Link
                href={countyPath(state, county)}
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
              >
                All attorneys in {county}
              </Link>
            </div>
          </section>
        )}

        <FaqSection items={faqItems} />
      </div>
    </Layout>
  );
}
