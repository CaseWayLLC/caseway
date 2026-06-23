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

// Control which Supabase user (and account type) the route handlers see.
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

function actAs(
  userId: string | null,
  accountType: "solo" | "firm" = "solo",
  firmStatus: "pending" | "approved" | "rejected" = "approved",
): void {
  getAuthUserIdMock.mockResolvedValue(userId);
  getAuthUserMock.mockResolvedValue(
    userId
      ? {
          id: userId,
          user_metadata: { accountType },
          // app_metadata is service-role-only; firmStatus gates whether an
          // approved firm may post. Solo accounts ignore it.
          app_metadata: { firmStatus },
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
    fullName: "Cap Tester",
    firmName: "Cap Law",
    title: "Attorney",
    photoUrl: "https://example.com/c.png",
    phone: "203-555-0303",
    email: `cap-${runId}-${emailSeq}@example.com`,
    bio: "Account-type cap integration test listing.",
    yearsOfExperience: 9,
    practiceAreas: ["Divorce"],
    jurisdictions: ["Connecticut"],
    officeAddress: "300 Main St, Stamford, CT",
    latitude: 41.05,
    longitude: -73.54,
    calendlyUrl: "https://calendly.com/cap",
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

describe("attorney account-type listing cap", () => {
  it("lets a solo account create its first listing", async () => {
    actAs(`solo_first_${runId}`, "solo");
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(201);
    createdIds.push(res.body.id);
  });

  it("blocks a solo account's second listing with 409 solo_listing_limit", async () => {
    const owner = `solo_cap_${runId}`;
    actAs(owner, "solo");

    const first = await request(app).post("/api/attorneys").send(validBody());
    expect(first.status).toBe(201);
    createdIds.push(first.body.id);

    const second = await request(app).post("/api/attorneys").send(validBody());
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("solo_listing_limit");
  });

  it("lets a firm account create multiple listings", async () => {
    const owner = `firm_multi_${runId}`;
    actAs(owner, "firm");

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post("/api/attorneys").send(validBody());
      expect(res.status).toBe(201);
      createdIds.push(res.body.id);
    }
  });

  it("frees the solo slot when the existing listing is rejected", async () => {
    const owner = `solo_rejected_${runId}`;
    actAs(owner, "solo");

    const first = await request(app).post("/api/attorneys").send(validBody());
    expect(first.status).toBe(201);
    createdIds.push(first.body.id);

    // A rejected listing no longer occupies the single solo slot.
    await db
      .update(attorneysTable)
      .set({ status: "rejected" })
      .where(eq(attorneysTable.id, first.body.id));

    const second = await request(app).post("/api/attorneys").send(validBody());
    expect(second.status).toBe(201);
    createdIds.push(second.body.id);
  });

  it("frees the solo slot when the existing listing is archived", async () => {
    const owner = `solo_archived_${runId}`;
    actAs(owner, "solo");

    const first = await request(app).post("/api/attorneys").send(validBody());
    expect(first.status).toBe(201);
    createdIds.push(first.body.id);

    // A soft-deleted (archived) listing no longer occupies the solo slot.
    await db
      .update(attorneysTable)
      .set({ archivedAt: new Date() })
      .where(eq(attorneysTable.id, first.body.id));

    const second = await request(app).post("/api/attorneys").send(validBody());
    expect(second.status).toBe(201);
    createdIds.push(second.body.id);
  });

  it("treats a missing account type as solo (restrictive)", async () => {
    const owner = `solo_default_${runId}`;
    // No account type in metadata at all -> must be treated as solo.
    getAuthUserIdMock.mockResolvedValue(owner);
    getAuthUserMock.mockResolvedValue({ id: owner, user_metadata: {} });

    const first = await request(app).post("/api/attorneys").send(validBody());
    expect(first.status).toBe(201);
    createdIds.push(first.body.id);

    const second = await request(app).post("/api/attorneys").send(validBody());
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("solo_listing_limit");
  });

  it("serializes concurrent solo creates so only one succeeds (advisory lock)", async () => {
    const owner = `solo_race_${runId}`;
    actAs(owner, "solo");

    const [r1, r2] = await Promise.all([
      request(app).post("/api/attorneys").send(validBody()),
      request(app).post("/api/attorneys").send(validBody()),
    ]);

    for (const r of [r1, r2]) {
      if (r.status === 201) createdIds.push(r.body.id);
    }

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    const limited = [r1, r2].find((r) => r.status === 409);
    expect(limited?.body.code).toBe("solo_listing_limit");
  });
});

describe("law firm account approval gate", () => {
  it("blocks a pending firm account from posting with 403 firm_not_approved", async () => {
    actAs(`firm_pending_${runId}`, "firm", "pending");
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("firm_not_approved");
  });

  it("treats a firm with no firmStatus as pending (restrictive) -> 403", async () => {
    const owner = `firm_no_status_${runId}`;
    // accountType firm but app_metadata has no firmStatus at all.
    getAuthUserIdMock.mockResolvedValue(owner);
    getAuthUserMock.mockResolvedValue({
      id: owner,
      user_metadata: { accountType: "firm" },
      app_metadata: {},
    });
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("firm_not_approved");
  });

  it("blocks a rejected firm account from posting with 403 firm_not_approved", async () => {
    actAs(`firm_rejected_${runId}`, "firm", "rejected");
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("firm_not_approved");
  });

  it("lets an approved firm post a listing that is created already approved", async () => {
    actAs(`firm_approved_${runId}`, "firm", "approved");
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("approved");
    createdIds.push(res.body.id);
  });

  it("creates solo listings as pending (per-listing review)", async () => {
    actAs(`solo_status_${runId}`, "solo");
    const res = await request(app).post("/api/attorneys").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    createdIds.push(res.body.id);
  });
});
