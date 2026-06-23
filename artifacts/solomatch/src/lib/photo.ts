const STORAGE_BASE = "/api/storage";

export function resolvePhotoUrl(photoUrl?: string | null): string | undefined {
  if (!photoUrl) return undefined;
  if (photoUrl.startsWith("/objects/")) {
    return `${STORAGE_BASE}${photoUrl}`;
  }
  return photoUrl;
}
