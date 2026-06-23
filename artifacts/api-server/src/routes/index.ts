import { Router, type IRouter } from "express";
import healthRouter from "./health";
import attorneysRouter from "./attorneys";
import eventsRouter from "./events";
import adminRouter from "./admin";
import contactRouter from "./contact";
import storageRouter from "./storage";
import seoRouter from "./seo";
import billingRouter from "./billing";
import accountRouter from "./account";
import { analyticsLimiter, writeLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

router.use(healthRouter);

// Per-IP rate limits for public write paths, registered before their routers.
router.use("/events", analyticsLimiter);
router.post("/attorneys", writeLimiter);
// Public (anonymous attorneys upload a headshot during signup); rate-limited
// here and constrained to small images in the storage route handler.
router.post("/storage/uploads/request-url", writeLimiter);
// Public contact form submissions are rate-limited per IP.
router.post("/contact", writeLimiter);
// Billing writes (checkout/portal/confirm) are rate-limited per IP.
router.post("/billing/confirm", writeLimiter);
router.post("/attorneys/:id/billing/checkout", writeLimiter);
router.post("/attorneys/:id/billing/portal", writeLimiter);
// Self-serve account deletion is destructive; rate-limit per IP.
router.delete("/account", writeLimiter);

router.use(attorneysRouter);
router.use(eventsRouter);
router.use(adminRouter);
router.use(contactRouter);
router.use(storageRouter);
router.use(seoRouter);
router.use(billingRouter);
router.use(accountRouter);

export default router;
