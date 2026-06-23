import { Router, type IRouter } from "express";
import { db, analyticsEventsTable } from "@workspace/db";
import { TrackEventBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/events", async (req, res): Promise<void> => {
  const parsed = TrackEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, attorneyId, query, category, path, sessionId } = parsed.data;

  try {
    await db.insert(analyticsEventsTable).values({
      type,
      attorneyId: attorneyId ?? null,
      query: query ?? null,
      category: category ?? null,
      path: path ?? null,
      sessionId: sessionId ?? null,
    });
  } catch (err) {
    req.log.warn({ err }, "Failed to record analytics event");
  }

  res.status(201).json({ ok: true });
});

export default router;
