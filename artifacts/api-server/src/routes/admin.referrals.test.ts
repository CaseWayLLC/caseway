import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express, type Request } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

import adminRouter from "./admin";
import { createAdminToken } from "../lib/adminAuth";
import { db, attorneysTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const runId = Date.now().toString(36);
const createdIds: number[] = [];

// A forged-but-valid admin cookie, signed with the same SESSION_SECRET the
// server uses. requireAdmin accepts it exactly like a real login.
const adminCookie = `caseway_admin=${createAdminToken()}`;

let app: Express;

function baseRow(overrides: Partial<typeof attorneysTable.$inferInsert> = {}) {
  return {
    fullName: "Ref Tester",
    firmName: "Referral Law",
    title: "Attorney",
    photoUrl: "https://example.com/r.png",
    phone: "203-555-0303",
    email: `adminref-${runId}-${Math.random().toString(36).slice(2)}@example.com`,
    bio: "Admin referral integration test listing.",
    yearsOfExperience: 11,
    practiceAreas: ["Divorce"],
    jurisdictions: ["Connecticut"],
    officeAddress: "300 Main St, Stamford, CT",
    latitude: 41.05,
    longitude: -73.54,
    calendlyUrl: "https://calendly.com/adminref",
    feeType: "Hourly",
    offersFreeConsultation: true,
    videoConferencing: true,
    languages: ["English"],
    ...overrides,
  };
}

// A full, valid AdminUpdateAttorneyBody payload for the generic admin edit form.
function editBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Edited Name",
    firmName: "Edited Firm",
    title: "Attorney",
    photoUrl: "https://example.com/edited.png",
    phone: "203-555-0404",
    email: `adminedit-${runId}-${Math.random().toString(36).slice(2)}@example.com`,
    bio: "Edited by the admin form.",
    yearsOfExperience: 15,
    practiceAreas: ["Divorce"],
    jurisdictions: ["Connecticut"],
    officeAddress: "400 Main St, Stamford, CT",
    latitude: 41.06,
    longitude: -73.55,
    feeType: "Hourly",
    offersFreeConsultation: true,
    videoConferencing: true,
    languages: ["English"],
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
  app.use(cookieParser());
  app.use((req: Request, _res, next) => {
    (req as Request & { log: unknown }).log = {
      info() {},
      warn() {},
      error() {},
      debug() {},
    } as unknown as Request["log"];
    next();
  });
  app.use(adminRouter);
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await db
      .delete(attorneysTable)
      .where(inArray(attorneysTable.id, createdIds));
  }
});

describe("GET /admin/referrals leaderboard", () => {
  it("requires admin auth (401 without a valid cookie)", async () => {
    const res = await request(app).get("/admin/referrals");
    expect(res.status).toBe(401);
  });

  it("ranks referrers by approved, live referee count and excludes pending referees", async () => {
    // Top referrer: two approved referees + one pending (must not count).
    const top = await insertRow({ status: "approved" });
    await insertRow({ status: "approved", referredById: top });
    await insertRow({ status: "approved", referredById: top });
    await insertRow({ status: "pending", referredById: top });

    // Runner-up: a single approved referee.
    const runnerUp = await insertRow({ status: "approved" });
    await insertRow({ status: "approved", referredById: runnerUp });

    const res = await request(app)
      .get("/admin/referrals")
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const topEntry = res.body.find((e: { id: number }) => e.id === top);
    const runnerEntry = res.body.find((e: { id: number }) => e.id === runnerUp);
    expect(topEntry).toBeDefined();
    expect(runnerEntry).toBeDefined();

    // Pending referee is excluded from the count.
    expect(topEntry.referralCount).toBe(2);
    expect(topEntry.referees.length).toBe(2);
    expect(runnerEntry.referralCount).toBe(1);

    // Higher count ranks first (other concurrent test rows don't affect the
    // relative order of these two, since 2 > 1).
    const topIdx = res.body.findIndex((e: { id: number }) => e.id === top);
    const runnerIdx = res.body.findIndex(
      (e: { id: number }) => e.id === runnerUp,
    );
    expect(topIdx).toBeLessThan(runnerIdx);
  });
});

describe("PATCH /admin/attorneys/:id referral immutability", () => {
  it("strips referredById: the admin edit form cannot change who referred a listing", async () => {
    const originalReferrer = await insertRow({ status: "approved" });
    const otherReferrer = await insertRow({ status: "approved" });
    const referee = await insertRow({
      status: "approved",
      referredById: originalReferrer,
    });
    expect(await referredByIdOf(referee)).toBe(originalReferrer);

    const res = await request(app)
      .patch(`/admin/attorneys/${referee}`)
      .set("Cookie", adminCookie)
      .send(editBody({ referredById: otherReferrer }));
    expect(res.status).toBe(200);
    // The edit applied (name changed) but the referral link is untouched.
    expect(res.body.fullName).toBe("Edited Name");
    expect(await referredByIdOf(referee)).toBe(originalReferrer);
  });
});
