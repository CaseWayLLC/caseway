import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getDemoMode, getPaidPostsEnabled } from "../lib/settings";

// Keep these slug helpers byte-for-byte aligned with the web app's
// src/lib/seo.ts so the sitemap URLs match the routes the SPA actually serves.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function attorneyPath(id: number, fullName: string): string {
  return `/attorney/${slugify(fullName)}-${id}`;
}

function statePath(state: string): string {
  return `/attorneys/${slugify(state)}`;
}

function countyPath(state: string, county: string): string {
  return `/attorneys/${slugify(state)}/${slugify(county)}`;
}

function practiceAreaCountyPath(
  state: string,
  county: string,
  practiceArea: string,
): string {
  return `/attorneys/${slugify(state)}/${slugify(county)}/${slugify(practiceArea)}`;
}

function practiceAreaPath(practiceArea: string): string {
  return `/practice-areas/${slugify(practiceArea)}`;
}

function cityPath(state: string, county: string, city: string): string {
  return `/attorneys/${slugify(state)}/${slugify(county)}/city/${slugify(city)}`;
}

// Resolve a stored photo to an absolute, crawlable image URL. Mirrors the web
// app's resolvePhotoUrl (photo.ts) + absoluteImageUrl (seo.ts): object-storage
// paths get the /api/storage prefix, already-absolute http(s) URLs pass through,
// and origin-relative paths (e.g. /seed-attorneys/N.png) are prefixed with the
// request origin so sitemap image entries are always absolute.
function resolvePhotoLoc(base: string, photoUrl: unknown): string | null {
  if (typeof photoUrl !== "string" || photoUrl === "") return null;
  let u = photoUrl;
  if (u.startsWith("/objects/")) u = `/api/storage${u}`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Track the newest child lastmod for an aggregate (state hub, nationwide area
// hub). ISO "YYYY-MM-DD" strings compare lexicographically == chronologically.
function bumpLastmod(
  map: Map<string, string | null>,
  key: string,
  iso: string | null,
): void {
  const prev = map.get(key);
  if (prev === undefined) {
    map.set(key, iso);
  } else if (iso && (!prev || iso > prev)) {
    map.set(key, iso);
  }
}

const router: IRouter = Router();

// Dynamic sitemap. Served as XML (not via OpenAPI/Orval). Lists the home page,
// the browse directory, every state hub, every distinct county landing page,
// every nationwide practice-area hub, every (state, county, practice area)
// landing page, and every publicly-visible attorney profile (with its photo as
// a sitemap image entry). Demo-aware and approved-only, so it never exposes
// hidden rows.
router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const [demoEnabled, paidPostsEnabled] = await Promise.all([
    getDemoMode(),
    getPaidPostsEnabled(),
  ]);
  // Same visibility matrix as the directory's /counties read: when paid-posts
  // enforcement is on, a non-demo listing must carry an active/trialing
  // subscription to appear in the sitemap; demo rows follow the demo flag.
  const visibilityFilter = !paidPostsEnabled
    ? demoEnabled
      ? sql``
      : sql` and is_demo = false`
    : demoEnabled
      ? sql` and (is_demo = true or subscription_status in ('active','trialing'))`
      : sql` and is_demo = false and subscription_status in ('active','trialing')`;

  // req.protocol honours x-forwarded-proto (trust proxy is on), and host is the
  // forwarded public host, so this resolves to the dev or prod origin correctly.
  const base = `${req.protocol}://${req.get("host")}`;

  const attorneysRes = await db.execute(sql`
    select id, full_name as "fullName", photo_url as "photoUrl", created_at as "createdAt"
    from attorneys
    where status = 'approved' and archived_at is null${visibilityFilter}
    order by id desc
  `);

  const countiesRes = await db.execute(sql`
    select state, county, max(created_at) as "lastmod"
    from attorneys
    where status = 'approved' and archived_at is null and county is not null and state is not null${visibilityFilter}
    group by state, county
    order by state asc, county asc
  `);

  // Same visibility-gated enumeration as GET /practice-area-counties so the
  // sitemap only lists (state, county, practice area) combos that have at least
  // one publicly-visible attorney — never empty or hidden combos.
  const practiceAreaCountiesRes = await db.execute(sql`
    select state, county, area as "practiceArea", max(created_at) as "lastmod"
    from attorneys, unnest(practice_areas) as area
    where status = 'approved' and archived_at is null and county is not null and state is not null and area is not null and area <> ''${visibilityFilter}
    group by state, county, area
    having count(*) > 0
    order by state asc, county asc, area asc
  `);

  type Url = { loc: string; lastmod?: string; image?: string };
  const urls: Array<Url> = [];
  urls.push({ loc: `${base}/` });
  urls.push({ loc: `${base}/directory` });

  // Roll county rows up into state hubs (one /attorneys/<state> per state), and
  // emit each county landing page. Both derive from the same visibility-gated
  // county index so they stay in lockstep.
  const stateLastmod = new Map<string, string | null>();
  const countyRows = countiesRes.rows as Array<{
    state: string;
    county: string;
    lastmod: unknown;
  }>;
  for (const row of countyRows) {
    bumpLastmod(stateLastmod, row.state, toIsoDate(row.lastmod));
  }
  for (const state of [...stateLastmod.keys()].sort()) {
    const lastmod = stateLastmod.get(state) ?? null;
    urls.push({
      loc: `${base}${statePath(state)}`,
      ...(lastmod ? { lastmod } : {}),
    });
  }
  for (const row of countyRows) {
    const lastmod = toIsoDate(row.lastmod);
    urls.push({
      loc: `${base}${countyPath(row.state, row.county)}`,
      ...(lastmod ? { lastmod } : {}),
    });
  }

  // Roll the area-county combos up into nationwide practice-area hubs (one
  // /practice-areas/<area> per distinct area), and emit each area-county page.
  const areaLastmod = new Map<string, string | null>();
  const areaCountyRows = practiceAreaCountiesRes.rows as Array<{
    state: string;
    county: string;
    practiceArea: string;
    lastmod: unknown;
  }>;
  for (const row of areaCountyRows) {
    bumpLastmod(areaLastmod, row.practiceArea, toIsoDate(row.lastmod));
  }
  for (const area of [...areaLastmod.keys()].sort()) {
    const lastmod = areaLastmod.get(area) ?? null;
    urls.push({
      loc: `${base}${practiceAreaPath(area)}`,
      ...(lastmod ? { lastmod } : {}),
    });
  }
  for (const row of areaCountyRows) {
    const lastmod = toIsoDate(row.lastmod);
    urls.push({
      loc: `${base}${practiceAreaCountyPath(
        row.state,
        row.county,
        row.practiceArea,
      )}`,
      ...(lastmod ? { lastmod } : {}),
    });
  }

  // City pages — emit one per distinct city extracted from approved attorneys
  // who have a non-null city. Uses the same visibility filter as everything else.
  const cityRes = await db.execute(sql`
    select state, county, city, max(created_at) as "lastmod"
    from attorneys
    where status = 'approved' and archived_at is null and city is not null and city <> '' and county is not null and state is not null${visibilityFilter}
    group by state, county, city
    order by state asc, county asc, city asc
  `);
  const cityRows = cityRes.rows as Array<{
    state: string;
    county: string;
    city: string;
    lastmod: unknown;
  }>;
  for (const row of cityRows) {
    const lastmod = toIsoDate(row.lastmod);
    urls.push({
      loc: `${base}${cityPath(row.state, row.county, row.city)}`,
      ...(lastmod ? { lastmod } : {}),
    });
  }

  for (const row of attorneysRes.rows as Array<{
    id: number;
    fullName: string;
    photoUrl: unknown;
    createdAt: unknown;
  }>) {
    const lastmod = toIsoDate(row.createdAt);
    const image = resolvePhotoLoc(base, row.photoUrl);
    urls.push({
      loc: `${base}${attorneyPath(row.id, row.fullName)}`,
      ...(lastmod ? { lastmod } : {}),
      ...(image ? { image } : {}),
    });
  }

  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : "";
      const image = u.image
        ? `\n    <image:image>\n      <image:loc>${xmlEscape(
            u.image,
          )}</image:loc>\n    </image:image>`
        : "";
      return `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>${lastmod}${image}\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;

  res
    .header("Content-Type", "application/xml; charset=utf-8")
    .header("Cache-Control", "public, max-age=3600")
    .send(xml);
});

export default router;
