import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express, type Request } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

import attorneysRouter from "./attorneys";
import adminRouter from "./admin";
import { reconcileBilling } from "../lib/billing";
import { createAdminToken } from "../lib/adminAuth";
import { db, attorneysTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  getDemoMode,
  setDemoMode,
  getPaidPostsEnabled,
  setPaidPostsEnabled,
} from "../lib/settings";

// The aggregate read endpoints (/stats, /counties, /practice-area-counties) are
// served from in-process TTL caches (60s). Every write that can change which
// listings are publicly visible MUST call bustAggregateCaches() so the next read
// recomputes immediately instead of serving a stale count for up to the TTL.
// These tests pin that contract for the admin write paths and the billing
// reconcile path: each warms the caches, performs a write, then asserts the
// counts changed on the very next read (which can only happen if the cache was
// busted — without the bust the read would return the warmed, stale value).

const runId = Date.now().toString(36);
const createdIds: number[] = [];

// A forged-but-valid admin cookie, signed with the same SESSION_SECRET the
// server uses. requireAdmin accepts it exactly like a real login.
const adminCookie = `caseway_admin=${createAdminToken()}`;

// Markers unique to this run so the county / practice-area aggregates are
// deterministic: only this test's listing carries this (state, county, area),
// so its count flips cleanly between 0 (hidden) and 1 (visible).
const uniqueState = `ZZ-Cache-State-${runId}`;
const uniqueStateCode = "TZ";
const uniqueCounty = `ZZ-Cache-County-${runId}`;
const uniqueArea = `ZZ-Cache-Area-${runId}`;

let app: Express;

function baseRow(
  overrides: Partial<typeof attorneysTable.$inferInsert> = {},
): typeof attorneysTable.$inferInsert {
  return {
    fullName: "Cache Tester",
    firmName: "Cache Law",
    title: "Attorney",
    photoUrl: "https://example.com/c.png",
    phone: "203-555-0707",
    email: `cache-${runId}-${Math.random().toString(36).slice(2)}@example.com`,
    bio: "Aggregate-cache integration test listing.",
    yearsOfExperience: 9,
    practiceAreas: [uniqueArea],
    jurisdictions: ["Connecticut"],
    officeAddress: "500 Main St, Stamford, CT",
    city: "Stamford",
    county: uniqueCounty,
    state: uniqueState,
    stateCode: uniqueStateCode,
    latitude: 41.05,
    longitude: -73.54,
    calendlyUrl: "https://calendly.com/cache",
    feeType: "Hourly",
    offersFreeConsultation: true,
    videoConferencing: true,
    languages: ["English"],
    isDemo: false,
    ...overrides,
  };
}

async function insertRow(
  overrides: Partial<typeof attorneysTable.$inferInsert> = {},
): Promise<number> {
  const [row] = await db
    .insert(attorneysTable)
    .values(baseRow(overrides))
    .returning({ id: attorneysTable.id });
  createdIds.push(row.id);
  return row.id;
}

async function statsTotal(): Promise<number> {
  const res = await request(app).get("/api/stats");
  expect(res.status).toBe(200);
  return res.body.totalAttorneys as number;
}

// Count of our unique (state, county) bucket in /counties (0 if absent).
async function countyCount(): Promise<number> {
  const res = await request(app).get("/api/counties");
  expect(res.status).toBe(200);
  const row = (res.body as Array<{ state: string; county: string; count: number }>).find(
    (r) => r.state === uniqueState && r.county === uniqueCounty,
  );
  return row?.count ?? 0;
}

// Count of our unique (state, county, area) bucket in /practice-area-counties.
async function practiceAreaCountyCount(): Promise<number> {
  const res = await request(app).get("/api/practice-area-counties");
  expect(res.status).toBe(200);
  const row = (
    res.body as Array<{
      state: string;
      county: string;
      practiceArea: string;
      count: number;
    }>
  ).find(
    (r) =>
      r.state === uniqueState &&
      r.county === uniqueCounty &&
      r.practiceArea === uniqueArea,
  );
  return row?.count ?? 0;
}

// Warm all three aggregate caches so a subsequent stale read would be served
// from cache unless the write under test busts them.
async function warmCaches(): Promise<void> {
  await statsTotal();
  await countyCount();
  await practiceAreaCountyCount();
}

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  // Route handlers call req.log; provide a no-op stub.
  app.use((req: Request, _res, next) => {
    (req as Request & { log: unknown }).log = {
      info() {},
      warn() {},
      error() {},
      debug() {},
    } as unknown as Request["log"];
    next();
  });
  app.use("/api", attorneysRouter);
  app.use("/api", adminRouter);
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await db.delete(attorneysTable).where(inArray(attorneysTable.id, createdIds));
  }
});

describe("admin write paths refresh the public aggregate counts immediately", () => {
  let originalDemo: boolean;
  let originalPaidPosts: boolean;
  let listingId: number;

  beforeAll(async () => {
    originalDemo = await getDemoMode();
    originalPaidPosts = await getPaidPostsEnabled();
    // Deterministic baseline: demo off, paid-posts off so an approved listing is
    // visible purely on its review status (no subscription required).
    await setDemoMode(false);
    await setPaidPostsEnabled(false);

    // Start hidden: a pending listing is excluded from every public read.
    listingId = await insertRow({ status: "pending" });
  });

  afterAll(async () => {
    await setDemoMode(originalDemo);
    await setPaidPostsEnabled(originalPaidPosts);
  });

  it("approve makes the listing count immediately (no stale cache)", async () => {
    await warmCaches();
    const totalBefore = await statsTotal();
    expect(await countyCount()).toBe(0);
    expect(await practiceAreaCountyCount()).toBe(0);

    const res = await request(app)
      .post(`/api/admin/attorneys/${listingId}/approve`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);

    // Next read reflects the approval right away across all three aggregates.
    expect(await statsTotal()).toBe(totalBefore + 1);
    expect(await countyCount()).toBe(1);
    expect(await practiceAreaCountyCount()).toBe(1);
  });

  it("archive drops the listing from the counts immediately", async () => {
    await warmCaches();
    const totalBefore = await statsTotal();
    expect(await countyCount()).toBe(1);
    expect(await practiceAreaCountyCount()).toBe(1);

    const res = await request(app)
      .delete(`/api/admin/attorneys/${listingId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);

    expect(await statsTotal()).toBe(totalBefore - 1);
    expect(await countyCount()).toBe(0);
    expect(await practiceAreaCountyCount()).toBe(0);
  });

  it("restore brings the listing back into the counts immediately", async () => {
    await warmCaches();
    const totalBefore = await statsTotal();
    expect(await countyCount()).toBe(0);

    const res = await request(app)
      .post(`/api/admin/attorneys/${listingId}/restore`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);

    expect(await statsTotal()).toBe(totalBefore + 1);
    expect(await countyCount()).toBe(1);
    expect(await practiceAreaCountyCount()).toBe(1);
  });

  it("reject removes the listing from the counts immediately", async () => {
    await warmCaches();
    const totalBefore = await statsTotal();
    expect(await countyCount()).toBe(1);

    const res = await request(app)
      .post(`/api/admin/attorneys/${listingId}/reject`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);

    expect(await statsTotal()).toBe(totalBefore - 1);
    expect(await countyCount()).toBe(0);
    expect(await practiceAreaCountyCount()).toBe(0);
  });
});

// reconcileBilling syncs the denormalized billing columns from Stripe and, since
// subscription_status drives public visibility under the paid-posts gate, it
// busts the aggregate caches at the end. This pins that bust: a listing made
// visible only by an active subscription must drop out of the counts the instant
// reconcileBilling clears its (now-unbacked) subscription.
describe("reconcileBilling refreshes the public aggregate counts immediately", () => {
  let originalDemo: boolean;
  let originalPaidPosts: boolean;
  let listingId: number;

  beforeAll(async () => {
    originalDemo = await getDemoMode();
    originalPaidPosts = await getPaidPostsEnabled();
    // Paid-posts ON so visibility hinges on subscription_status, not just review
    // status — this is the regime reconcileBilling affects.
    await setDemoMode(false);
    await setPaidPostsEnabled(true);

    // Approved + an active subscription => publicly visible under the gate. The
    // stripe_subscription_id intentionally has no matching row in the synced
    // stripe.subscriptions table, so reconcileBilling's safety net will clear it.
    listingId = await insertRow({
      status: "approved",
      stripeSubscriptionId: `fake_sub_${runId}`,
      stripeCustomerId: `fake_cus_${runId}`,
      subscriptionStatus: "active",
      billingTier: "basic",
    });
  });

  afterAll(async () => {
    await setDemoMode(originalDemo);
    await setPaidPostsEnabled(originalPaidPosts);
  });

  it("a subscription cleared by reconcile drops the listing from the counts", async () => {
    await warmCaches();
    const totalBefore = await statsTotal();
    // Visible while the active subscription stands.
    expect(await countyCount()).toBe(1);
    expect(await practiceAreaCountyCount()).toBe(1);

    // reconcileBilling finds no backing stripe.subscriptions row for our fake
    // id, clears the billing columns (subscription_status -> null), and busts.
    await reconcileBilling();

    // Confirm the visibility-driving column actually flipped.
    const [row] = await db
      .select({ status: attorneysTable.subscriptionStatus })
      .from(attorneysTable)
      .where(eq(attorneysTable.id, listingId));
    expect(row?.status).toBeNull();

    // The very next aggregate read reflects it (cache was busted).
    expect(await statsTotal()).toBe(totalBefore - 1);
    expect(await countyCount()).toBe(0);
    expect(await practiceAreaCountyCount()).toBe(0);
  });
});
