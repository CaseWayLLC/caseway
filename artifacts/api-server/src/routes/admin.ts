import { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  getSupabaseAdminClient,
  getAccountType,
  getFirmStatus,
  getFirmInfo,
  type SupabaseUser,
} from "../lib/supabaseAuth";
import { db, attorneysTable, analyticsEventsTable } from "@workspace/db";
import { cancelStripeSubscription, syncAndReconcile } from "../lib/billing";
import {
  AdminLoginBody,
  AdminLoginResponse,
  AdminLogoutResponse,
  GetAdminSessionResponse,
  ListAttorneyApplicationsQueryParams,
  ListAttorneyApplicationsResponse,
  ListReferralsResponse,
  ApproveAttorneyParams,
  ApproveAttorneyResponse,
  RejectAttorneyParams,
  RejectAttorneyResponse,
  VerifyAttorneyParams,
  VerifyAttorneyBody,
  VerifyAttorneyResponse,
  SetAttorneyProParams,
  SetAttorneyProBody,
  SetAttorneyProResponse,
  GetAdminAnalyticsResponse,
  ListAnalyticsEventsQueryParams,
  ListAnalyticsEventsResponse,
  GetDemoStatusResponse,
  SetDemoModeBody,
  SetDemoModeResponse,
  AdminDeleteAttorneyParams,
  AdminUpdateAttorneyParams,
  AdminUpdateAttorneyBody,
  AdminUpdateAttorneyResponse,
  BulkGeocodeAttorneysBody,
  BulkGeocodeAttorneysResponse,
  AdminDeleteAttorneyResponse,
  RestoreAttorneyParams,
  RestoreAttorneyResponse,
  PermanentlyDeleteAttorneyParams,
  ListArchivedAttorneysResponse,
  PromoteDemoAttorneysResponse,
  ListAccountsQueryParams,
  ListAccountsResponse,
  SetAccountBannedParams,
  SetAccountBannedBody,
  SetAccountBannedResponse,
  DeleteAccountParams,
  DeleteAccountResponse,
  SetFirmStatusParams,
  SetFirmStatusBody,
  SetFirmStatusResponse,
} from "@workspace/api-zod";
import {
  clearAdminCookie,
  isAdminRequest,
  requireAdmin,
  setAdminCookie,
  verifyPin,
} from "../lib/adminAuth";
import { getDemoMode, setDemoMode } from "../lib/settings";
import { buildDemoAttorneys } from "../lib/demoData";
import { deriveLocation } from "../lib/location";
import { bustAggregateCaches } from "../lib/aggregateCaches";
import {
  isLoginRateLimited,
  recordLoginFailure,
  clearLoginFailures,
} from "../lib/loginRateLimit";

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
    // photoUrl may be an app-served root-relative path: an uploaded
    // object-storage path (/objects/...) or a seed headshot (/seed-attorneys/...
    // on promoted demo rows). Any path starting with "/" is safe from scheme
    // injection (e.g. javascript:), so it bypasses the http(s) allowlist.
    if (field === "photoUrl" && value.startsWith("/")) continue;
    if (!isSafeHttpUrl(value)) return field;
  }
  return null;
}

async function countDemoAttorneys(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(attorneysTable)
    .where(eq(attorneysTable.isDemo, true));
  return row?.value ?? 0;
}

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown";
  if (await isLoginRateLimited(ip)) {
    res.status(429).json({
      error: "Too many attempts. Please wait a few minutes and try again.",
    });
    return;
  }

  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!verifyPin(parsed.data.pin)) {
    await recordLoginFailure(ip);
    req.log.warn({ ip }, "Failed admin login attempt");
    res.status(401).json({ error: "Invalid PIN." });
    return;
  }

  await clearLoginFailures(ip);
  setAdminCookie(res);
  res.json(AdminLoginResponse.parse({ authenticated: true }));
});

router.post("/admin/logout", async (_req, res): Promise<void> => {
  clearAdminCookie(res);
  res.json(AdminLogoutResponse.parse({ authenticated: false }));
});

router.get("/admin/session", async (req, res): Promise<void> => {
  const authenticated = isAdminRequest(req);
  res.json(GetAdminSessionResponse.parse({ authenticated }));
});

router.get(
  "/admin/applications",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAttorneyApplicationsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Archived (soft-deleted) rows never appear in the review queue; they live
    // in the separate "Archived" view.
    const rows = parsed.data.status
      ? await db
          .select()
          .from(attorneysTable)
          .where(
            and(
              eq(attorneysTable.status, parsed.data.status),
              isNull(attorneysTable.archivedAt),
            ),
          )
          .orderBy(desc(attorneysTable.createdAt))
      : await db
          .select()
          .from(attorneysTable)
          .where(isNull(attorneysTable.archivedAt))
          .orderBy(desc(attorneysTable.createdAt));

    res.json(ListAttorneyApplicationsResponse.parse(rows));
  },
);

// Top referrers leaderboard: attorneys ranked by how many approved, live
// (non-demo, non-archived) listings they have referred. Join each referrer to
// their qualifying referees, then group in JS (the dataset is small). Referrers
// with no qualifying referees don't appear. The referrer's own status is not
// filtered — admins see everyone who has successfully referred.
router.get(
  "/admin/referrals",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const referee = alias(attorneysTable, "referee");
    const rows = await db
      .select({
        referrerId: attorneysTable.id,
        referrerName: attorneysTable.fullName,
        referrerFirm: attorneysTable.firmName,
        refereeId: referee.id,
        refereeName: referee.fullName,
        refereeFirm: referee.firmName,
        refereeStatus: referee.status,
        refereeCreatedAt: referee.createdAt,
      })
      .from(attorneysTable)
      .innerJoin(referee, eq(referee.referredById, attorneysTable.id))
      .where(
        and(
          eq(referee.status, "approved"),
          isNull(referee.archivedAt),
          eq(referee.isDemo, false),
        ),
      )
      .orderBy(desc(referee.createdAt));

    type Entry = {
      id: number;
      fullName: string;
      firmName: string;
      referralCount: number;
      referees: Array<{
        id: number;
        fullName: string;
        firmName: string;
        status: string;
        createdAt: Date;
      }>;
    };
    const byReferrer = new Map<number, Entry>();
    for (const r of rows) {
      let entry = byReferrer.get(r.referrerId);
      if (!entry) {
        entry = {
          id: r.referrerId,
          fullName: r.referrerName,
          firmName: r.referrerFirm,
          referralCount: 0,
          referees: [],
        };
        byReferrer.set(r.referrerId, entry);
      }
      entry.referees.push({
        id: r.refereeId,
        fullName: r.refereeName,
        firmName: r.refereeFirm,
        status: r.refereeStatus,
        createdAt: r.refereeCreatedAt,
      });
      entry.referralCount += 1;
    }

    const leaderboard = [...byReferrer.values()].sort(
      (a, b) =>
        b.referralCount - a.referralCount ||
        a.fullName.localeCompare(b.fullName),
    );

    res.json(ListReferralsResponse.parse(leaderboard));
  },
);

router.get(
  "/admin/attorneys/archived",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(attorneysTable)
      .where(isNotNull(attorneysTable.archivedAt))
      .orderBy(desc(attorneysTable.archivedAt));

    res.json(ListArchivedAttorneysResponse.parse(rows));
  },
);

router.post(
  "/admin/attorneys/:id/approve",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ApproveAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [attorney] = await db
      .update(attorneysTable)
      .set({ status: "approved" })
      .where(eq(attorneysTable.id, params.data.id))
      .returning();

    if (!attorney) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    bustAggregateCaches();
    res.json(ApproveAttorneyResponse.parse(attorney));
  },
);

// Best-effort: cancel a listing's Stripe subscription (going forward, no
// refund) when it's rejected or removed, so we don't keep billing for a
// listing that is no longer publicly visible. A Stripe failure is logged but
// never blocks the moderation/removal action. Pass reconcile=true when the
// listing row survives (reject/archive) so its denormalized billing columns
// reflect the cancellation; skip it when the row is being hard-deleted.
async function cancelListingBilling(
  req: Request,
  subscriptionId: string | null | undefined,
  attorneyId: number,
  reconcile: boolean,
): Promise<void> {
  if (!subscriptionId) return;
  try {
    await cancelStripeSubscription(subscriptionId);
    if (reconcile) await syncAndReconcile();
  } catch (err) {
    req.log.error(
      { err, attorneyId },
      "Failed to cancel listing subscription",
    );
  }
}

router.post(
  "/admin/attorneys/:id/reject",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = RejectAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [attorney] = await db
      .update(attorneysTable)
      .set({ status: "rejected" })
      .where(eq(attorneysTable.id, params.data.id))
      .returning();

    if (!attorney) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    await cancelListingBilling(
      req,
      attorney.stripeSubscriptionId,
      attorney.id,
      true,
    );

    bustAggregateCaches();
    res.json(RejectAttorneyResponse.parse(attorney));
  },
);

router.post(
  "/admin/attorneys/:id/verify",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = VerifyAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = VerifyAttorneyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Verification is a manual admin attestation that the attorney's bar
    // standing was checked; it never changes the listing's review status.
    const [attorney] = await db
      .update(attorneysTable)
      .set({ isVerified: parsed.data.verified })
      .where(eq(attorneysTable.id, params.data.id))
      .returning();

    if (!attorney) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    bustAggregateCaches();
    res.json(VerifyAttorneyResponse.parse(attorney));
  },
);

router.post(
  "/admin/attorneys/:id/pro",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetAttorneyProParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = SetAttorneyProBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Pro is a paid-placement flag, set manually by an admin today and later
    // driven by an active Stripe subscription. It never changes review status.
    const [attorney] = await db
      .update(attorneysTable)
      .set({ isPro: parsed.data.pro })
      .where(eq(attorneysTable.id, params.data.id))
      .returning();

    if (!attorney) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    bustAggregateCaches();
    res.json(SetAttorneyProResponse.parse(attorney));
  },
);

router.patch(
  "/admin/attorneys/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AdminUpdateAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = AdminUpdateAttorneyBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn(
        { errors: parsed.error.message },
        "Invalid admin attorney update",
      );
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

    // Admin-scoped edit: unlike the owner PATCH, this updates any listing by id
    // (including ownerless demo/promoted rows) and is NOT owner-scoped. The
    // review status is intentionally left untouched, so an approved listing
    // stays public the moment the admin saves (no re-approval needed).
    // parsed.data only carries editable fields (no id/ownerId/status/isDemo/
    // createdAt), so spreading it can't tamper with ownership or approval state.
    // referredById is set once at creation and is immutable, so strip it: an
    // admin edit through the generic form must never change or clear who
    // referred this attorney.
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
        ...(loc
          ? {
              city: loc.city,
              county: loc.county,
              state: loc.state,
              stateCode: loc.stateCode,
            }
          : {}),
      })
      .where(eq(attorneysTable.id, params.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    bustAggregateCaches();
    res.json(AdminUpdateAttorneyResponse.parse(updated));
  },
);

router.delete(
  "/admin/attorneys/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AdminDeleteAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    // Admin-scoped soft delete: archives any listing by id (including ownerless
    // demo/promoted rows) so an accidental delete is recoverable. Already-archived
    // rows are treated as not found so the action stays idempotent-but-explicit.
    const [archived] = await db
      .update(attorneysTable)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(attorneysTable.id, params.data.id),
          isNull(attorneysTable.archivedAt),
        ),
      )
      .returning();

    if (!archived) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    // Archiving hides the listing from the public directory, so stop billing it.
    await cancelListingBilling(
      req,
      archived.stripeSubscriptionId,
      archived.id,
      true,
    );

    bustAggregateCaches();
    res.json(AdminDeleteAttorneyResponse.parse(archived));
  },
);

router.post(
  "/admin/attorneys/:id/restore",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = RestoreAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    // Restore clears the archive marker; the listing's review status is
    // untouched, so it returns to wherever it was (approved/pending/etc.).
    const [restored] = await db
      .update(attorneysTable)
      .set({ archivedAt: null })
      .where(
        and(
          eq(attorneysTable.id, params.data.id),
          isNotNull(attorneysTable.archivedAt),
        ),
      )
      .returning();

    if (!restored) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    bustAggregateCaches();
    res.json(RestoreAttorneyResponse.parse(restored));
  },
);

router.delete(
  "/admin/attorneys/:id/permanent",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = PermanentlyDeleteAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    // Hard delete is only allowed on an already-archived listing, so a row can
    // never be permanently removed without first passing through the archive.
    const [deleted] = await db
      .delete(attorneysTable)
      .where(
        and(
          eq(attorneysTable.id, params.data.id),
          isNotNull(attorneysTable.archivedAt),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }

    // Belt-and-suspenders: archiving already cancels the subscription, but a row
    // archived before this existed could still be billable. The row is gone, so
    // no reconcile is needed.
    await cancelListingBilling(
      req,
      deleted.stripeSubscriptionId,
      deleted.id,
      false,
    );

    bustAggregateCaches();
    res.status(204).end();
  },
);

router.get("/admin/demo", requireAdmin, async (_req, res): Promise<void> => {
  const [enabled, demoCount] = await Promise.all([
    getDemoMode(),
    countDemoAttorneys(),
  ]);
  res.json(GetDemoStatusResponse.parse({ enabled, demoCount }));
});

router.post("/admin/demo", requireAdmin, async (req, res): Promise<void> => {
  const parsed = SetDemoModeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.enabled) {
    await db.transaction(async (tx) => {
      // Serialize concurrent seed attempts so demo profiles are generated once.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(847261000)`);
      const [row] = await tx
        .select({ value: count() })
        .from(attorneysTable)
        .where(eq(attorneysTable.isDemo, true));
      if ((row?.value ?? 0) === 0) {
        await tx.insert(attorneysTable).values(buildDemoAttorneys());
      }
    });
  }

  await setDemoMode(parsed.data.enabled);

  const demoCount = await countDemoAttorneys();
  res.json(
    SetDemoModeResponse.parse({ enabled: parsed.data.enabled, demoCount }),
  );
});

router.post(
  "/admin/demo/promote",
  requireAdmin,
  async (_req, res): Promise<void> => {
    // Clear the demo flag on every demo row so they become permanent listings
    // shown regardless of demo mode, then turn demo mode off (no demo rows
    // remain). No rows are deleted.
    const promotedRows = await db
      .update(attorneysTable)
      .set({ isDemo: false })
      .where(eq(attorneysTable.isDemo, true))
      .returning({ id: attorneysTable.id });

    await setDemoMode(false);

    bustAggregateCaches();
    res.json(
      PromoteDemoAttorneysResponse.parse({
        promoted: promotedRows.length,
        enabled: false,
        demoCount: 0,
      }),
    );
  },
);

router.post(
  "/admin/attorneys/bulk-geocode",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = BulkGeocodeAttorneysBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Only the latitude/longitude are touched. Review status, isDemo and every
    // other field are intentionally left untouched so an approved listing stays
    // public and demo gating is unaffected. Archived rows are excluded so a
    // soft-deleted listing can never be silently revived/edited.
    let updated = 0;
    await db.transaction(async (tx) => {
      for (const u of parsed.data.updates) {
        const [row] = await tx
          .update(attorneysTable)
          .set({ latitude: u.latitude, longitude: u.longitude })
          .where(
            and(eq(attorneysTable.id, u.id), isNull(attorneysTable.archivedAt)),
          )
          .returning({ id: attorneysTable.id });
        if (row) updated += 1;
      }
    });

    res.json(BulkGeocodeAttorneysResponse.parse({ updated }));
  },
);

async function countEvents(type?: string): Promise<number> {
  const [row] = type
    ? await db
        .select({ value: count() })
        .from(analyticsEventsTable)
        .where(eq(analyticsEventsTable.type, type))
    : await db.select({ value: count() }).from(analyticsEventsTable);
  return row?.value ?? 0;
}

async function countAttorneys(status: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(attorneysTable)
    .where(eq(attorneysTable.status, status));
  return row?.value ?? 0;
}

router.get(
  "/admin/analytics",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const [
      totalEvents,
      totalSearches,
      totalProfileViews,
      totalConsultationClicks,
      approvedAttorneys,
      pendingApplications,
    ] = await Promise.all([
      countEvents(),
      countEvents("search"),
      countEvents("attorney_view"),
      countEvents("consultation_click"),
      countAttorneys("approved"),
      countAttorneys("pending"),
    ]);

    const topSearches = await db
      .select({ label: analyticsEventsTable.query, count: count() })
      .from(analyticsEventsTable)
      .where(
        and(
          eq(analyticsEventsTable.type, "search"),
          isNotNull(analyticsEventsTable.query),
          ne(analyticsEventsTable.query, ""),
        ),
      )
      .groupBy(analyticsEventsTable.query)
      .orderBy(desc(count()))
      .limit(10);

    const topCategories = await db
      .select({ label: analyticsEventsTable.category, count: count() })
      .from(analyticsEventsTable)
      .where(
        and(
          eq(analyticsEventsTable.type, "category_select"),
          isNotNull(analyticsEventsTable.category),
          ne(analyticsEventsTable.category, ""),
        ),
      )
      .groupBy(analyticsEventsTable.category)
      .orderBy(desc(count()))
      .limit(10);

    const topViewedAttorneys = await db
      .select({
        attorneyId: analyticsEventsTable.attorneyId,
        attorneyName: attorneysTable.fullName,
        count: count(),
      })
      .from(analyticsEventsTable)
      .innerJoin(
        attorneysTable,
        eq(analyticsEventsTable.attorneyId, attorneysTable.id),
      )
      .where(eq(analyticsEventsTable.type, "attorney_view"))
      .groupBy(analyticsEventsTable.attorneyId, attorneysTable.fullName)
      .orderBy(desc(count()))
      .limit(10);

    const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);
    const dayExpr = sql<string>`to_char(date_trunc('day', ${analyticsEventsTable.createdAt}), 'YYYY-MM-DD')`;
    const eventsByDay = await db
      .select({ date: dayExpr, count: count() })
      .from(analyticsEventsTable)
      .where(gte(analyticsEventsTable.createdAt, since))
      .groupBy(dayExpr)
      .orderBy(dayExpr);

    res.json(
      GetAdminAnalyticsResponse.parse({
        totalEvents,
        totalSearches,
        totalProfileViews,
        totalConsultationClicks,
        approvedAttorneys,
        pendingApplications,
        topSearches: topSearches.map((r) => ({
          label: r.label ?? "",
          count: r.count,
        })),
        topCategories: topCategories.map((r) => ({
          label: r.label ?? "",
          count: r.count,
        })),
        topViewedAttorneys: topViewedAttorneys.map((r) => ({
          attorneyId: r.attorneyId ?? 0,
          attorneyName: r.attorneyName,
          count: r.count,
        })),
        eventsByDay,
      }),
    );
  },
);

router.get("/admin/events", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAnalyticsEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = Math.min(Math.max(parsed.data.limit ?? 100, 1), 500);

  const rows = await db
    .select({
      id: analyticsEventsTable.id,
      type: analyticsEventsTable.type,
      attorneyId: analyticsEventsTable.attorneyId,
      query: analyticsEventsTable.query,
      category: analyticsEventsTable.category,
      path: analyticsEventsTable.path,
      sessionId: analyticsEventsTable.sessionId,
      attorneyName: attorneysTable.fullName,
      createdAt: analyticsEventsTable.createdAt,
    })
    .from(analyticsEventsTable)
    .leftJoin(
      attorneysTable,
      eq(analyticsEventsTable.attorneyId, attorneysTable.id),
    )
    .orderBy(desc(analyticsEventsTable.createdAt))
    .limit(limit);

  res.json(ListAnalyticsEventsResponse.parse(rows));
});

// --- Accounts (Supabase-backed attorney accounts) --------------------------

type AccountListingSummary = {
  id: number;
  fullName: string;
  firmName: string;
  status: string;
  archived: boolean;
};

// Loads each owner's listing summaries in one query, grouped by ownerId. Used
// to attach listings to accounts without an N+1 per account.
async function listingsByOwnerIds(
  ids: string[],
): Promise<Map<string, AccountListingSummary[]>> {
  const map = new Map<string, AccountListingSummary[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      id: attorneysTable.id,
      fullName: attorneysTable.fullName,
      firmName: attorneysTable.firmName,
      status: attorneysTable.status,
      archivedAt: attorneysTable.archivedAt,
      ownerId: attorneysTable.ownerId,
    })
    .from(attorneysTable)
    .where(inArray(attorneysTable.ownerId, ids));
  for (const r of rows) {
    if (!r.ownerId) continue;
    const list = map.get(r.ownerId) ?? [];
    list.push({
      id: r.id,
      fullName: r.fullName,
      firmName: r.firmName,
      status: r.status,
      archived: r.archivedAt != null,
    });
    map.set(r.ownerId, list);
  }
  return map;
}

// Supabase email/password users carry no profile name or avatar, so those
// fields are always null; the account schema keeps them nullable. `banned` is
// derived from banned_until being set in the future.
function mapSupabaseUser(user: SupabaseUser, listings: AccountListingSummary[]) {
  const banned = Boolean(
    user.banned_until && new Date(user.banned_until).getTime() > Date.now(),
  );
  const accountType = getAccountType(user);
  const firm = getFirmInfo(user);
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: null,
    lastName: null,
    imageUrl: null,
    createdAt: new Date(user.created_at).toISOString(),
    lastSignInAt: user.last_sign_in_at
      ? new Date(user.last_sign_in_at).toISOString()
      : null,
    banned,
    accountType,
    // firmStatus is meaningful only for firm accounts; solo accounts report null.
    firmStatus: accountType === "firm" ? getFirmStatus(user) : null,
    firmName: firm.firmName,
    firmWebsite: firm.firmWebsite,
    firmAddress: firm.firmAddress,
    firmPhone: firm.firmPhone,
    listings,
  };
}

function authErrorStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

// Maps a Supabase auth error to an HTTP response: 404 -> not found,
// 429 -> rate limited, anything else -> 502 (auth provider failure).
function respondAuthError(
  res: Response,
  err: unknown,
  req: Request,
  notFoundMessage: string,
  fallbackMessage: string,
): void {
  const status = authErrorStatus(err);
  if (status === 404) {
    res.status(404).json({ error: notFoundMessage });
    return;
  }
  if (status === 429) {
    res.status(429).json({
      error: "The auth provider is rate limiting requests. Try again shortly.",
    });
    return;
  }
  req.log.error({ err }, fallbackMessage);
  res.status(502).json({ error: fallbackMessage });
}

router.get("/admin/accounts", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAccountsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const limit = parsed.data.limit ?? 50;
  const offset = parsed.data.offset ?? 0;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    res.status(503).json({ error: "Authentication is not configured." });
    return;
  }

  // Supabase admin pagination is 1-based (page + perPage); translate from the
  // limit/offset query. listUsers returns newest-first.
  const perPage = limit;
  const page = Math.floor(offset / limit) + 1;

  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const users = data.users;
    const listingMap = await listingsByOwnerIds(users.map((u) => u.id));
    const accounts = users.map((u) =>
      mapSupabaseUser(u, listingMap.get(u.id) ?? []),
    );
    res.json(
      ListAccountsResponse.parse({
        accounts,
        totalCount: data.total,
        limit,
        offset,
      }),
    );
  } catch (err) {
    respondAuthError(
      res,
      err,
      req,
      "Account not found.",
      "Could not load accounts from the auth provider.",
    );
  }
});

router.post(
  "/admin/accounts/:id/ban",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetAccountBannedParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SetAccountBannedBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      res.status(503).json({ error: "Authentication is not configured." });
      return;
    }

    try {
      // Ban blocks sign-in but never touches the listing; an admin archives the
      // listing separately if it should also leave the public directory. A long
      // fixed duration is an effectively-permanent suspend that "none" reverses.
      const { data, error } = await supabase.auth.admin.updateUserById(
        params.data.id,
        { ban_duration: parsed.data.banned ? "876000h" : "none" },
      );
      if (error) throw error;
      const user = data.user;
      const listingMap = await listingsByOwnerIds([user.id]);
      res.json(
        SetAccountBannedResponse.parse(
          mapSupabaseUser(user, listingMap.get(user.id) ?? []),
        ),
      );
    } catch (err) {
      respondAuthError(
        res,
        err,
        req,
        "Account not found.",
        "Could not update the account.",
      );
    }
  },
);

router.delete(
  "/admin/accounts/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteAccountParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      res.status(503).json({ error: "Authentication is not configured." });
      return;
    }

    try {
      const { error } = await supabase.auth.admin.deleteUser(params.data.id);
      if (error) throw error;
    } catch (err) {
      respondAuthError(
        res,
        err,
        req,
        "Account not found.",
        "Could not delete the account.",
      );
      return;
    }

    // Delete succeeded (the account is gone). Clearing the now-dangling owner
    // link is best-effort cleanup; if it fails, the account is still deleted,
    // so report success and log the orphaned ownerId for later repair.
    let unlinkedListings = 0;
    try {
      const unlinked = await db
        .update(attorneysTable)
        .set({ ownerId: null })
        .where(eq(attorneysTable.ownerId, params.data.id))
        .returning({ id: attorneysTable.id });
      unlinkedListings = unlinked.length;
    } catch (err) {
      req.log.error(
        { err, ownerId: params.data.id },
        "Account deleted but failed to unlink its listings; ownerId may be dangling",
      );
    }

    res.json(DeleteAccountResponse.parse({ success: true, unlinkedListings }));
  },
);

router.post(
  "/admin/accounts/:id/firm-status",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetFirmStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SetFirmStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      res.status(503).json({ error: "Authentication is not configured." });
      return;
    }

    try {
      // app_metadata is service-role-only, so this status can never be forged by
      // the account holder. updateUserById's app_metadata merge semantics are
      // not guaranteed, so read the current value and spread it to preserve any
      // other provider/app keys.
      const existing = await supabase.auth.admin.getUserById(params.data.id);
      if (existing.error) throw existing.error;
      const currentApp = (existing.data.user?.app_metadata ?? {}) as Record<
        string,
        unknown
      >;
      const { data, error } = await supabase.auth.admin.updateUserById(
        params.data.id,
        { app_metadata: { ...currentApp, firmStatus: parsed.data.status } },
      );
      if (error) throw error;
      const user = data.user;
      const listingMap = await listingsByOwnerIds([user.id]);
      res.json(
        SetFirmStatusResponse.parse(
          mapSupabaseUser(user, listingMap.get(user.id) ?? []),
        ),
      );
    } catch (err) {
      respondAuthError(
        res,
        err,
        req,
        "Account not found.",
        "Could not update the firm account.",
      );
    }
  },
);

export default router;
