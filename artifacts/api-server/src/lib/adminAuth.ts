import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config, isProduction } from "./config";

const COOKIE_NAME = "caseway_admin";
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSecret(): string {
  return config.SESSION_SECRET ?? "";
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return base64url(
    crypto.createHmac("sha256", getSecret()).update(payload).digest(),
  );
}

export function createAdminToken(): string {
  const payload = base64url(
    JSON.stringify({ role: "admin", exp: Date.now() + MAX_AGE_MS }),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token || !getSecret()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64").toString("utf8"),
    ) as { role?: string; exp?: number };
    if (decoded.role !== "admin") return false;
    if (typeof decoded.exp !== "number" || decoded.exp < Date.now())
      return false;
    return true;
  } catch {
    return false;
  }
}

export function setAdminCookie(res: Response): void {
  res.cookie(COOKIE_NAME, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function isAdminRequest(req: Request): boolean {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAME
  ];
  return verifyAdminToken(token);
}

export function verifyPin(pin: string): boolean {
  const expected = config.ADMIN_PIN ?? "";
  if (!expected) return false;
  return safeEqual(pin.trim(), expected.trim());
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isAdminRequest(req)) {
    res.status(401).json({ error: "Admin authentication required." });
    return;
  }
  next();
}
