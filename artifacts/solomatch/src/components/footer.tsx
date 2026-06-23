import { Link } from "wouter";
import { Logo } from "@/components/logo";
import { MAJOR_CITIES, citySlug } from "@/lib/cities";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/disclaimer", label: "Legal Disclaimer" },
  { href: "/refunds", label: "Refund & Cancellation" },
  { href: "/contact", label: "Contact & Support" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-border/60 bg-card/60 backdrop-blur-xl">
      <div className="container mx-auto px-5 sm:px-6 md:px-12 lg:px-20 max-w-7xl py-12 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              className="flex items-center gap-3 cursor-pointer group w-fit"
            >
              <Logo className="w-9 h-9 object-contain" />
              <span className="font-serif font-medium text-xl tracking-tight text-foreground">
                Caseway
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Caseway helps people find solo and independent attorneys. We are a
              directory and discovery platform — not a law firm, and not a
              substitute for legal advice.
            </p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground/80">
              Caseway is a product of CaseWay LLC, a Wyoming limited liability
              company. Attorney listing payments are collected and processed by
              Indicium Markets Inc.
            </p>
          </div>

          <div className="md:col-span-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Browse by city
            </h3>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {MAJOR_CITIES.map((c) => (
                <li key={citySlug(c)}>
                  <Link
                    href={`/?city=${citySlug(c)}`}
                    className="text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    {c.name}, {c.state}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/directory"
              className="mt-5 inline-block text-sm font-medium text-primary hover:underline"
            >
              Browse all states &amp; counties
            </Link>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-border/60 bg-background/60 p-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Disclaimer:</span>{" "}
            Caseway is not a law firm, lawyer referral service, or legal advice
            provider, and using this site does not create an attorney-client
            relationship. Listings and profile information are provided by the
            attorneys themselves and are not endorsements. Always verify an
            attorney's credentials, licensing, and standing with the relevant
            state bar before retaining them.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {year} CaseWay LLC. All rights reserved. Caseway is a
            trademark of CaseWay LLC.
          </p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              Admin
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
