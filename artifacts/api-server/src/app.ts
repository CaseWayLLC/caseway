import express, { type Express } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { config } from "./lib/config";
import { handleStripeWebhook } from "./lib/webhookHandlers";

const app: Express = express();

// Behind the Replit reverse proxy: trust the first hop so req.ip (used by the
// rate limiters) reflects the real client rather than the proxy address.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Compress responses (gzip/brotli) above ~1KB. The attorney list, /counties,
// and the XML sitemap are the largest payloads and benefit most; already-
// compressed image bytes proxied from storage are skipped by compression's
// default content-type filter.
app.use(compression());

// Restrict cross-origin credentialed requests to known Caseway origins. Same-
// origin and non-browser callers send no Origin header and are allowed through;
// an unknown browser origin gets no CORS headers, so the browser blocks it.
const allowedOrigins = new Set<string>([
  "https://caseway.us",
  "https://www.caseway.us",
]);
for (const domain of (config.REPLIT_DOMAINS ?? "").split(",")) {
  const trimmed = domain.trim();
  if (trimmed) allowedOrigins.add(`https://${trimmed}`);
}
if (config.REPLIT_DEV_DOMAIN) {
  allowedOrigins.add(`https://${config.REPLIT_DEV_DOMAIN}`);
}

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }),
);

app.use(cookieParser());

// The Stripe webhook needs the raw request body for signature verification, so
// it MUST be registered before express.json() consumes the stream. Stripe is a
// server-to-server caller (no Origin header), so CORS does not apply.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    void handleStripeWebhook(req, res);
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth is enforced per-route: protected handlers verify the Supabase bearer
// token via getAuthUserId(req) (see lib/supabaseAuth.ts). Public reads need no
// token, so there is no global auth middleware here.
app.use("/api", router);

// Unknown /api routes return a JSON 404 rather than falling through to any
// HTML/SPA fallback, so API clients always get a parseable error shape.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler (must be last, with four args so Express treats it
// as an error middleware). Anything thrown or rejected in a route lands here:
// log the full error server-side, but return a generic message so internals
// never leak to the client. An explicit numeric err.status is honored (e.g. the
// 400 from express.json on a malformed body).
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      typeof (err as { status?: unknown } | null)?.status === "number"
        ? (err as { status: number }).status
        : 500;
    req.log.error({ err }, "Unhandled request error");
    if (res.headersSent) return;
    res.status(status).json({
      error: status >= 500 ? "Internal server error" : "Request failed",
    });
  },
);

export default app;
