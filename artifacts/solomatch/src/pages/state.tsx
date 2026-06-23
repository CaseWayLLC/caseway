import { Link } from "wouter";
import { ChevronRight, MapPin } from "lucide-react";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo";
import { Button } from "@/components/ui/button";
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
  countyPath,
  statePath,
  cityPath,
  practiceAreaPath,
  directoryPath,
  slugify,
  absoluteUrl,
  truncate,
  faqPageLd,
} from "@/lib/seo";
import { FaqSection } from "@/components/faq-section";
import { stateIntro } from "@/lib/seo-content";

export default function StatePage({ params }: { params: { state: string } }) {
  const { data: counties, isLoading } = useListCounties({
    query: { queryKey: getListCountiesQueryKey() },
  });
  const { data: combos } = useListPracticeAreaCounties({
    query: { queryKey: getListPracticeAreaCountiesQueryKey() },
  });

  const stateName = counties?.find(
    (c) => slugify(c.state) === params.state,
  )?.state;

  const { data: attorneys } = useListAttorneys(
    stateName ? { state: stateName } : {},
    {
      query: {
        enabled: Boolean(stateName),
        queryKey: getListAttorneysQueryKey(stateName ? { state: stateName } : {}),
      },
    },
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-6 md:px-10 pt-28 md:pt-32 pb-24">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-12 w-96 mb-10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!stateName) {
    return (
      <Layout>
        <Seo
          title="State not found | Caseway"
          description="We couldn't find attorneys for that location."
          noindex
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32 gap-5">
          <h1 className="font-serif text-4xl font-medium text-foreground">
            No listings here yet
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            We don't have any attorneys listed for that state yet. Try searching
            from the homepage.
          </p>
          <Button asChild className="rounded-full px-8 mt-2">
            <Link href="/">Find a Lawyer</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const stateCounties = (counties ?? [])
    .filter((c) => c.state === stateName)
    .sort((a, b) => a.county.localeCompare(b.county));
  const totalAttorneys = stateCounties.reduce((sum, c) => sum + c.count, 0);
  const countyLabel = stateCounties.length === 1 ? "county" : "counties";

  // Distinct practice areas available anywhere in this state — link out to the
  // nationwide practice-area hubs for internal-link depth.
  const areas = Array.from(
    new Set(
      (combos ?? [])
        .filter((c) => c.state === stateName)
        .map((c) => c.practiceArea),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const canonical = absoluteUrl(statePath(stateName));
  const metaTitle = `Attorneys in ${stateName} | Caseway`;
  const metaDescription = truncate(
    `Browse ${totalAttorneys} independent and solo attorneys across ${stateCounties.length} ${countyLabel} in ${stateName}. Compare practice areas and fees, then book a consultation directly on Caseway.`,
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
    itemListElement: stateCounties.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(countyPath(c.state, c.county)),
      name: `${c.county}, ${c.state}`,
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
      { "@type": "ListItem", position: 3, name: stateName, item: canonical },
    ],
  };

  const faqItems = [
    {
      question: `How do I find an attorney in ${stateName}?`,
      answer: `Choose the county nearest you to see independent and solo attorneys serving that area, then narrow by the kind of legal help you need. Open any profile to compare experience and fees, then contact the lawyer directly or book a free consultation.`,
    },
    {
      question: `How much does it cost to hire a lawyer in ${stateName}?`,
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

  const introParas = stateIntro(stateName);

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
          <span className="text-foreground font-medium">{stateName}</span>
        </nav>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-5 shadow-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Statewide
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-4">
            Attorneys in {stateName}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {totalAttorneys > 0
              ? `Browse ${totalAttorneys} independent and solo ${
                  totalAttorneys === 1 ? "attorney" : "attorneys"
                } across ${stateCounties.length} ${countyLabel} in ${stateName}. Pick a county to see who practices near you.`
              : `We're still building our directory for ${stateName}. Check back soon, or search from the homepage.`}
          </p>
        </header>

        {stateCounties.length > 0 ? (
          <section>
            <h2 className="font-serif text-2xl font-medium text-foreground mb-6">
              Browse by county
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stateCounties.map((c) => (
                <Link
                  key={c.county}
                  href={countyPath(c.state, c.county)}
                  className="group flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/40"
                >
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {c.county}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {c.count} {c.count === 1 ? "attorney" : "attorneys"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <div className="text-center p-12 bg-card rounded-3xl border border-dashed border-border shadow-sm">
            <h2 className="font-serif text-2xl font-medium mb-3 text-foreground">
              No attorneys listed yet
            </h2>
            <p className="text-base text-muted-foreground mb-6">
              Be the first to list your practice in {stateName}.
            </p>
            <Button asChild className="rounded-full px-8">
              <Link href="/signup">List Your Practice</Link>
            </Button>
          </div>
        )}

        <section className="mt-16 pt-12 border-t border-border/60">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
            About attorneys in {stateName}
          </h2>
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground">
            {introParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {areas.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              Browse by legal topic
            </h2>
            <p className="text-muted-foreground mb-6">
              Explore attorneys by the kind of legal help you need.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {areas.map((area) => (
                <Link
                  key={area}
                  href={practiceAreaPath(area)}
                  className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {area}
                </Link>
              ))}
            </div>
          </section>
        )}

        {attorneys && attorneys.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              Browse by city
            </h2>
            <p className="text-muted-foreground mb-6">
              Find attorneys near specific towns in {stateName}.
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
                .map((city) => {
                  const atty = attorneys.find((a) => a.city === city);
                  const county = atty?.county ?? "";
                  return (
                    <Link
                      key={city}
                      href={cityPath(stateName, county, city)}
                      className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {city}
                    </Link>
                  );
                })}
            </div>
          </section>
        )}

        <section className="mt-16 pt-12 border-t border-border/60">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
            Browse other states
          </h2>
          <p className="text-muted-foreground mb-6">
            See every state and county in the Caseway directory.
          </p>
          <Button asChild variant="outline" className="rounded-full px-7">
            <Link href={directoryPath}>View the full directory</Link>
          </Button>
        </section>

        <FaqSection items={faqItems} />
      </div>
    </Layout>
  );
}
