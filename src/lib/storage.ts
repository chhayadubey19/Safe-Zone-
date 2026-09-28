/**
 * Server-only Supabase Storage helpers — citizen evidence photos.
 *
 * Bucket: `report-photos` (public read — created by
 * supabase/migration_storage.sql or the Storage API). Uploads happen through
 * the service-role admin client, so they work regardless of storage RLS.
 *
 * Path convention (per spec): `${venueId}/${timestamp}-${reporterId}.jpg`.
 * Inspector after-action photos follow the same convention under the venue.
 *
 * Every helper degrades to `null` on failure — the caller submits the report
 * with photo_url null and toasts, never losing the citizen's report.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const REPORT_PHOTOS_BUCKET = "report-photos";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Public URL for an object in the report-photos bucket. */
export function reportPhotoPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${REPORT_PHOTOS_BUCKET}/${path}`;
}

/** Extract bytes from a `data:image/...;base64,` URL. */
function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const bin = atob(match[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mimeType: match[1] };
  } catch {
    return null;
  }
}

/**
 * Upload a captured camera frame. Returns the public URL, or null on ANY
 * failure (bucket missing, network, bad data URL) so callers can fall back.
 */
export async function uploadReportPhoto(
  admin: SupabaseClient,
  venueId: string,
  reporterId: string,
  photoDataUrl: string,
  timestamp = Date.now(),
): Promise<string | null> {
  const decoded = decodeDataUrl(photoDataUrl);
  if (!decoded) return null;

  const ext = decoded.mimeType === "image/png" ? "png" : "jpg";
  const safeReporter = reporterId.replace(/[^a-zA-Z0-9-]/g, "").slice(-12) || "citizen";
  const path = `${venueId}/${timestamp}-${safeReporter}.${ext}`;

  try {
    const { error } = await admin.storage
      .from(REPORT_PHOTOS_BUCKET)
      .upload(path, decoded.bytes, { contentType: decoded.mimeType, upsert: false });
    if (error) {
      console.warn("[storage] report photo upload failed:", error.message);
      return null;
    }
    return reportPhotoPublicUrl(path);
  } catch (err) {
    console.warn("[storage] report photo upload threw:", err);
    return null;
  }
}

/**
 * Upload an inspector's after-action photo → inspections.after_action_photo_url.
 * Path convention (per Phase 3 spec): {venueId}/after-{timestamp}.jpg.
 * Same degradation contract: null on any failure.
 */
export async function uploadAfterActionPhoto(
  admin: SupabaseClient,
  venueId: string,
  _inspectorId: string,
  photoDataUrl: string,
  timestamp = Date.now(),
): Promise<string | null> {
  return uploadEvidencePhoto(admin, `${venueId}/after-${timestamp}.jpg`, photoDataUrl);
}

/**
 * Upload an evidence photo at an explicit path in the EXISTING report-photos
 * bucket (per-item inspection photos, after-action photos). Returns the
 * public URL, or null on any failure (bucket missing, network, bad data URL).
 */
export async function uploadEvidencePhoto(
  admin: SupabaseClient,
  path: string,
  photoDataUrl: string,
): Promise<string | null> {
  const decoded = decodeDataUrl(photoDataUrl);
  if (!decoded) return null;

  const finalPath = decoded.mimeType === "image/png" && !path.endsWith(".jpg")
    ? `${path}.png`
    : path;

  try {
    const { error } = await admin.storage
      .from(REPORT_PHOTOS_BUCKET)
      .upload(finalPath, decoded.bytes, { contentType: decoded.mimeType, upsert: false });
    if (error) {
      console.warn(`[storage] upload failed for ${path}:`, error.message);
      return null;
    }
    return reportPhotoPublicUrl(finalPath);
  } catch (err) {
    console.warn(`[storage] upload threw for ${path}:`, err);
    return null;
  }
}

/**
 * Phase 5 spec completion — upload a certificate photo → certificates.photo_url.
 * Path convention (per spec): {venueId}/cert-{timestamp}.jpg in the EXISTING
 * report-photos bucket. Same degradation contract: null on any failure.
 */
export async function uploadCertificatePhoto(
  admin: SupabaseClient,
  venueId: string,
  photoDataUrl: string,
  timestamp = Date.now(),
): Promise<string | null> {
  return uploadEvidencePhoto(admin, `${venueId}/cert-${timestamp}.jpg`, photoDataUrl);
}

/**
 * Phase 5 — delete a stored evidence photo by its public URL (the report-photos
 * bucket object behind a report). Best-effort: returns false (never throws)
 * for URLs that are not stored bucket objects — inline data URLs from demo
 * mode and placeholder URLs have nothing to remove.
 */
export async function deleteReportPhotoByUrl(
  admin: SupabaseClient,
  photoUrl: string,
): Promise<boolean> {
  const marker = `/storage/v1/object/public/${REPORT_PHOTOS_BUCKET}/`;
  const idx = photoUrl.indexOf(marker);
  if (!/^https?:\/\//.test(photoUrl) || idx === -1) return false; // data-url / demo URL

  const path = photoUrl.slice(idx + marker.length);
  if (!path) return false;

  try {
    const { error } = await admin.storage.from(REPORT_PHOTOS_BUCKET).remove([path]);
    if (error) {
      console.warn(`[storage] delete failed for ${path}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[storage] delete threw for ${path}:`, err);
    return false;
  }
}
