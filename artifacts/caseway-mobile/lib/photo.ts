const DOMAIN = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

/**
 * Resolves an attorney photoUrl to an absolute URL the mobile client can load.
 *
 * - Full http(s) URLs are returned as-is.
 * - Uploaded object paths (`/objects/...`) are served by the API server's
 *   storage proxy at `/api/storage/objects/...`.
 * - Other root-relative paths (e.g. seed headshots `/seed-attorneys/N.png`)
 *   are served by the web app at the domain root.
 */
export function resolvePhotoUrl(photoUrl?: string | null): string | undefined {
  if (!photoUrl) return undefined;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  if (photoUrl.startsWith("/objects/"))
    return `${DOMAIN}/api/storage${photoUrl}`;
  if (photoUrl.startsWith("/")) return `${DOMAIN}${photoUrl}`;
  return `${DOMAIN}/${photoUrl}`;
}
