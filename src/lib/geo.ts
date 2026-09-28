/**
 * Geodesic distance — the location-honesty check.
 *
 * A report's geolocation more than LOCATION_HONESTY_METERS away from the venue
 * it is filed against gets a soft "location unverified" flag (never a block:
 * demo users may be far from Bhopal).
 */

export const LOCATION_HONESTY_METERS = 200;

/** Haversine distance in metres between two lat/lng points. */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius, metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** True when the report coordinates are further than the honesty threshold. */
export function isLocationUnverified(
  reportLat: number | null | undefined,
  reportLng: number | null | undefined,
  venueLat: number,
  venueLng: number,
): boolean {
  if (typeof reportLat !== "number" || typeof reportLng !== "number") return false;
  if (!Number.isFinite(reportLat) || !Number.isFinite(reportLng)) return false;
  return haversineM(reportLat, reportLng, venueLat, venueLng) > LOCATION_HONESTY_METERS;
}
