// SEO helpers shared across the attorney + county pages, the sitemap-aware
// internal links, and the <head> manager. Keep slugify byte-for-byte aligned
// with the server's sitemap slugify (api-server/src/routes/seo.ts) so emitted
// sitemap URLs match the routes the SPA actually serves.

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Profile path is "<kebab full name>-<id>". The trailing numeric id is the
// source of truth; the name is decorative and parseAttorneyId tolerates drift.
export function attorneyPath(attorney: {
  id: number;
  fullName: string;
}): string {
  return `/attorney/${slugify(attorney.fullName)}-${attorney.id}`;
}

export function parseAttorneyId(slug: string): number | null {
  const trailing = slug.match(/(\d+)$/);
  if (trailing) {
    const n = Number(trailing[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

export function countyPath(state: string, county: string): string {
  return `/attorneys/${slugify(state)}/${slugify(county)}`;
}

export function practiceAreaCountyPath(
  state: string,
  county: string,
  practiceArea: string,
): string {
  return `/attorneys/${slugify(state)}/${slugify(county)}/${slugify(practiceArea)}`;
}

// State hub page — lists every county in the state. Sits one level above the
// county pages (/attorneys/<state>/<county>).
export function statePath(state: string): string {
  return `/attorneys/${slugify(state)}`;
}

// Nationwide practice-area hub — lists attorneys and locations for one specific
// practice area across the whole directory.
export function practiceAreaPath(practiceArea: string): string {
  return `/practice-areas/${slugify(practiceArea)}`;
}

// The master browse directory (states + practice areas). Static path.
export const directoryPath = "/directory";

// City page — lists attorneys near a specific city/town.
export function cityPath(state: string, county: string, city: string): string {
  return `/attorneys/${slugify(state)}/${slugify(county)}/city/${slugify(city)}`;
}

// Absolute URL on the current origin (canonical / OG / JSON-LD). BASE_URL is
// "/" today but this stays correct if the app is ever mounted on a sub-path.
export function absoluteUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${base}${path}`;
}

// Absolute image URL for OG/Twitter/JSON-LD. Pass-through for already-absolute
// http(s) URLs; otherwise prefix the current origin. Photo paths (e.g.
// "/api/storage/objects/..." or "/seed-attorneys/N.png") are origin-absolute, so
// no BASE_URL prefix is applied — crawlers and social scrapers require absolute.
export function absoluteImageUrl(
  url: string | undefined | null,
): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}\u2026`;
}

// FAQPage structured data. Pass the SAME items rendered by <FaqSection> so the
// markup matches visible content. Helps answer engines (and search) read the
// page's questions and answers directly.
export function faqPageLd(
  items: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
