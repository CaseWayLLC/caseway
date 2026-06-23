import rateLimit from "express-rate-limit";

// Chatty but legitimate: analytics events fire on searches, views, and clicks.
// A generous per-IP ceiling stops floods without affecting real browsing.
export const analyticsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Stricter ceiling for public write actions (listing creation, upload URLs).
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
});
