import { describe, it, expect, beforeAll, vi, type Mock } from "vitest";
import express, { type Express, type Request } from "express";
import request from "supertest";

// Control which Supabase user (and account type) the billing handlers see.
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
import billingRouter from "./billing";

const getAuthUserIdMock = getAuthUserId as unknown as Mock;
const getAuthUserMock = getAuthUser as unknown as Mock;

function actAs(userId: string | null, accountType: "solo" | "firm" = "solo") {
  getAuthUserIdMock.mockResolvedValue(userId);
  getAuthUserMock.mockResolvedValue(
    userId ? { id: userId, user_metadata: { accountType } } : null,
  );
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
  app.use("/api", billingRouter);
});

describe("law firm custom-plan billing gate", () => {
  it("blocks a firm account from self-serve checkout with 409 firm_custom_plan", async () => {
    actAs("firm_checkout", "firm");
    const res = await request(app)
      .post("/api/attorneys/1/billing/checkout")
      .send({ flow: "signup" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("firm_custom_plan");
  });

  it("blocks a firm account from self-serve Pro upgrade with 409 firm_custom_plan", async () => {
    actAs("firm_upgrade", "firm");
    const res = await request(app)
      .post("/api/attorneys/1/billing/upgrade-pro")
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("firm_custom_plan");
  });

  it("does NOT block a solo account at the firm gate (passes through to listing lookup)", async () => {
    // A solo owner with no such listing should reach the owner-scoped lookup
    // and 404 — proving the firm guard did not short-circuit solo checkout.
    actAs("solo_checkout", "solo");
    const res = await request(app)
      .post("/api/attorneys/999999999/billing/checkout")
      .send({ flow: "signup" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBeUndefined();
  });

  it("does NOT block a solo account from Pro upgrade at the firm gate", async () => {
    actAs("solo_upgrade", "solo");
    const res = await request(app)
      .post("/api/attorneys/999999999/billing/upgrade-pro")
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.code).toBeUndefined();
  });

  it("requires authentication for checkout (401)", async () => {
    actAs(null);
    const res = await request(app)
      .post("/api/attorneys/1/billing/checkout")
      .send({ flow: "signup" });
    expect(res.status).toBe(401);
  });
});
