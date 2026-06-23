import { Router, type IRouter, type Request, type Response } from "express";
import { getAuthUserId } from "../lib/supabaseAuth";
import { isAdminRequest } from "../lib/adminAuth";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import {
  supabaseStorage,
  ObjectNotFoundError,
  StorageNotConfiguredError,
} from "../lib/supabaseStorage";

const router: IRouter = Router();

// The upload-url endpoint requires a signed-in user (photo upload only
// happens inside the authenticated listing/edit form). It is also constrained to
// small image uploads. These checks are best-effort on the client-reported
// metadata — the bytes are PUT directly to storage.
const ALLOWED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned upload URL. The client sends JSON metadata (name, size,
 * contentType) — NOT the file — then PUTs the file directly to the returned URL.
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response) => {
    const userId = await getAuthUserId(req);
    // Photo uploads happen in two authenticated contexts: an attorney editing
    // their own listing (Supabase bearer token) and an admin editing any
    // listing from the admin portal (PIN-session cookie). Accept either.
    if (!userId && !isAdminRequest(req)) {
      res
        .status(401)
        .json({ error: "You must be signed in to upload a photo" });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;
    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
      res
        .status(400)
        .json({ error: "Only JPG, PNG, or WebP images can be uploaded." });
      return;
    }
    if (size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: "Image must be 10 MB or smaller." });
      return;
    }

    try {
      const { uploadURL, objectPath } = await supabaseStorage.createUploadUrl();
      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        req.log.error({ err: error }, "Storage not configured");
        res
          .status(503)
          .json({ error: "Photo uploads are temporarily unavailable." });
        return;
      }
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve uploaded attorney headshots. Bytes are streamed from the (private)
 * Supabase Storage bucket through the API, with the inline-image content-type
 * safety applied in supabaseStorage.serveObject.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const result = await supabaseStorage.serveObject(objectPath);

    res.status(result.status);
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
    res.send(result.body);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    if (error instanceof StorageNotConfiguredError) {
      req.log.error({ err: error }, "Storage not configured");
      res.status(503).json({ error: "Storage is unavailable." });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
