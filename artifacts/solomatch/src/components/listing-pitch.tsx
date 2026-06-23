import { Trophy, Sparkles, Lock } from "lucide-react";

type Feature = {
  icon: typeof Trophy;
  title: string;
  desc: string;
};

// Mirrors the founding-attorney marketing one-pager. Intended for the
// attorney-facing funnel only (sign-up, sign-in, listing intake) — keep it out
// of the client-facing discovery pages (home, attorney profile, county) so
// people searching for a lawyer never see the sales pitch. Scoping is enforced
// by where it is imported, so do not add it to discovery routes.
const FEATURES: Feature[] = [
  {
    icon: Trophy,
    title: "Out-market the big firms",
    desc: "Large firms win clients by outspending everyone on advertising. Caseway levels the field — get found by the people searching in your area, without a marketing budget to match theirs.",
  },
  {
    icon: Sparkles,
    title: "Built for search & AI",
    desc: "We invest in SEO and AEO so when people search for a lawyer — on Google, or by asking AI assistants like ChatGPT and Perplexity — Caseway and your profile are what they find.",
  },
  {
    icon: Lock,
    title: "Simple, flat pricing",
    desc: "List your practice for $100/month — or $250/month for a Caseway Pro post that ranks at the top. Law firms get custom plans — talk to our team. No bidding wars, no surprise fees.",
  },
];

export function ListingPitch({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Why list on Caseway
      </p>
      <h2 className="mt-3 font-serif text-3xl md:text-4xl font-medium tracking-tight text-foreground leading-[1.12]">
        Be the attorney clients find first.
      </h2>
      <p className="mt-4 max-w-xl text-base text-muted-foreground leading-relaxed">
        Whether you're an independent attorney or a firm listing your whole
        team, Caseway puts you in front of the clients already searching. Big
        firms win by outspending everyone on marketing — Caseway lets you be
        found instead. An investment in your own practice, not a bidding war you
        can't win.
      </p>

      <div className="mt-8 space-y-5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
