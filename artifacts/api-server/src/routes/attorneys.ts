import { Router, type IRouter, type Response } from "express";
import {
  getAuthUserId,
  getAuthUser,
  getAccountType,
  getFirmStatus,
} from "../lib/supabaseAuth";
import {
  and,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db, attorneysTable } from "@workspace/db";
import { getDemoMode, getPaidPostsEnabled } from "../lib/settings";
import { deriveLocation } from "../lib/location";
import {
  statsCache,
  countiesCache,
  practiceAreaCountiesCache,
  bustAggregateCaches,
} from "../lib/aggregateCaches";
import {
  ListAttorneysQueryParams,
  ListAttorneysResponse,
  ListMyAttorneysResponse,
  CreateAttorneyBody,
  GetAttorneyParams,
  GetAttorneyResponse,
  GetAttorneyAnalyticsParams,
  GetAttorneyAnalyticsResponse,
  GetSimilarAttorneysParams,
  GetSimilarAttorneysResponse,
  GetDirectoryStatsResponse,
  ListCountiesResponse,
  ListPracticeAreaCountiesResponse,
  UpdateAttorneyBody,
  SetAttorneyPausedBody,
} from "@workspace/api-zod";
import {
  isActiveStatus,
  ACTIVE_SUB_STATUSES,
  cancelStripeSubscription,
} from "../lib/billing";

const router: IRouter = Router();

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Returns the name of the first URL field that fails the http(s) allowlist, or
// null if all are safe. photoUrl may be an uploaded object-storage path.
function findUnsafeUrlField(data: {
  photoUrl?: string | null;
  calendlyUrl?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
}): string | null {
  const urlChecks: Array<[string, string | null | undefined]> = [
    ["photoUrl", data.photoUrl],
    ["calendlyUrl", data.calendlyUrl],
    ["websiteUrl", data.websiteUrl],
    ["linkedinUrl", data.linkedinUrl],
  ];
  for (const [field, value] of urlChecks) {
    if (!value) continue;
    if (field === "photoUrl" && value.startsWith("/objects/")) continue;
    if (!isSafeHttpUrl(value)) return field;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COUNTRY_TOKENS = new Set([
  "usa",
  "us",
  "united states",
  "united states of america",
]);

// Place autocomplete returns "City, State, Country" — match each meaningful
// comma-separated part (ignoring the country) so a city search like
// "New York, NY, USA" matches an attorney's office address.
function parseSearchTerms(q: string): string[] {
  const parts = q
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !COUNTRY_TOKENS.has(p.toLowerCase()));
  return parts.length > 0 ? parts : [q.trim()].filter((p) => p.length > 0);
}

// Builds the demo-aware base visibility condition shared by every public read.
// Paid-posts model (when enforcement is ON): a non-demo listing is publicly
// visible only while it has an active/trialing Stripe subscription. Demo rows
// are exempt (gated by the demo flag instead). When enforcement is OFF (the
// default — pre-launch / testing), every approved, non-archived listing shows
// regardless of billing. Archived (soft-deleted) rows are always excluded.
function approvedVisibleCondition(
  demoEnabled: boolean,
  paidPostsEnabled: boolean,
): SQL {
  const approved = eq(attorneysTable.status, "approved");
  const notArchived = isNull(attorneysTable.archivedAt);

  // Enforcement off: show every approved, non-archived listing; demo rows still
  // follow the demo flag (hidden when demo mode is off).
  if (!paidPostsEnabled) {
    return demoEnabled
      ? (and(approved, notArchived) as SQL)
      : (and(approved, notArchived, eq(attorneysTable.isDemo, false)) as SQL);
  }

  const subscribed = and(
    eq(attorneysTable.isDemo, false),
    inArray(attorneysTable.subscriptionStatus, [...ACTIVE_SUB_STATUSES]),
  ) as SQL;
  // When demo mode is on, demo rows show regardless of billing; paid rows still
  // need an active subscription.
  const paidVisible = demoEnabled
    ? (or(eq(attorneysTable.isDemo, true), subscribed) as SQL)
    : subscribed;
  return and(approved, notArchived, paidVisible) as SQL;
}

// Number of approved, live (non-demo, non-archived) listings an attorney has
// referred. A correlated subquery over a self-aliased copy of the table (inner
// alias "r"); count(*)::int returns a JS number. No active-subscription
// requirement: a referrer keeps credit even if a referee lapses.
//
// The outer row is referenced as the literal "attorneys"."id" rather than
// ${attorneysTable.id}: in a SELECT-projection context Drizzle renders the
// latter UNQUALIFIED as "id", which then binds to the inner alias r (making the
// correlation r.referred_by_id = r.id, so every count is silently 0). The
// literal pins the correlation to the outer table. Safe because every caller
// selects FROM the unaliased attorneys table.
function referralCountExpr(): SQL<number> {
  return sql<number>`(select count(*)::int from ${attorneysTable} as r where r.referred_by_id = "attorneys"."id" and r.status = 'approved' and r.archived_at is null and r.is_demo = false)`;
}

// Validates a self-reported referrer id captured at signup. Returns the id only
// if it points to a real, approved, live (non-demo, non-archived) listing owned
// by a DIFFERENT account (no self-referral); otherwise null. Stale/invalid ids
// are ignored so a bad referral can never block a signup.
async function resolveReferrer(
  referredById: number | null | undefined,
  newOwnerId: string,
): Promise<number | null> {
  if (referredById == null) return null;
  const [ref] = await db
    .select({ id: attorneysTable.id, ownerId: attorneysTable.ownerId })
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.id, referredById),
        eq(attorneysTable.status, "approved"),
        isNull(attorneysTable.archivedAt),
        eq(attorneysTable.isDemo, false),
      ),
    );
  if (!ref) return null;
  if (ref.ownerId && ref.ownerId === newOwnerId) return null;
  return ref.id;
}

router.get("/attorneys", async (req, res): Promise<void> => {
  const parsed = ListAttorneysQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [demoEnabled, paidPostsEnabled] = await Promise.all([
    getDemoMode(),
    getPaidPostsEnabled(),
  ]);
  const conditions: SQL[] = [
    approvedVisibleCondition(demoEnabled, paidPostsEnabled),
  ];

  if (parsed.data.practiceArea) {
    // @> (array contains) can use the GIN index on practice_areas.
    conditions.push(
      sql`${attorneysTable.practiceAreas} @> ARRAY[${parsed.data.practiceArea}]::text[]`,
    );
  }
  // Boolean filters are read from the raw query string (not the coerced zod
  // value): z.coerce.boolean() treats the string "false" as truthy.
  if (req.query.freeConsultation === "true") {
    conditions.push(eq(attorneysTable.offersFreeConsultation, true));
  }
  if (req.query.videoConferencing === "true") {
    conditions.push(eq(attorneysTable.videoConferencing, true));
  }
  // Structured location filters (case-insensitive) power the county landing
  // pages, e.g. ?state=Connecticut&county=Fairfield%20County.
  if (parsed.data.state) {
    conditions.push(
      sql`lower(${attorneysTable.state}) = lower(${parsed.data.state})`,
    );
  }
  if (parsed.data.county) {
    conditions.push(
      sql`lower(${attorneysTable.county}) = lower(${parsed.data.county})`,
    );
  }
  if (parsed.data.q) {
    const haystack = sql`(${attorneysTable.fullName} || ' ' || ${attorneysTable.firmName} || ' ' || ${attorneysTable.title} || ' ' || ${attorneysTable.officeAddress} || ' ' || ${attorneysTable.bio} || ' ' || array_to_string(${attorneysTable.practiceAreas}, ' ') || ' ' || array_to_string(${attorneysTable.jurisdictions}, ' '))`;
    for (const term of parseSearchTerms(parsed.data.q)) {
      // \y = word boundary, ~* = case-insensitive match. Each term must match
      // so multi-part location searches ("New York, NY") narrow results.
      conditions.push(sql`${haystack} ~* ${`\\y${escapeRegExp(term)}\\y`}`);
    }
  }

  if (parsed.data.name) {
    // Substring (not word-boundary) match so the landing-page typeahead surfaces
    // partial names as the user types, e.g. "doe" -> "John Doe". Cap the length
    // to bound regex cost on pathological inputs.
    const term = parsed.data.name.trim().slice(0, 80);
    if (term) {
      const re = escapeRegExp(term);
      conditions.push(
        sql`(${attorneysTable.fullName} ~* ${re} OR ${attorneysTable.firmName} ~* ${re})`,
      );
    }
  }

  // Ranking: Pro (paid) listings first, then attorneys who have referred the
  // most live listings (the referral reward), then newest within each tier.
  // The main search is radius-bounded client-side, so a referral boost ahead of
  // distance still only surfaces nearby attorneys.
  const referralCount = referralCountExpr();
  const rows = await db
    .select({ ...getTableColumns(attorneysTable), referralCount })
    .from(attorneysTable)
    .where(and(...conditions))
    .orderBy(
      desc(attorneysTable.isPro),
      desc(referralCount),
      desc(attorneysTable.id),
    );

  setPublicCache(res);
  res.json(ListAttorneysResponse.parse(rows));
});

// Thrown inside the create transaction to abort when a solo account already
// holds its one allowed listing; mapped to a 409 by the handler below.
class SoloListingLimitError extends Error {}

router.post("/attorneys", async (req, res): Promise<void> => {
  const user = await getAuthUser(req);
  if (!user) {
    res
      .status(401)
      .json({ error: "You must be signed in to list your practice" });
    return;
  }
  const userId = user.id;
  const accountType = getAccountType(user);

  // Firm-account gate: a law firm account must be admin-approved BEFORE it can
  // post any listing. The status lives in service-role-only app_metadata, so it
  // cannot be forged by the account holder. Solo accounts are unaffected.
  if (accountType === "firm" && getFirmStatus(user) !== "approved") {
    res.status(403).json({
      error:
        "Your law firm account is awaiting approval. You can post listings once an admin approves your firm.",
      code: "firm_not_approved",
    });
    return;
  }

  const parsed = CreateAttorneyBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid attorney input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const unsafeField = findUnsafeUrlField(parsed.data);
  if (unsafeField) {
    res
      .status(400)
      .json({ error: `${unsafeField} must be a valid http(s) URL` });
    return;
  }

  // Referral capture: validate the self-reported referrer and persist it as
  // referredById. Set ONLY here at creation; the PATCH handlers strip it so the
  // referral link is immutable afterwards.
  const referredById = await resolveReferrer(parsed.data.referredById, userId);

  const loc = deriveLocation(parsed.data.officeAddress);

  // Account-type cap: solo accounts may hold only ONE active listing; law firms
  // ("firm") are unlimited. "Active" = not archived and not rejected, so a
  // rejected/archived listing frees the slot. Missing/invalid accountType is
  // treated as solo. The count + insert run in one transaction behind a
  // per-owner advisory lock so two concurrent creates can't both pass the
  // check and double-insert.
  try {
    const attorney = await db.transaction(async (tx) => {
      if (accountType !== "firm") {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
        );
        const [existing] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(attorneysTable)
          .where(
            and(
              eq(attorneysTable.ownerId, userId),
              isNull(attorneysTable.archivedAt),
              ne(attorneysTable.status, "rejected"),
            ),
          );
        if ((existing?.count ?? 0) >= 1) {
          throw new SoloListingLimitError();
        }
      }

      const [row] = await tx
        .insert(attorneysTable)
        .values({
          ...parsed.data,
          referredById,
          calendlyUrl: parsed.data.calendlyUrl || null,
          websiteUrl: parsed.data.websiteUrl ?? null,
          linkedinUrl: parsed.data.linkedinUrl ?? null,
          barNumber: parsed.data.barNumber ?? null,
          city: loc.city,
          county: loc.county,
          state: loc.state,
          stateCode: loc.stateCode,
          ownerId: userId,
          // Approved firms post listings that go live right after payment with
          // NO per-listing review, so their listings are inserted as "approved".
          // Solo listings start "pending" and await admin review.
          status: accountType === "firm" ? "approved" : "pending",
          // Terms-acceptance audit trail: the listing was created through the
          // gated form, so stamp acceptance time + client IP server-side.
          termsAcceptedAt: new Date(),
          termsAcceptedIp: req.ip ?? null,
        })
        .returning();
      return row;
    });

    bustAggregateCaches();
    res.status(201).json(GetAttorneyResponse.parse(attorney));
  } catch (err) {
    if (err instanceof SoloListingLimitError) {
      res.status(409).json({
        error:
          "Solo accounts can list one practice. Upgrade to a law firm account to add more listings.",
        code: "solo_listing_limit",
      });
      return;
    }
    throw err;
  }
});

// Declared BEFORE "/attorneys/:id" so the literal "mine" segment isn't parsed
// as an :id. Returns the signed-in user's own listings (any review status).
router.get("/attorneys/mine", async (req, res): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    res
      .status(401)
      .json({ error: "You must be signed in to view your listings" });
    return;
  }

  // Archived listings are treated as deleted, so they drop out of the owner's
  // dashboard too (same as before the soft-delete change).
  const rows = await db
    .select()
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.ownerId, userId),
        isNull(attorneysTable.archivedAt),
      ),
    )
    .orderBy(desc(attorneysTable.id));

  res.json(ListMyAttorneysResponse.parse(rows));
});

router.patch("/attorneys/:id", async (req, res): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "You must be signed in to edit a listing" });
    return;
  }

  const params = GetAttorneyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Owner-scoped: only a row owned by this user can be read or edited. This
  // check runs BEFORE body validation so a caller editing a listing they don't
  // own always gets a clean 404 (not a confusing "missing fields" 400). A
  // missing row (wrong owner or nonexistent id) is reported as 404.
  const [existing] = await db
    .select()
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.id, params.data.id),
        eq(attorneysTable.ownerId, userId),
        // An admin-archived listing is off-limits to the owner: they can't edit
        // and resubmit it back into the review queue.
        isNull(attorneysTable.archivedAt),
      ),
    );

  if (!existing) {
    res.status(404).json({ error: "Attorney not found" });
    return;
  }

  const parsed = UpdateAttorneyBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid attorney update");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const unsafeField = findUnsafeUrlField(parsed.data);
  if (unsafeField) {
    res
      .status(400)
      .json({ error: `${unsafeField} must be a valid http(s) URL` });
    return;
  }

  // Any owner edit re-enters the admin review queue: an approved listing goes
  // back for re-approval, and a rejected listing gets another review (the
  // dashboard explicitly invites the owner to "edit and resubmit"). An
  // already-pending listing simply stays pending.
  const nextStatus = "pending" as const;

  // parsed.data only carries editable fields (no id/ownerId/status/isDemo/
  // createdAt), so spreading it can't tamper with ownership or approval state.
  // referredById is set once at creation and is immutable, so strip it here — a
  // listing edit must never change or clear who referred this attorney.
  const editable = { ...parsed.data };
  delete editable.referredById;
  const loc = parsed.data.officeAddress
    ? deriveLocation(parsed.data.officeAddress)
    : null;
  const [updated] = await db
    .update(attorneysTable)
    .set({
      ...editable,
      calendlyUrl: parsed.data.calendlyUrl || null,
      websiteUrl: parsed.data.websiteUrl ?? null,
      linkedinUrl: parsed.data.linkedinUrl ?? null,
      barNumber: parsed.data.barNumber ?? null,
      ...(loc
        ? {
            city: loc.city,
            county: loc.county,
            state: loc.state,
            stateCode: loc.stateCode,
          }
        : {}),
      status: nextStatus,
      // Resubmitting through the gated form re-affirms the Terms of Use.
      termsAcceptedAt: new Date(),
      termsAcceptedIp: req.ip ?? null,
    })
    .where(
      and(
        eq(attorneysTable.id, params.data.id),
        eq(attorneysTable.ownerId, userId),
        // Re-check in the write predicate so a concurrent admin archive between
        // the ownership check and this update can't be overwritten.
        isNull(attorneysTable.archivedAt),
      ),
    )
    .returning();

  bustAggregateCaches();
  res.json(GetAttorneyResponse.parse(updated));
});

router.delete("/attorneys/:id", async (req, res): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    res
      .status(401)
      .json({ error: "You must be signed in to remove a listing" });
    return;
  }

  const params = GetAttorneyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Owner-scoped: deletes only a row owned by this user. A missing row (wrong
  // owner or nonexistent id) is reported as 404 — same shape as the PATCH. An
  // admin-archived row is excluded so an owner can't permanently delete a
  // listing that admin moderation has set aside.
  const [deleted] = await db
    .delete(attorneysTable)
    .where(
      and(
        eq(attorneysTable.id, params.data.id),
        eq(attorneysTable.ownerId, userId),
        isNull(attorneysTable.archivedAt),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Attorney not found" });
    return;
  }

  // Removing a listing stops billing it going forward (no refund). The row is
  // gone, so no reconcile is needed. Best-effort: a Stripe failure is logged
  // but never blocks the deletion the owner asked for.
  if (deleted.stripeSubscriptionId) {
    try {
      await cancelStripeSubscription(deleted.stripeSubscriptionId);
    } catch (err) {
      req.log.error(
        { err, attorneyId: deleted.id },
        "Failed to cancel subscription on owner delete",
      );
    }
  }

  bustAggregateCaches();
  res.status(204).end();
});

// Owner-scoped pause/resume. Pausing hides a live listing from the public
// directory (which only ever shows status = "approved") without deleting it;
// resuming restores it to "approved" with no admin re-approval needed.
router.post("/attorneys/:id/pause", async (req, res): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "You must be signed in to pause a listing" });
    return;
  }

  const params = GetAttorneyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SetAttorneyPausedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Owner-scoped: a missing row (wrong owner or nonexistent id) is a 404 —
  // same shape as the PATCH/DELETE handlers.
  const [existing] = await db
    .select()
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.id, params.data.id),
        eq(attorneysTable.ownerId, userId),
        // Archived (admin-removed) listings can't be paused/resumed by the owner.
        isNull(attorneysTable.archivedAt),
      ),
    );

  if (!existing) {
    res.status(404).json({ error: "Attorney not found" });
    return;
  }

  const { paused } = parsed.data;
  // Only a live (approved) listing can be paused, and only a paused listing
  // can be resumed. Pending/rejected listings aren't publicly visible, so
  // pausing them is meaningless.
  if (paused && existing.status !== "approved") {
    res.status(400).json({ error: "Only a live listing can be paused" });
    return;
  }
  if (!paused && existing.status !== "paused") {
    res.status(400).json({ error: "Only a paused listing can be resumed" });
    return;
  }

  const nextStatus = paused ? "paused" : "approved";

  const [updated] = await db
    .update(attorneysTable)
    .set({ status: nextStatus })
    .where(
      and(
        eq(attorneysTable.id, params.data.id),
        eq(attorneysTable.ownerId, userId),
        // Re-check in the write predicate to guard against a concurrent archive.
        isNull(attorneysTable.archivedAt),
      ),
    )
    .returning();

  bustAggregateCaches();
  res.json(GetAttorneyResponse.parse(updated));
});

// Owner-scoped per-listing analytics. Mirrors the admin analytics SQL style
// (gap-filled daily timeseries) but scopes every aggregate to a single listing
// the caller owns. A listing the caller doesn't own (or that doesn't exist) is
// reported as 404 so existence is never revealed.
const ALLOWED_ANALYTICS_DAYS = new Set([7, 30, 90]);

router.get(
  "/attorneys/:id/analytics/:days",
  async (req, res): Promise<void> => {
    const userId = await getAuthUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ error: "You must be signed in to view listing analytics" });
      return;
    }

    const params = GetAttorneyAnalyticsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    // Validate against a small allowlist; anything else clamps to the default.
    const days = ALLOWED_ANALYTICS_DAYS.has(params.data.days)
      ? params.data.days
      : 30;

    // Owner-scoped: only the row owned by this caller is readable. A missing row
    // (wrong owner or nonexistent id) is a 404 — same shape as the PATCH/pause
    // handlers — so the endpoint never reveals whether the listing exists.
    const [attorney] = await db
      .select()
      .from(attorneysTable)
      .where(
        and(
          eq(attorneysTable.id, params.data.id),
          eq(attorneysTable.ownerId, userId),
          isNull(attorneysTable.archivedAt),
        ),
      );

    if (!attorney) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    // Window start is the beginning of the earliest day in the window, so the
    // totals match the sum of the gap-filled daily series exactly.
    const windowStart = sql`date_trunc('day', now()) - make_interval(days => (${days - 1})::int)`;

    // Totals over the window — a single-row aggregate kept entirely in SQL.
    const totalsRes = await db.execute(sql`
      select
        coalesce(sum(case when type = 'attorney_view' then 1 else 0 end), 0)::int as "profileViews",
        coalesce(sum(case when type = 'consultation_click' then 1 else 0 end), 0)::int as "consultationClicks",
        coalesce(sum(case when type = 'website_click' then 1 else 0 end), 0)::int as "websiteClicks"
      from analytics_events
      where attorney_id = ${params.data.id}
        and created_at >= ${windowStart}
    `);
    const totalsRow = totalsRes.rows[0] as
      | {
          profileViews: number;
          consultationClicks: number;
          websiteClicks: number;
        }
      | undefined;

    // Gap-filled daily series: generate_series produces every day in the window
    // and a left join zero-fills days with no events — all in SQL.
    const seriesRes = await db.execute(sql`
      select
        to_char(d.day, 'YYYY-MM-DD') as date,
        coalesce(sum(case when e.type = 'attorney_view' then 1 else 0 end), 0)::int as "profileViews",
        coalesce(sum(case when e.type = 'consultation_click' then 1 else 0 end), 0)::int as "consultationClicks",
        coalesce(sum(case when e.type = 'website_click' then 1 else 0 end), 0)::int as "websiteClicks"
      from generate_series(${windowStart}, date_trunc('day', now()), interval '1 day') as d(day)
      left join analytics_events e
        on date_trunc('day', e.created_at) = d.day
        and e.attorney_id = ${params.data.id}
      group by d.day
      order by d.day
    `);
    const timeseries = (
      seriesRes.rows as Array<{
        date: string;
        profileViews: number;
        consultationClicks: number;
        websiteClicks: number;
      }>
    ).map((r) => ({
      date: r.date,
      profileViews: Number(r.profileViews),
      consultationClicks: Number(r.consultationClicks),
      websiteClicks: Number(r.websiteClicks),
    }));

    res.json(
      GetAttorneyAnalyticsResponse.parse({
        totals: {
          profileViews: Number(totalsRow?.profileViews ?? 0),
          consultationClicks: Number(totalsRow?.consultationClicks ?? 0),
          websiteClicks: Number(totalsRow?.websiteClicks ?? 0),
        },
        timeseries,
      }),
    );
  },
);

router.get("/attorneys/:id", async (req, res): Promise<void> => {
  const params = GetAttorneyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [demoEnabled, paidPostsEnabled] = await Promise.all([
    getDemoMode(),
    getPaidPostsEnabled(),
  ]);
  const [attorney] = await db
    .select({
      ...getTableColumns(attorneysTable),
      referralCount: referralCountExpr(),
    })
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.id, params.data.id),
        eq(attorneysTable.status, "approved"),
        isNull(attorneysTable.archivedAt),
      ),
    );

  // Paid-posts gate: demo rows follow the demo flag; non-demo rows are visible
  // only with an active/trialing subscription (when enforcement is on).
  const hidden =
    !attorney ||
    (attorney.isDemo
      ? !demoEnabled
      : paidPostsEnabled && !isActiveStatus(attorney.subscriptionStatus));
  if (hidden) {
    res.status(404).json({ error: "Attorney not found" });
    return;
  }

  setPublicCache(res);
  res.json(GetAttorneyResponse.parse(attorney));
});

router.get("/attorneys/:id/similar", async (req, res): Promise<void> => {
  const params = GetSimilarAttorneysParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [demoEnabled, paidPostsEnabled] = await Promise.all([
    getDemoMode(),
    getPaidPostsEnabled(),
  ]);
  const [target] = await db
    .select()
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.id, params.data.id),
        eq(attorneysTable.status, "approved"),
        isNull(attorneysTable.archivedAt),
      ),
    );

  const hidden =
    !target ||
    (target.isDemo
      ? !demoEnabled
      : paidPostsEnabled && !isActiveStatus(target.subscriptionStatus));
  if (hidden) {
    res.status(404).json({ error: "Attorney not found" });
    return;
  }

  // Rank Pro listings first (freemium placement), then by practice-area
  // overlap, then experience — computed in SQL and
  // capped to the top 4 so we never load the whole table into memory.
  // Build an explicit ARRAY[...] literal: interpolating a JS array into sql``
  // expands to a (v1, v2, ...) tuple, which can't be cast to text[].
  const targetAreas =
    target.practiceAreas.length > 0
      ? sql`ARRAY[${sql.join(
          target.practiceAreas.map((a) => sql`${a}`),
          sql`, `,
        )}]::text[]`
      : sql`ARRAY[]::text[]`;
  const overlap = sql<number>`cardinality(array(select unnest(${attorneysTable.practiceAreas}) intersect select unnest(${targetAreas})))`;
  const referralCount = referralCountExpr();

  // Keep relevance (practice-area overlap) ahead of the referral reward so
  // "similar" stays genuinely similar; referralCount only breaks ties.
  const ranked = await db
    .select({ ...getTableColumns(attorneysTable), referralCount })
    .from(attorneysTable)
    .where(
      and(
        approvedVisibleCondition(demoEnabled, paidPostsEnabled),
        ne(attorneysTable.id, target.id),
      ),
    )
    .orderBy(
      desc(attorneysTable.isPro),
      desc(overlap),
      desc(referralCount),
      desc(attorneysTable.yearsOfExperience),
    )
    .limit(4);

  setPublicCache(res);
  res.json(GetSimilarAttorneysResponse.parse(ranked));
});

// Public discovery reads are identical for every visitor (auth is ignored on
// these paths), so they are safe to cache at the browser/CDN edge. A short TTL
// spares the DB from repeated identical reads under crawler/CDN load. We bound
// worst-case staleness to max-age (no stale-while-revalidate) so an admin
// takedown (reject/ban/archive) or a billing-driven visibility change
// propagates within 60s rather than lingering for minutes at an edge. Dev stays
// uncached so listing edits show up immediately while iterating.
const PUBLIC_READ_CACHE =
  process.env.NODE_ENV === "production" ? "public, max-age=60" : "no-store";

function setPublicCache(res: Response): void {
  res.setHeader("Cache-Control", PUBLIC_READ_CACHE);
}

// These three aggregate endpoints are read-heavy (full-table unnest scans) and
// tolerate brief staleness, so cache by the only inputs that change the result —
// the demo + paid-posts flags. An admin flag flip lands on a different cache key
// and is reflected immediately; otherwise results are reused for the TTL.
function flagCacheKey(demoEnabled: boolean, paidPostsEnabled: boolean): string {
  return `${demoEnabled}:${paidPostsEnabled}`;
}

router.get("/stats", async (_req, res): Promise<void> => {
  setPublicCache(res);
  const [demoEnabled, paidPostsEnabled] = await Promise.all([
    getDemoMode(),
    getPaidPostsEnabled(),
  ]);

  const cacheKey = flagCacheKey(demoEnabled, paidPostsEnabled);
  const cached = statsCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Totals and free-consultation count in a single aggregate scan.
  const [counts] = await db
    .select({
      totalAttorneys: sql<number>`count(*)::int`,
      freeConsultationCount: sql<number>`count(*) filter (where ${attorneysTable.offersFreeConsultation})::int`,
    })
    .from(attorneysTable)
    .where(approvedVisibleCondition(demoEnabled, paidPostsEnabled));

  // unnest-based aggregations stay in SQL (no whole-table load into Node).
  // Archived rows are excluded from every stat, alongside the demo filter.
  const visibilityFilter = !paidPostsEnabled
    ? demoEnabled
      ? sql` and archived_at is null`
      : sql` and is_demo = false and archived_at is null`
    : demoEnabled
      ? sql` and archived_at is null and (is_demo = true or subscription_status in ('active','trialing'))`
      : sql` and is_demo = false and archived_at is null and subscription_status in ('active','trialing')`;

  const jurRes = await db.execute(sql`
    select count(distinct j)::int as count
    from attorneys, unnest(jurisdictions) as j
    where status = 'approved'${visibilityFilter}
  `);
  const totalJurisdictions = Number(
    (jurRes.rows[0] as { count: number } | undefined)?.count ?? 0,
  );

  const topRes = await db.execute(sql`
    select unnest(practice_areas) as practice_area, count(*)::int as count
    from attorneys
    where status = 'approved'${visibilityFilter}
    group by practice_area
    order by count desc, practice_area asc
    limit 8
  `);
  const topPracticeAreas = (
    topRes.rows as Array<{ practice_area: string; count: number }>
  ).map((r) => ({ practiceArea: r.practice_area, count: Number(r.count) }));

  const payload = GetDirectoryStatsResponse.parse({
    totalAttorneys: Number(counts?.totalAttorneys ?? 0),
    totalJurisdictions,
    freeConsultationCount: Number(counts?.freeConsultationCount ?? 0),
    topPracticeAreas,
  });
  statsCache.set(cacheKey, payload);
  res.json(payload);
});

// Distinct counties (with state) that have at least one publicly-visible
// attorney. Powers the SEO county landing pages and the footer's internal
// links. Demo-aware, approved-only — same visibility rules as the directory.
router.get("/counties", async (_req, res): Promise<void> => {
  setPublicCache(res);
  const [demoEnabled, paidPostsEnabled] = await Promise.all([
    getDemoMode(),
    getPaidPostsEnabled(),
  ]);

  const cacheKey = flagCacheKey(demoEnabled, paidPostsEnabled);
  const cached = countiesCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const visibilityFilter = !paidPostsEnabled
    ? demoEnabled
      ? sql``
      : sql` and is_demo = false`
    : demoEnabled
      ? sql` and (is_demo = true or subscription_status in ('active','trialing'))`
      : sql` and is_demo = false and subscription_status in ('active','trialing')`;

  const result = await db.execute(sql`
    select state, state_code as "stateCode", county, count(*)::int as count
    from attorneys
    where status = 'approved' and archived_at is null and county is not null and state is not null${visibilityFilter}
    group by state, state_code, county
    order by state asc, county asc
  `);

  const counties = (
    result.rows as Array<{
      state: string;
      stateCode: string;
      county: string;
      count: number;
    }>
  ).map((r) => ({
    state: r.state,
    stateCode: r.stateCode,
    county: r.county,
    count: Number(r.count),
  }));

  const payload = ListCountiesResponse.parse(counties);
  countiesCache.set(cacheKey, payload);
  res.json(payload);
});

// Distinct (state, county, practice area) combinations that have at least one
// publicly-visible attorney. Powers the SEO practice-area county landing pages
// and the county page's "browse by practice area" internal links. Demo-aware,
// approved-only — same visibility rules as /counties.
router.get("/practice-area-counties", async (_req, res): Promise<void> => {
  setPublicCache(res);
  const [demoEnabled, paidPostsEnabled] = await Promise.all([
    getDemoMode(),
    getPaidPostsEnabled(),
  ]);

  const cacheKey = flagCacheKey(demoEnabled, paidPostsEnabled);
  const cached = practiceAreaCountiesCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const visibilityFilter = !paidPostsEnabled
    ? demoEnabled
      ? sql``
      : sql` and is_demo = false`
    : demoEnabled
      ? sql` and (is_demo = true or subscription_status in ('active','trialing'))`
      : sql` and is_demo = false and subscription_status in ('active','trialing')`;

  // unnest each row's practice_areas so a single listing contributes one row
  // per area it covers; the visibility filter keeps hidden/unsubscribed/demo-
  // off listings out of the index entirely.
  const result = await db.execute(sql`
      select state, state_code as "stateCode", county, area as "practiceArea", count(*)::int as count
      from attorneys, unnest(practice_areas) as area
      where status = 'approved' and archived_at is null and county is not null and state is not null and area is not null and area <> ''${visibilityFilter}
      group by state, state_code, county, area
      having count(*) > 0
      order by state asc, county asc, area asc
    `);

  const rows = (
    result.rows as Array<{
      state: string;
      stateCode: string;
      county: string;
      practiceArea: string;
      count: number;
    }>
  ).map((r) => ({
    state: r.state,
    stateCode: r.stateCode,
    county: r.county,
    practiceArea: r.practiceArea,
    count: Number(r.count),
  }));

  const payload = ListPracticeAreaCountiesResponse.parse(rows);
  practiceAreaCountiesCache.set(cacheKey, payload);
  res.json(payload);
});

export default router;
