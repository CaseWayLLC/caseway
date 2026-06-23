import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express, type Request } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

import adminRouter from "./admin";
import { createAdminToken } from "../lib/adminAuth";
import { db, attorneysTable, type Attorney } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const runId = Date.now().toString(36);
const createdIds: number[] = [];

// A forged-but-valid admin cookie, signed with the same SESSION_SECRET the
// server uses. requireAdmin accepts it exactly like a real login.
const adminCookie = `caseway_admin=${createAdminToken()}`;

let app: Express;

function baseRow(overrides: Partial<typeof attorneysTable.$inferInsert> = {}) {
  return {
    fullName: "Geo Tester",
    firmName: "Pin Law",
    title: "Attorney",
    photoUrl: "https://example.com/p.png",
    phone: "203-555-0123",
    email: `geo-${runId}-${Math.random().toString(36).slice(2)}@example.com`,
    bio: "Bulk-geocode integration test listing.",
    yearsOfExperience: 9,
    practiceAreas: [`ZZ-Geo-${runId}`],
    jurisdictions: ["Connecticut"],
    officeAddress: "1 Test St, Stamford, CT",
    latitude: 41.0,
    longitude: -73.5,
    calendlyUrl: "https://calendly.com/geo",
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

async function rowOf(id: number): Promise<Attorney | undefined> {
  const [row] = await db
    .select()
    .from(attorneysTable)
    .where(eq(attorneysTable.id, id));
  return row;
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

describe("POST /admin/attorneys/bulk-geocode", () => {
  it("requires admin auth (401 without a valid cookie)", async () => {
    const id = await insertRow();
    const res = await request(app)
      .post("/admin/attorneys/bulk-geocode")
      .send({ updates: [{ id, latitude: 40, longitude: -73 }] });
    expect(res.status).toBe(401);

    // The unauthenticated request must not have touched the row.
    const row = await rowOf(id);
    expect(row?.latitude).toBe(41.0);
    expect(row?.longitude).toBe(-73.5);
  });

  it("updates only lat/lng and returns the correct updated count", async () => {
    const a = await insertRow();
    const b = await insertRow();

    const res = await request(app)
      .post("/admin/attorneys/bulk-geocode")
      .set("Cookie", adminCookie)
      .send({
        updates: [
          { id: a, latitude: 42.1, longitude: -71.2 },
          { id: b, latitude: 38.9, longitude: -77.0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    const rowA = await rowOf(a);
    const rowB = await rowOf(b);
    expect(rowA?.latitude).toBe(42.1);
    expect(rowA?.longitude).toBe(-71.2);
    expect(rowB?.latitude).toBe(38.9);
    expect(rowB?.longitude).toBe(-77.0);
  });

  it("leaves review status, isDemo, and every other field untouched", async () => {
    const id = await insertRow({ status: "approved", isDemo: true });
    const before = await rowOf(id);
    expect(before).toBeDefined();

    const res = await request(app)
      .post("/admin/attorneys/bulk-geocode")
      .set("Cookie", adminCookie)
      .send({ updates: [{ id, latitude: 40.5, longitude: -74.5 }] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const after = await rowOf(id);
    expect(after).toBeDefined();

    // Coordinates changed.
    expect(after!.latitude).toBe(40.5);
    expect(after!.longitude).toBe(-74.5);

    // Everything else is byte-for-byte identical to before the update.
    const ignore = new Set(["latitude", "longitude"]);
    for (const key of Object.keys(before!) as (keyof Attorney)[]) {
      if (ignore.has(key)) continue;
      expect(after![key]).toStrictEqual(before![key]);
    }

    // Spell out the two safety-critical invariants explicitly.
    expect(after!.status).toBe("approved");
    expect(after!.isDemo).toBe(true);
  });

  it("skips archived (soft-deleted) rows: not revived, not edited, not counted", async () => {
    const archivedAt = new Date("2020-01-01T00:00:00.000Z");
    const id = await insertRow({ status: "approved", archivedAt });
    const before = await rowOf(id);

    const res = await request(app)
      .post("/admin/attorneys/bulk-geocode")
      .set("Cookie", adminCookie)
      .send({ updates: [{ id, latitude: 10.1, longitude: 20.2 }] });
    expect(res.status).toBe(200);
    // The archived row is not in the updatable set, so it is not counted.
    expect(res.body.updated).toBe(0);

    const after = await rowOf(id);
    // Coordinates unchanged.
    expect(after!.latitude).toBe(before!.latitude);
    expect(after!.longitude).toBe(before!.longitude);
    // Still archived — never silently revived.
    expect(after!.archivedAt?.getTime()).toBe(archivedAt.getTime());
  });

  it("only counts the live rows when an update batch mixes live and archived ids", async () => {
    const live = await insertRow({ status: "approved" });
    const archived = await insertRow({
      status: "approved",
      archivedAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/admin/attorneys/bulk-geocode")
      .set("Cookie", adminCookie)
      .send({
        updates: [
          { id: live, latitude: 44.4, longitude: -69.9 },
          { id: archived, latitude: 44.4, longitude: -69.9 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const liveRow = await rowOf(live);
    const archivedRow = await rowOf(archived);
    expect(liveRow?.latitude).toBe(44.4);
    // The archived row keeps its seed coordinates.
    expect(archivedRow?.latitude).toBe(41.0);
  });

  it("ignores unknown ids without erroring and does not count them", async () => {
    const known = await insertRow();
    // A negative id can never exist (serial PKs are positive).
    const unknownId = -999999;

    const res = await request(app)
      .post("/admin/attorneys/bulk-geocode")
      .set("Cookie", adminCookie)
      .send({
        updates: [
          { id: known, latitude: 45.0, longitude: -70.0 },
          { id: unknownId, latitude: 45.0, longitude: -70.0 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const row = await rowOf(known);
    expect(row?.latitude).toBe(45.0);
    expect(row?.longitude).toBe(-70.0);
  });

  it("rejects out-of-range coordinates with 400 and changes nothing", async () => {
    const id = await insertRow();

    for (const bad of [
      { latitude: 91, longitude: 0 },
      { latitude: -91, longitude: 0 },
      { latitude: 0, longitude: 181 },
      { latitude: 0, longitude: -181 },
    ]) {
      const res = await request(app)
        .post("/admin/attorneys/bulk-geocode")
        .set("Cookie", adminCookie)
        .send({ updates: [{ id, ...bad }] });
      expect(res.status).toBe(400);
    }

    // No partial write occurred.
    const row = await rowOf(id);
    expect(row?.latitude).toBe(41.0);
    expect(row?.longitude).toBe(-73.5);
  });

  it("rejects an empty updates array with 400", async () => {
    const res = await request(app)
      .post("/admin/attorneys/bulk-geocode")
      .set("Cookie", adminCookie)
      .send({ updates: [] });
    expect(res.status).toBe(400);
  });
});
