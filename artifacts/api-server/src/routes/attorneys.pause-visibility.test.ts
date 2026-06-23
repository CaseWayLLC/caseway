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
import { getDemoMode, setDemoMode } from "../lib/settings";

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
const userA = `pause_owner_A_${runId}`;
const userB = `pause_owner_B_${runId}`;
// A practice area unique to this test run so the "similar" ranking is
// deterministic: only the test listings carry it, so they out-rank every real
// attorney (overlap 1 vs 0) and are guaranteed to land in the top-4 result.
const uniqueArea = `ZZ-Pause-Test-${runId}`;
const createdIds: number[] = [];

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Pauline Tester",
    firmName: "Pause Law",
    title: "Attorney",
    photoUrl: "https://example.com/p.png",
    phone: "203-555-0199",
    email: `pauline-${runId}@example.com`,
    bio: "Pause-visibility integration test listing.",
    yearsOfExperience: 8,
    practiceAreas: [uniqueArea],
    jurisdictions: ["Connecticut"],
    officeAddress: "200 Main St, Stamford, CT",
    latitude: 41.05,
    longitude: -73.54,
    calendlyUrl: "https://calendly.com/pauline",
    feeType: "Hourly",
    offersFreeConsultation: true,
    videoConferencing: true,
    languages: ["English"],
    ...overrides,
  };
}

let app: Express;

// Creates a listing owned by `owner` and forces it live (approved) directly in
// the DB, mirroring an admin approval without needing the admin endpoint.
async function createApprovedListing(
  owner: string,
  overrides: Record<string, unknown> = {},
): Promise<number> {
  actAs(owner);
  const res = await request(app)
    .post("/api/attorneys")
    .send(validBody(overrides));
  expect(res.status).toBe(201);
  const id: number = res.body.id;
  createdIds.push(id);
  await db
    .update(attorneysTable)
    .set({ status: "approved" })
    .where(eq(attorneysTable.id, id));
  return id;
}

async function statusOf(id: number): Promise<string | undefined> {
  const [row] = await db
    .select()
    .from(attorneysTable)
    .where(eq(attorneysTable.id, id));
  return row?.status;
}

async function listingIds(): Promise<number[]> {
  const res = await request(app).get("/api/attorneys");
  expect(res.status).toBe(200);
  return res.body.map((a: { id: number }) => a.id);
}

async function similarIdsFor(id: number): Promise<number[]> {
  const res = await request(app).get(`/api/attorneys/${id}/similar`);
  expect(res.status).toBe(200);
  return res.body.map((a: { id: number }) => a.id);
}

async function totalAttorneys(): Promise<number> {
  const res = await request(app).get("/api/stats");
  expect(res.status).toBe(200);
  return res.body.totalAttorneys as number;
}

let listingId: number;
let neighborId: number;

beforeAll(async () => {
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

  // The listing under test, plus a second approved listing used purely as the
  // viewpoint for the "similar" endpoint (it shares the unique practice area so
  // the listing under test is its top similar match).
  listingId = await createApprovedListing(userA);
  neighborId = await createApprovedListing(userA, {
    email: `neighbor-${runId}@example.com`,
    fullName: "Nadia Neighbor",
  });
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await db
      .delete(attorneysTable)
      .where(inArray(attorneysTable.id, createdIds));
  }
});

describe("pausing a listing hides it from clients", () => {
  it("an approved listing is visible across every public read", async () => {
    actAs(null);

    expect(await listingIds()).toContain(listingId);

    const detail = await request(app).get(`/api/attorneys/${listingId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(listingId);

    expect(await similarIdsFor(neighborId)).toContain(listingId);
  });

  it("rejects pausing another owner's listing with 404 and leaves it live", async () => {
    actAs(userB);
    const res = await request(app)
      .post(`/api/attorneys/${listingId}/pause`)
      .send({ paused: true });
    expect(res.status).toBe(404);

    // The listing must remain approved and publicly visible.
    expect(await statusOf(listingId)).toBe("approved");
    actAs(null);
    expect(await listingIds()).toContain(listingId);
  });

  it("pausing hides the listing from every public read", async () => {
    const totalBefore = await totalAttorneys();

    actAs(userA);
    const res = await request(app)
      .post(`/api/attorneys/${listingId}/pause`)
      .send({ paused: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("paused");

    actAs(null);
    // Directory list no longer includes it.
    expect(await listingIds()).not.toContain(listingId);

    // Profile page 404s.
    const detail = await request(app).get(`/api/attorneys/${listingId}`);
    expect(detail.status).toBe(404);

    // Similar lawyers for the neighbor no longer surfaces it.
    expect(await similarIdsFor(neighborId)).not.toContain(listingId);

    // Stats exclude it (count drops by exactly one).
    expect(await totalAttorneys()).toBe(totalBefore - 1);
  });

  it("resuming restores it to the directory without admin re-approval", async () => {
    actAs(userA);
    const res = await request(app)
      .post(`/api/attorneys/${listingId}/pause`)
      .send({ paused: false });
    expect(res.status).toBe(200);
    // Resume goes straight back to "approved" — never "pending" — so no admin
    // re-approval is required.
    expect(res.body.status).toBe("approved");
    expect(await statusOf(listingId)).toBe("approved");

    actAs(null);
    expect(await listingIds()).toContain(listingId);

    const detail = await request(app).get(`/api/attorneys/${listingId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(listingId);

    expect(await similarIdsFor(neighborId)).toContain(listingId);
  });
});

// Demo mode rewrites the shared public-read visibility conditions
// (approvedVisibleCondition + the isDemo filters in /attorneys, /attorneys/:id,
// /attorneys/:id/similar, /stats). A regression could let a paused real listing
// leak only in one of the two demo states, so we pin the flag and assert pause
// hides the listing identically whether demo mode is on or off.
describe("paused listings stay hidden regardless of demo mode", () => {
  let originalDemoMode: boolean;

  beforeAll(async () => {
    originalDemoMode = await getDemoMode();
  });

  afterAll(async () => {
    // Restore whatever the dev DB had before this block ran.
    await setDemoMode(originalDemoMode);
  });

  for (const demoEnabled of [false, true]) {
    const label = demoEnabled ? "on" : "off";

    describe(`with demo mode ${label}`, () => {
      beforeAll(async () => {
        await setDemoMode(demoEnabled);
        // The listing under test is a real (isDemo = false) listing; force it
        // live so each state starts from an approved, publicly-visible listing.
        await db
          .update(attorneysTable)
          .set({ status: "approved" })
          .where(eq(attorneysTable.id, listingId));
      });

      it("flag is pinned to the expected state", async () => {
        expect(await getDemoMode()).toBe(demoEnabled);
      });

      it("an approved real listing is visible across every public read", async () => {
        actAs(null);

        expect(await listingIds()).toContain(listingId);

        const detail = await request(app).get(`/api/attorneys/${listingId}`);
        expect(detail.status).toBe(200);
        expect(detail.body.id).toBe(listingId);

        expect(await similarIdsFor(neighborId)).toContain(listingId);
      });

      it("a paused real listing is excluded from all four public reads", async () => {
        const totalBefore = await totalAttorneys();

        actAs(userA);
        const res = await request(app)
          .post(`/api/attorneys/${listingId}/pause`)
          .send({ paused: true });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("paused");

        actAs(null);
        // Pausing must not have flipped the demo flag.
        expect(await getDemoMode()).toBe(demoEnabled);

        // 1) Directory list.
        expect(await listingIds()).not.toContain(listingId);

        // 2) Profile page.
        const detail = await request(app).get(`/api/attorneys/${listingId}`);
        expect(detail.status).toBe(404);

        // 3) Similar lawyers.
        expect(await similarIdsFor(neighborId)).not.toContain(listingId);

        // 4) Stats count drops by exactly one.
        expect(await totalAttorneys()).toBe(totalBefore - 1);
      });

      it("resuming restores it across every public read", async () => {
        actAs(userA);
        const res = await request(app)
          .post(`/api/attorneys/${listingId}/pause`)
          .send({ paused: false });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("approved");

        actAs(null);
        expect(await listingIds()).toContain(listingId);

        const detail = await request(app).get(`/api/attorneys/${listingId}`);
        expect(detail.status).toBe(200);
        expect(detail.body.id).toBe(listingId);

        expect(await similarIdsFor(neighborId)).toContain(listingId);
      });
    });
  }
});
