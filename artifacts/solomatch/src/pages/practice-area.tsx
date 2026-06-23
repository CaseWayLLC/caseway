import { Link, useLocation } from "wouter";
import { ChevronRight, Scale, Search } from "lucide-react";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo";
import { AttorneyCard } from "@/components/attorney-card";
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
  practiceAreaCountyPath,
  practiceAreaPath,
  directoryPath,
  slugify,
  absoluteUrl,
  truncate,
  faqPageLd,
} from "@/lib/seo";
import { FaqSection } from "@/components/faq-section";
import { practiceAreaIntro } from "@/lib/seo-content";

// How many attorney cards to surface on the nationwide hub before pointing
// people to the location list to narrow down.
const MAX_CARDS = 12;

export default function PracticeAreaPage({
  params,
}: {
  params: { area: string };
}) {
  const [, setLocation] = useLocation();

  const { data: combos, isLoading: loadingCombos } =
    useListPracticeAreaCounties({
      query: { queryKey: getListPracticeAreaCountiesQueryKey() },
    });

  // Resolve the slug back to the canonical practice-area name via the index.
  const practiceArea = combos?.find(
    (c) => slugify(c.practiceArea) === params.area,
  )?.practiceArea;

  const listParams = practiceArea ? { practiceArea } : undefined;

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
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
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
        </div>
      </Layout>
    );
  }

  if (!practiceArea) {
    return (
      <Layout>
        <Seo
          title="No listings here yet | Caseway"
          description="We couldn't find attorneys for that practice area."
          noindex
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32 gap-5">
          <h1 className="font-serif text-4xl font-medium text-foreground">
            No listings here yet
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            We don't have any attorneys listed for that practice area yet. Try
            searching from the homepage.
          </p>
          <Button asChild className="rounded-full px-8 mt-2">
            <Link href="/">Find a Lawyer</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const locations = (combos ?? [])
    .filter((c) => c.practiceArea === practiceArea)
    .sort(
      (a, b) =>
        a.state.localeCompare(b.state) || a.county.localeCompare(b.county),
    );
  const count = attorneys?.length ?? 0;
  const cards = (attorneys ?? []).slice(0, MAX_CARDS);

  const canonical = absoluteUrl(practiceAreaPath(practiceArea));
  const metaTitle = `${practiceArea} Attorneys Near You | Caseway`;
  const metaDescription = truncate(
    `Find independent and solo ${practiceArea} attorneys across the United States. Compare experience and fees, then book a consultation directly on Caseway.`,
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
    itemListElement: cards.map((a, i) => ({
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
        name: "Directory",
        item: absoluteUrl(directoryPath),
      },
      { "@type": "ListItem", position: 3, name: practiceArea, item: canonical },
    ],
  };

  const faqItems = [
    {
      question: `How do I find a ${practiceArea} attorney near me?`,
      answer: `Browse ${practiceArea} attorneys on Caseway, then narrow by your county to find lawyers serving your area. Open any profile to compare experience and fees, then contact the lawyer directly or book a free consultation.`,
    },
    {
      question: `How much does a ${practiceArea} lawyer cost?`,
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

  const introParas = practiceAreaIntro(practiceArea);

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
            href={directoryPath}
            className="hover:text-primary transition-colors"
          >
            Directory
          </Link>
          <ChevronRight className="h-4 w-4 text-border" />
          <span className="text-foreground font-medium">{practiceArea}</span>
        </nav>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-5 shadow-sm">
            <Scale className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Nationwide
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-4">
            {practiceArea} Attorneys
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {count > 0
              ? `Browse independent and solo ${practiceArea} ${
                  count === 1 ? "attorney" : "attorneys"
                } across the United States. Compare experience and fees, then reach out directly.`
              : `We're still building our ${practiceArea} directory. Check back soon, or search from the homepage.`}
          </p>
        </header>

        {loadingAttorneys ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
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
        ) : cards.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {cards.map((attorney) => (
              <AttorneyCard
                key={attorney.id}
                attorney={attorney}
                onClick={() => setLocation(attorneyPath(attorney))}
              />
            ))}
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
              Be the first to list your {practiceArea} practice on Caseway.
            </p>
            <Button asChild className="rounded-full px-8">
              <Link href="/signup">List Your Practice</Link>
            </Button>
          </div>
        )}

        <section className="mt-16 pt-12 border-t border-border/60">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
            About {practiceArea} attorneys
          </h2>
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground">
            {introParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {locations.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              {practiceArea} attorneys by location
            </h2>
            <p className="text-muted-foreground mb-6">
              Find {practiceArea} attorneys serving your county.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {locations.map((c) => (
                <Link
                  key={`${c.state}-${c.county}`}
                  href={practiceAreaCountyPath(c.state, c.county, practiceArea)}
                  className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {c.county}, {c.state}
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
