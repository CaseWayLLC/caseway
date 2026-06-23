import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Award,
  Linkedin,
  ArrowLeft,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SaveButton } from "@/components/save-button";
import {
  useGetAttorney,
  useGetSimilarAttorneys,
  getGetAttorneyQueryKey,
  getGetSimilarAttorneysQueryKey,
} from "@workspace/api-client-react";
import { useTrack } from "@/lib/analytics";
import { resolvePhotoUrl } from "@/lib/photo";
import {
  attorneyPath,
  countyPath,
  statePath,
  parseAttorneyId,
  absoluteUrl,
  absoluteImageUrl,
  truncate,
} from "@/lib/seo";

export default function AttorneyPage({ params }: { params: { slug: string } }) {
  const id = parseAttorneyId(params.slug);
  const [location, setLocation] = useLocation();
  const track = useTrack();

  const {
    data: attorney,
    isLoading,
    isError,
  } = useGetAttorney(id ?? 0, {
    query: { enabled: id !== null, queryKey: getGetAttorneyQueryKey(id ?? 0) },
  });

  const { data: similarAttorneys } = useGetSimilarAttorneys(id ?? 0, {
    query: {
      enabled: id !== null,
      queryKey: getGetSimilarAttorneysQueryKey(id ?? 0),
    },
  });

  // Record the view once the profile resolves.
  useEffect(() => {
    if (attorney) track({ type: "attorney_view", attorneyId: attorney.id });
  }, [attorney, track]);

  // Normalise non-canonical URLs (e.g. /attorney/123 or a stale name) to the
  // canonical slug so search engines see one URL per profile.
  useEffect(() => {
    if (!attorney) return;
    const canonicalPath = attorneyPath(attorney);
    if (location !== canonicalPath) {
      setLocation(canonicalPath, { replace: true });
    }
  }, [attorney, location, setLocation]);

  if (id === null || isError) {
    return (
      <Layout>
        <Seo
          title="Attorney not found | Caseway"
          description="The attorney profile you are looking for could not be found."
          noindex
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32 gap-5">
          <h1 className="font-serif text-4xl font-medium text-foreground">
            Profile not found
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            We couldn't find that attorney. They may have removed their listing.
          </p>
          <Button asChild className="rounded-full px-8 mt-2">
            <Link href="/">Find a Lawyer</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (isLoading || !attorney) {
    return (
      <Layout>
        <div className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-6 md:px-10 pt-28 md:pt-32 pb-24">
          <div className="flex flex-col items-center text-center mb-12">
            <Skeleton className="w-40 h-40 rounded-full mb-6" />
            <Skeleton className="h-10 w-72 mb-3" />
            <Skeleton className="h-6 w-48 mb-8" />
            <Skeleton className="h-12 w-64 rounded-full" />
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  const canonical = absoluteUrl(attorneyPath(attorney));
  const photo = resolvePhotoUrl(attorney.photoUrl);
  const ogImage = absoluteImageUrl(photo);
  const locationLabel = [attorney.city, attorney.stateCode]
    .filter(Boolean)
    .join(", ");
  const hasState = Boolean(attorney.state);
  const hasCounty = Boolean(attorney.county && attorney.state);

  const metaTitle = `${attorney.fullName} — ${attorney.title}${
    locationLabel ? ` in ${locationLabel}` : ""
  } | Caseway`;
  const metaDescription = truncate(
    `${attorney.fullName}, ${attorney.title} at ${attorney.firmName}. ${attorney.bio}`,
  );

  // Home > State > County > Name, skipping any level the listing doesn't have.
  const crumbItems: Array<{ name: string; item: string }> = [
    { name: "Home", item: absoluteUrl("/") },
  ];
  if (hasState) {
    crumbItems.push({
      name: attorney.state!,
      item: absoluteUrl(statePath(attorney.state!)),
    });
  }
  if (hasCounty) {
    crumbItems.push({
      name: `${attorney.county}, ${attorney.stateCode}`,
      item: absoluteUrl(countyPath(attorney.state!, attorney.county!)),
    });
  }
  crumbItems.push({ name: attorney.fullName, item: canonical });

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbItems.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };

  // External profiles Google can use to corroborate the attorney's identity.
  const sameAs = [attorney.websiteUrl, attorney.linkedinUrl].filter(
    (u): u is string => Boolean(u),
  );

  const profileLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Attorney",
    name: attorney.fullName,
    description: attorney.bio,
    url: canonical,
    jobTitle: attorney.title,
    telephone: attorney.phone,
    email: attorney.email,
    knowsLanguage: attorney.languages,
    knowsAbout: attorney.practiceAreas,
    areaServed: attorney.jurisdictions,
    address: {
      "@type": "PostalAddress",
      streetAddress: attorney.officeAddress,
      ...(attorney.city ? { addressLocality: attorney.city } : {}),
      ...(attorney.stateCode ? { addressRegion: attorney.stateCode } : {}),
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: attorney.latitude,
      longitude: attorney.longitude,
    },
    ...(ogImage ? { image: ogImage } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    worksFor: { "@type": "Organization", name: attorney.firmName },
  };

  return (
    <Layout>
      <Seo
        title={metaTitle}
        description={metaDescription}
        canonical={canonical}
        image={ogImage}
        type="profile"
        jsonLd={[profileLd, breadcrumb]}
      />

      <article className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-6 md:px-10 pt-28 md:pt-32 pb-24">
        <Button
          asChild
          variant="ghost"
          className="-ml-2 mb-6 text-muted-foreground hover:text-foreground rounded-full px-4"
        >
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to search
          </Link>
        </Button>

        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-8"
        >
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          {hasState && (
            <>
              <ChevronRight className="h-4 w-4 text-border" />
              <Link
                href={statePath(attorney.state!)}
                className="hover:text-primary transition-colors"
              >
                {attorney.state}
              </Link>
            </>
          )}
          {hasCounty && (
            <>
              <ChevronRight className="h-4 w-4 text-border" />
              <Link
                href={countyPath(attorney.state!, attorney.county!)}
                className="hover:text-primary transition-colors"
              >
                {attorney.county}, {attorney.stateCode}
              </Link>
            </>
          )}
          <ChevronRight className="h-4 w-4 text-border" />
          <span className="text-foreground font-medium">
            {attorney.fullName}
          </span>
        </nav>

        <div className="flex flex-col items-center text-center mb-14 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gold/10 rounded-full blur-3xl -z-10" />
          <Avatar className="h-40 w-40 mb-6 border-4 border-background shadow-xl ring-1 ring-border/50">
            <AvatarImage src={photo} className="object-cover" />
            <AvatarFallback className="text-5xl font-serif text-muted-foreground bg-muted">
              {attorney.fullName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h1 className="font-serif text-4xl md:text-5xl font-medium mb-3 text-foreground tracking-tight">
            {attorney.fullName}
          </h1>
          <p className="text-primary font-medium text-lg mb-1">
            {attorney.title}
          </p>
          <p className="text-muted-foreground text-base mb-2">
            {attorney.firmName}
          </p>
          {locationLabel && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8">
              <MapPin className="h-4 w-4 text-gold" /> {locationLabel}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {attorney.offersFreeConsultation && (
              <Badge className="bg-primary text-primary-foreground hover:bg-primary px-4 py-1.5 text-sm shadow-sm rounded-full">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Free Consultation
              </Badge>
            )}
            {attorney.videoConferencing && (
              <Badge
                variant="secondary"
                className="px-4 py-1.5 text-sm shadow-sm bg-muted/80 border-border/50 rounded-full text-foreground/80"
              >
                <Globe className="w-4 h-4 mr-2 text-primary" /> Video Available
              </Badge>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
            {attorney.calendlyUrl ? (
              <Button
                className="w-full sm:w-auto px-12 py-7 text-lg shadow-xl hover-elevate rounded-full font-medium bg-gold text-gold-foreground hover:bg-gold/90"
                onClick={() => {
                  track({
                    type: "consultation_click",
                    attorneyId: attorney.id,
                  });
                  window.open(
                    attorney.calendlyUrl!,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                {attorney.offersFreeConsultation
                  ? "Book Free Consultation"
                  : "Book a Consultation"}
              </Button>
            ) : (
              <Button
                asChild
                className="w-full sm:w-auto px-12 py-7 text-lg shadow-xl hover-elevate rounded-full font-medium bg-gold text-gold-foreground hover:bg-gold/90"
              >
                <a
                  href={`mailto:${attorney.email}`}
                  onClick={() =>
                    track({
                      type: "consultation_click",
                      attorneyId: attorney.id,
                    })
                  }
                >
                  Contact for a Consultation
                </a>
              </Button>
            )}
            <SaveButton
              attorneyId={attorney.id}
              attorneyName={attorney.fullName}
              variant="labeled"
              className="w-full sm:w-auto h-auto px-8 py-7 text-lg"
            />
          </div>
        </div>

        <div className="space-y-12 max-w-3xl mx-auto">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-gold" /> About
            </h2>
            <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap font-serif">
              {attorney.bio}
            </p>
          </section>

          <Separator className="bg-border/60" />

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 sm:gap-y-10 gap-x-8">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold" /> Experience
              </h2>
              <p className="text-lg font-medium">
                {attorney.yearsOfExperience} Years
              </p>
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gold" /> Languages
              </h2>
              <p className="text-lg font-medium">
                {attorney.languages.join(", ")}
              </p>
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gold" /> Jurisdictions
              </h2>
              <p className="text-lg font-medium">
                {attorney.jurisdictions.join(", ")}
              </p>
            </div>
          </section>

          <Separator className="bg-border/60" />

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
              Practice Areas
            </h2>
            <div className="flex flex-wrap gap-3">
              {attorney.practiceAreas.map((area) => (
                <Badge
                  key={area}
                  variant="outline"
                  className="bg-card px-4 py-2 text-sm font-medium border-border/60 text-foreground/90 shadow-sm rounded-full"
                >
                  {area}
                </Badge>
              ))}
            </div>
          </section>

          <Separator className="bg-border/60" />

          <section className="bg-muted/30 rounded-3xl p-6 sm:p-8 border border-border/50">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
              Contact Info
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <span className="text-lg leading-snug pt-2.5 font-medium">
                  {attorney.officeAddress}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <a
                  href={`tel:${attorney.phone}`}
                  className="text-lg font-medium text-primary hover:underline"
                >
                  {attorney.phone}
                </a>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <a
                  href={`mailto:${attorney.email}`}
                  className="text-lg font-medium text-primary hover:underline break-all"
                >
                  {attorney.email}
                </a>
              </div>
              {attorney.websiteUrl && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <a
                    href={attorney.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      track({ type: "website_click", attorneyId: attorney.id })
                    }
                    className="text-lg font-medium text-primary hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}
              {attorney.linkedinUrl && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Linkedin className="w-5 h-5 text-primary" />
                  </div>
                  <a
                    href={attorney.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg font-medium text-primary hover:underline"
                  >
                    View LinkedIn
                  </a>
                </div>
              )}
            </div>
          </section>

          {similarAttorneys && similarAttorneys.length > 0 && (
            <>
              <Separator className="bg-border/60" />
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
                  Similar Lawyers
                </h2>
                <div className="space-y-4">
                  {similarAttorneys.map((similar) => (
                    <Link
                      key={similar.id}
                      href={attorneyPath(similar)}
                      className="flex items-center gap-5 p-4 rounded-2xl border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/40 hover:shadow-md transition-all duration-300 group"
                    >
                      <Avatar className="h-14 w-14 border-2 border-background bg-muted shadow-sm shrink-0">
                        <AvatarImage
                          src={resolvePhotoUrl(similar.photoUrl)}
                          className="object-cover"
                        />
                        <AvatarFallback className="text-sm font-serif">
                          {similar.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-serif font-medium leading-none mb-2 group-hover:text-primary transition-colors truncate">
                          {similar.fullName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {similar.practiceAreas[0]}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors">
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}

          <div className="pt-4">
            <Button
              asChild
              variant="ghost"
              className="text-muted-foreground hover:text-foreground rounded-full px-6"
            >
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to search
              </Link>
            </Button>
          </div>
        </div>
      </article>
    </Layout>
  );
}
