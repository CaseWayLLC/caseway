import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { config } from "./config";

// Raster image types we are willing to serve inline. SVG is deliberately
// excluded: it can carry script and would execute in our origin if served
// inline. Anything not in this set is served as a forced download.
const INLINE_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY)");
    this.name = "StorageNotConfiguredError";
    Object.setPrototypeOf(this, StorageNotConfiguredError.prototype);
  }
}

let client: SupabaseClient | null = null;

// Lazily build the service-role client so the server still boots (and the
// public directory keeps serving) when storage is not yet configured. The
// secret key bypasses RLS and storage policies; it must never reach the client.
function getClient(): SupabaseClient {
  if (!config.SUPABASE_URL || !config.SUPABASE_SECRET_KEY) {
    throw new StorageNotConfiguredError();
  }
  if (!client) {
    client = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface ServeResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

export class SupabaseStorageService {
  private readonly bucket = config.SUPABASE_STORAGE_BUCKET;

  // Returns a full PUT-able signed upload URL and the app-relative object path
  // the client stores as photoUrl (served back via GET /storage/objects/...).
  // The token is embedded in the URL, so the client PUTs the bytes directly
  // with only a Content-Type header — no Supabase credentials on the client.
  async createUploadUrl(): Promise<{ uploadURL: string; objectPath: string }> {
    const key = `uploads/${randomUUID()}`;
    const { data, error } = await getClient()
      .storage.from(this.bucket)
      .createSignedUploadUrl(key);
    if (error || !data) {
      throw new Error(
        `Failed to create signed upload URL: ${error?.message ?? "unknown error"}`,
      );
    }
    return { uploadURL: data.signedUrl, objectPath: `/objects/${key}` };
  }

  // objectPath is the app-relative path "/objects/uploads/<uuid>"; map it to the
  // bucket key "uploads/<uuid>" and stream the bytes back. The upload is a
  // direct signed PUT whose bytes we don't inspect, so only a known raster-image
  // content-type is served inline; anything else is forced to a non-executable
  // download and nosniff stops the browser re-interpreting it as active content.
  async serveObject(
    objectPath: string,
    cacheTtlSec: number = 3600,
  ): Promise<ServeResult> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const key = objectPath.slice("/objects/".length);
    if (!key) {
      throw new ObjectNotFoundError();
    }

    const { data, error } = await getClient()
      .storage.from(this.bucket)
      .download(key);
    if (error || !data) {
      throw new ObjectNotFoundError();
    }

    const rawType = (data.type || "application/octet-stream")
      .toLowerCase()
      .split(";")[0]
      .trim();
    const isInlineImage = INLINE_IMAGE_CONTENT_TYPES.has(rawType);
    const safeType = isInlineImage ? rawType : "application/octet-stream";
    const body = Buffer.from(await data.arrayBuffer());

    const headers: Record<string, string> = {
      "Content-Type": safeType,
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(body.byteLength),
    };
    if (!isInlineImage) {
      headers["Content-Disposition"] = "attachment";
    }

    return { status: 200, headers, body };
  }
}

export const supabaseStorage = new SupabaseStorageService();
