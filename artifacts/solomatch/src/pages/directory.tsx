import { Link } from "wouter";
import { ChevronRight, Scale } from "lucide-react";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListCounties,
  useListPracticeAreaCounties,
  getListCountiesQueryKey,
  getListPracticeAreaCountiesQueryKey,
} from "@workspace/api-client-react";
import {
  statePath,
  practiceAreaPath,
  directoryPath,
  absoluteUrl,
  truncate,
  faqPageLd,
} from "@/lib/seo";
import { FaqSection } from "@/components/faq-section";
import { directoryIntro } from "@/lib/seo-content";

interface StateSummary {
  state: string;
  counties: number;
  attorneys: number;
}

export default function DirectoryPage() {
  const { data: counties, isLoading } = useListCounties({
    query: { queryKey: getListCountiesQueryKey() },
  });
  const { data: combos } = useListPracticeAreaCounties({
    query: { queryKey: getListPracticeAreaCountiesQueryKey() },
  });

  // Roll the (state, county) index up into one row per state.
  const states: StateSummary[] = Object.values(
    (counties ?? []).reduce<Record<string, StateSummary>>((acc, c) => {
      const cur = acc[c.state] ?? { state: c.state, counties: 0, attorneys: 0 };
      cur.counties += 1;
      cur.attorneys += c.count;
      acc[c.state] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => a.state.localeCompare(b.state));

  const areas = Array.from(
    new Set((combos ?? []).map((c) => c.practiceArea)),
  ).sort((a, b) => a.localeCompare(b));

  const canonical = absoluteUrl(directoryPath);
  const metaTitle = `Attorney Directory — Browse by State & Practice Area | Caseway`;
  const metaDescription = truncate(
    `Browse independent and solo attorneys across ${states.length} states on Caseway. Find lawyers by location or by practice area, then book a consultation directly.`,
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
    itemListElement: states.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(statePath(s.state)),
      name: s.state,
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
        item: canonical,
      },
    ],
  };

  const faqItems = [
    {
      question: `How do I find an attorney on Caseway?`,
      answer: `Start from your state and county to see independent and solo attorneys near you, or pick a legal topic to see attorneys who handle that kind of case across the country. Open any profile to compare experience and fees, then contact the lawyer directly.`,
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

  const introParas = directoryIntro();

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
          <span className="text-foreground font-medium">Directory</span>
        </nav>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 mb-5 shadow-sm">
            <Scale className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Full directory
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-4">
            Browse the attorney directory
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Find independent and solo attorneys by location or by the kind of
            legal help you need.
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <section>
            <h2 className="font-serif text-2xl font-medium text-foreground mb-6">
              Browse by state
            </h2>
            {states.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {states.map((s) => (
                  <Link
                    key={s.state}
                    href={statePath(s.state)}
                    className="group flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/40"
                  >
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {s.state}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {s.counties} {s.counties === 1 ? "county" : "counties"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                We're still building the directory. Check back soon.
              </p>
            )}
          </section>
        )}

        {areas.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border/60">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">
              Browse by practice area
            </h2>
            <p className="text-muted-foreground mb-6">
              See attorneys who handle a specific kind of case nationwide.
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

        <section className="mt-16 pt-12 border-t border-border/60">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
            About the Caseway directory
          </h2>
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground">
            {introParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        <FaqSection items={faqItems} />
      </div>
    </Layout>
  );
}
