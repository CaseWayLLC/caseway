import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, contactMessagesTable } from "@workspace/db";
import {
  SubmitContactMessageBody,
  ListContactMessagesResponse,
  SetContactMessageHandledParams,
  SetContactMessageHandledBody,
  SetContactMessageHandledResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();

// Public, unauthenticated: store a support/contact message for the admin inbox.
router.post("/contact", async (req, res): Promise<void> => {
  const parsed = SubmitContactMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.insert(contactMessagesTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
  });

  res.status(201).json({ success: true });
});

router.get(
  "/admin/contact-messages",
  requireAdmin,
  async (_req, res): Promise<void> => {
    // Unhandled first, then newest first, so the admin works through the queue.
    const rows = await db
      .select()
      .from(contactMessagesTable)
      .orderBy(
        asc(contactMessagesTable.handled),
        desc(contactMessagesTable.createdAt),
      );

    res.json(ListContactMessagesResponse.parse(rows));
  },
);

router.post(
  "/admin/contact-messages/:id/handled",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetContactMessageHandledParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = SetContactMessageHandledBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [updated] = await db
      .update(contactMessagesTable)
      .set({ handled: parsed.data.handled })
      .where(eq(contactMessagesTable.id, params.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    res.json(SetContactMessageHandledResponse.parse(updated));
  },
);

export default router;
