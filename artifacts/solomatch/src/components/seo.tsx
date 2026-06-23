import { useEffect } from "react";

type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

interface SeoProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: "website" | "profile" | "article";
  jsonLd?: JsonLd;
  noindex?: boolean;
}

// Imperative <head> manager — a tiny dependency-free stand-in for react-helmet
// (avoids pinning another React-coupled lib). Each effect mutates the existing
// tags (or creates them) and records a restore closure so navigating away in
// the SPA reverts <head> to the static index.html defaults. Crawlers that run
// JS (Googlebot) see the per-page title/description/canonical/JSON-LD; this is
// the standard static-SPA SEO approach since prod has no SSR.
export function Seo({
  title,
  description,
  canonical,
  image,
  type = "website",
  jsonLd,
  noindex = false,
}: SeoProps) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const prevTitle = document.title;
    document.title = title;
    cleanups.push(() => {
      document.title = prevTitle;
    });

    const applyMeta = (
      attr: "name" | "property",
      key: string,
      content: string,
    ) => {
      const selector = `meta[${attr}="${key}"]`;
      const existing = document.head.querySelector<HTMLMetaElement>(selector);
      if (existing) {
        const prev = existing.getAttribute("content");
        existing.setAttribute("content", content);
        cleanups.push(() => {
          if (prev === null) existing.removeAttribute("content");
          else existing.setAttribute("content", prev);
        });
      } else {
        const created = document.createElement("meta");
        created.setAttribute(attr, key);
        created.setAttribute("content", content);
        document.head.appendChild(created);
        cleanups.push(() => created.remove());
      }
    };

    const applyLink = (rel: string, href: string) => {
      const selector = `link[rel="${rel}"]`;
      const existing = document.head.querySelector<HTMLLinkElement>(selector);
      if (existing) {
        const prev = existing.getAttribute("href");
        existing.setAttribute("href", href);
        cleanups.push(() => {
          if (prev === null) existing.removeAttribute("href");
          else existing.setAttribute("href", prev);
        });
      } else {
        const created = document.createElement("link");
        created.setAttribute("rel", rel);
        created.setAttribute("href", href);
        document.head.appendChild(created);
        cleanups.push(() => created.remove());
      }
    };

    applyMeta("name", "description", description);
    applyMeta(
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow",
    );

    applyMeta("property", "og:title", title);
    applyMeta("property", "og:description", description);
    applyMeta("property", "og:type", type);

    applyMeta("name", "twitter:card", "summary_large_image");
    applyMeta("name", "twitter:title", title);
    applyMeta("name", "twitter:description", description);

    if (canonical) {
      applyLink("canonical", canonical);
      applyMeta("property", "og:url", canonical);
    }
    if (image) {
      applyMeta("property", "og:image", image);
      applyMeta("name", "twitter:image", image);
    }

    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
      cleanups.push(() => script.remove());
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [title, description, canonical, image, type, noindex, jsonLdKey]);

  return null;
}
