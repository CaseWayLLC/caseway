import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  type Mock,
} from "vitest";
import express, { type Express, type Request } from "express";
import request from "supertest";

// Control which Supabase user the route handlers see, per request.
// vi.mock is hoisted, so the factory must not reference outer variables.
vi.mock("../lib/supabaseAuth", () => ({
  getAuthUserId: vi.fn(async () => null as string | null),
  getAuthUser: vi.fn(async () => null as unknown),
  getAccountType: (
    user: { user_metadata?: { accountType?: unknown } } | null,
  ) => (user?.user_metadata?.accountType === "firm" ? "firm" : "solo"),
  getFirmStatus: (user: { app_metadata?: { firmStatus?: unknown } } | null) => {
    const raw = user?.app_metadata?.firmStatus;
    return raw === "approved" || raw === "rejected" ? raw : "pending";
  },
}));

import { getAuthUserId, getAuthUser } from "../lib/supabaseAuth";
import attorneysRouter from "./attorneys";
import { db, attorneysTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const getAuthUserIdMock = getAuthUserId as unknown as Mock;
const getAuthUserMock = getAuthUser as unknown as Mock;

// Default to a firm account so a test can create multiple listings per owner;
// pass "solo" explicitly to exercise the single-listing cap.
function actAs(
  userId: string | null,
  accountType: "solo" | "firm" = "firm",
): void {
  getAuthUserIdMock.mockResolvedValue(userId);
  getAuthUserMock.mockResolvedValue(
    userId
      ? {
          id: userId,
          user_metadata: { accountType },
          // Firm accounts in these pre-firm-approval tests are treated as
          // already approved so they can post; the approval gate itself is
          // covered in attorneys.account-type.test.ts.
          app_metadata: { firmStatus: "approved" },
        }
      : null,
  );
}

const runId = Date.now().toString(36);
const userA = `owner_A_${runId}`;
const userB = `owner_B_${runId}`;
const createdIds: number[] = [];

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Alice Avila",
    firmName: "Avila Law",
    title: "Attorney",
    photoUrl: "https://example.com/a.png",
    phone: "203-555-0101",
    email: `alice-${runId}@example.com`,
    bio: "Owner-scope integration test listing.",
    yearsOfExperience: 10,
    practiceAreas: ["Divorce"],
    jurisdictions: ["Connecticut"],
    officeAddress: "100 Main St, Stamford, CT",
    latitude: 41.05,
    longitude: -73.54,
    calendlyUrl: "https://calendly.com/alice",
    feeType: "Hourly",
    offersFreeConsultation: true,
    videoConferencing: true,
    languages: ["English"],
    ...overrides,
  };
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  // Route handlers call req.log on validation failures; provide a stub.
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
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await db
      .delete(attorneysTable)
      .where(inArray(attorneysTable.id, createdIds));
  }
});

describe("attorney listing owner-scoping", () => {
  let listingIdA: number;

  it("requires authentication to create a listing", async () => {
    actAs(null);
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(401);
  });

  it("lets attorney A create a listing owned by A", async () => {
    // Create as a solo account so the new listing starts "pending" (firm
    // accounts post pre-approved); this case asserts the default review state.
    actAs(userA, "solo");
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf("number");
    listingIdA = res.body.id;
    createdIds.push(listingIdA);

    const [row] = await db
      .select()
      .from(attorneysTable)
      .where(eq(attorneysTable.id, listingIdA));
    expect(row?.ownerId).toBe(userA);
    expect(row?.status).toBe("pending");
  });

  it("GET /attorneys/mine returns only the caller's own rows (A)", async () => {
    actAs(userA);
    const res = await request(app).get("/api/attorneys/mine");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids: number[] = res.body.map((a: { id: number }) => a.id);
    expect(ids).toContain(listingIdA);
    // The public response intentionally omits ownerId, so confirm scoping by
    // cross-checking the DB: every id returned by A's "mine" must be owned by A.
    const rows = await db
      .select()
      .from(attorneysTable)
      .where(inArray(attorneysTable.id, ids));
    expect(rows.length).toBe(ids.length);
    expect(rows.every((r) => r.ownerId === userA)).toBe(true);
  });

  it("GET /attorneys/mine for attorney B excludes A's listing", async () => {
    actAs(userB);
    const res = await request(app).get("/api/attorneys/mine");
    expect(res.status).toBe(200);
    // B is a brand-new owner this run, so B's listings must be empty and must
    // never include A's listing.
    const ids: number[] = res.body.map((a: { id: number }) => a.id);
    expect(ids).not.toContain(listingIdA);
    expect(res.body.length).toBe(0);
  });

  it("rejects a cross-account PATCH from B with 404", async () => {
    actAs(userB);
    const res = await request(app)
      .patch(`/api/attorneys/${listingIdA}`)
      .send(validBody({ bio: "Attempted cross-account edit by B." }));
    expect(res.status).toBe(404);

    // A's listing must be untouched.
    const [row] = await db
      .select()
      .from(attorneysTable)
      .where(eq(attorneysTable.id, listingIdA));
    expect(row?.bio).toBe("Owner-scope integration test listing.");
    expect(row?.ownerId).toBe(userA);
  });

  it("rejects a cross-account PATCH with a partial body with 404 (not 400)", async () => {
    actAs(userB);
    // Only one field is sent: a non-owner must be turned away with a 404 from
    // the ownership check BEFORE body validation runs, so an incomplete body
    // never produces a 400 that would leak whether the listing exists.
    const res = await request(app)
      .patch(`/api/attorneys/${listingIdA}`)
      .send({ bio: "Partial cross-account edit by B." });
    expect(res.status).toBe(404);

    // A's listing must be untouched.
    const [row] = await db
      .select()
      .from(attorneysTable)
      .where(eq(attorneysTable.id, listingIdA));
    expect(row?.bio).toBe("Owner-scope integration test listing.");
    expect(row?.ownerId).toBe(userA);
  });

  it("rejects an unauthenticated PATCH with 401", async () => {
    actAs(null);
    const res = await request(app)
      .patch(`/api/attorneys/${listingIdA}`)
      .send(validBody({ bio: "Anonymous edit attempt." }));
    expect(res.status).toBe(401);
  });

  it("lets attorney A edit their own listing", async () => {
    actAs(userA);
    const res = await request(app)
      .patch(`/api/attorneys/${listingIdA}`)
      .send(validBody({ bio: "Updated by the rightful owner." }));
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("Updated by the rightful owner.");

    const [row] = await db
      .select()
      .from(attorneysTable)
      .where(eq(attorneysTable.id, listingIdA));
    expect(row?.bio).toBe("Updated by the rightful owner.");
    expect(row?.ownerId).toBe(userA);
  });

  it("rejects an unauthenticated analytics request with 401", async () => {
    actAs(null);
    const res = await request(app).get(
      `/api/attorneys/${listingIdA}/analytics/30`,
    );
    expect(res.status).toBe(401);
  });

  it("hides A's analytics from a non-owner (B) with 404", async () => {
    actAs(userB);
    const res = await request(app).get(
      `/api/attorneys/${listingIdA}/analytics/30`,
    );
    expect(res.status).toBe(404);
    // Existence must not be revealed: no analytics payload leaks to a non-owner.
    expect(res.body.totals).toBeUndefined();
    expect(res.body.timeseries).toBeUndefined();
  });

  it("returns analytics for the rightful owner (A) with totals + timeseries", async () => {
    actAs(userA);
    const res = await request(app).get(
      `/api/attorneys/${listingIdA}/analytics/30`,
    );
    expect(res.status).toBe(200);
    expect(res.body.totals.profileViews).toBeTypeOf("number");
    expect(res.body.totals.consultationClicks).toBeTypeOf("number");
    expect(res.body.totals.websiteClicks).toBeTypeOf("number");
    expect(Array.isArray(res.body.timeseries)).toBe(true);
    // The window is gap-filled to exactly one row per day.
    expect(res.body.timeseries.length).toBe(30);
    expect(res.body.timeseries[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("honors a valid analytics window (7 days)", async () => {
    actAs(userA);
    const res = await request(app).get(
      `/api/attorneys/${listingIdA}/analytics/7`,
    );
    expect(res.status).toBe(200);
    expect(res.body.timeseries.length).toBe(7);
  });

  it("clamps an out-of-range analytics window to the 30-day default", async () => {
    actAs(userA);
    const res = await request(app).get(
      `/api/attorneys/${listingIdA}/analytics/999`,
    );
    expect(res.status).toBe(200);
    expect(res.body.timeseries.length).toBe(30);
  });
});
