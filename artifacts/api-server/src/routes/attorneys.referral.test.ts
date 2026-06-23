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

// Default to a firm account so the same owner can hold multiple listings (e.g.
// the self-referral case); the cap itself is exercised in its own test file.
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
const createdIds: number[] = [];
let emailSeq = 0;

function validBody(overrides: Record<string, unknown> = {}) {
  emailSeq += 1;
  return {
    fullName: "Ref Tester",
    firmName: "Referral Law",
    title: "Attorney",
    photoUrl: "https://example.com/r.png",
    phone: "203-555-0202",
    email: `ref-${runId}-${emailSeq}@example.com`,
    bio: "Referral feature integration test listing.",
    yearsOfExperience: 12,
    practiceAreas: ["Divorce"],
    jurisdictions: ["Connecticut"],
    officeAddress: "200 Main St, Stamford, CT",
    latitude: 41.05,
    longitude: -73.54,
    calendlyUrl: "https://calendly.com/ref",
    feeType: "Hourly",
    offersFreeConsultation: true,
    videoConferencing: true,
    languages: ["English"],
    ...overrides,
  };
}

let app: Express;

// Create a listing as `userId`, record it for cleanup, and return its id.
async function createAs(
  userId: string,
  overrides: Record<string, unknown> = {},
): Promise<number> {
  actAs(userId);
  const res = await request(app)
    .post("/api/attorneys")
    .send(validBody(overrides));
  expect(res.status).toBe(201);
  const id = res.body.id as number;
  createdIds.push(id);
  return id;
}

// Listings are created "pending"; only approved, live rows count toward the
// referral total, so approve directly (mirrors the admin approve endpoint).
async function approve(id: number): Promise<void> {
  await db
    .update(attorneysTable)
    .set({ status: "approved" })
    .where(eq(attorneysTable.id, id));
}

// Firm accounts now post listings that go live (status "approved") right after
// payment, so the firm-default createAs() inserts an already-approved row.
// Several referral cases need a referrer/referee that is NOT yet approved, so
// force the row back to "pending" to model the admin queue holding it.
async function setPending(id: number): Promise<void> {
  await db
    .update(attorneysTable)
    .set({ status: "pending" })
    .where(eq(attorneysTable.id, id));
}

async function referredByIdOf(id: number): Promise<number | null> {
  const [row] = await db
    .select({ referredById: attorneysTable.referredById })
    .from(attorneysTable)
    .where(eq(attorneysTable.id, id));
  return row?.referredById ?? null;
}

beforeAll(() => {
  app = express();
  app.use(express.json());
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

describe("attorney referral capture, counting, and ranking", () => {
  it("captures a valid referrer and counts only approved, live referees", async () => {
    const referrerId = await createAs("referrer_owner");
    await approve(referrerId);

    // Two approved referees from different accounts → both count.
    const refereeA = await createAs("referee_a", { referredById: referrerId });
    await approve(refereeA);
    const refereeB = await createAs("referee_b", { referredById: referrerId });
    await approve(refereeB);

    // A third referee that stays pending must NOT count toward the total.
    const refereePending = await createAs("referee_pending", {
      referredById: referrerId,
    });
    // Firm listings post as "approved"; hold this one pending so it does NOT
    // count toward the referrer's approved-referee total.
    await setPending(refereePending);

    expect(await referredByIdOf(refereeA)).toBe(referrerId);
    expect(await referredByIdOf(refereeB)).toBe(referrerId);
    expect(await referredByIdOf(refereePending)).toBe(referrerId);

    actAs(null);
    const res = await request(app).get("/api/attorneys");
    expect(res.status).toBe(200);
    const referrer = res.body.find((a: { id: number }) => a.id === referrerId);
    expect(referrer).toBeDefined();
    expect(referrer.referralCount).toBe(2);
  });

  it("ignores a non-existent referrer id without blocking signup", async () => {
    const id = await createAs("referee_bad_ref", { referredById: 999_000_111 });
    expect(await referredByIdOf(id)).toBeNull();
  });

  it("ignores a referrer whose listing is not yet approved", async () => {
    const pendingReferrer = await createAs("pending_referrer");
    // Firm listings post as "approved"; force it back to pending so the
    // referrer is genuinely "not yet approved" when the referee is created.
    await setPending(pendingReferrer);
    const id = await createAs("referee_of_pending", {
      referredById: pendingReferrer,
    });
    expect(await referredByIdOf(id)).toBeNull();
  });

  it("rejects a self-referral (referrer owned by the same account)", async () => {
    const selfId = await createAs("self_ref_owner");
    await approve(selfId);
    // Same account tries to claim its own approved listing as the referrer.
    const id = await createAs("self_ref_owner", { referredById: selfId });
    expect(await referredByIdOf(id)).toBeNull();
  });

  it("treats referredById as immutable: an owner PATCH cannot change it", async () => {
    const referrerId = await createAs("immut_referrer");
    await approve(referrerId);
    const otherReferrer = await createAs("immut_other_referrer");
    await approve(otherReferrer);

    const refereeId = await createAs("immut_referee", {
      referredById: referrerId,
    });
    expect(await referredByIdOf(refereeId)).toBe(referrerId);

    // The rightful owner edits their listing and tries to swap the referrer.
    actAs("immut_referee");
    const res = await request(app)
      .patch(`/api/attorneys/${refereeId}`)
      .send(
        validBody({ referredById: otherReferrer, bio: "Edited by owner." }),
      );
    expect(res.status).toBe(200);

    // The referral link must be unchanged despite the PATCH payload.
    expect(await referredByIdOf(refereeId)).toBe(referrerId);
  });
});
