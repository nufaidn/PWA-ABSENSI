/**
 * GPS geo-fence validation — pure functions over plain coordinates.
 *
 * The Haversine formula is used rather than a planar approximation so results
 * stay accurate at city scale, which is the only scale an office fence needs.
 */
import { MS_PER_MINUTE } from "./time";

export const EARTH_RADIUS_METERS = 6_371_008.8;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoFence extends GeoPoint {
  name: string;
  radiusMeters: number;
}

export type GeoValidationOutcome =
  | { kind: "VALID"; fence: GeoFence; distanceMeters: number }
  | { kind: "OUTSIDE"; nearestFence: GeoFence | null; distanceMeters: number | null }
  | { kind: "NO_LOCATION"; reason: "MISSING_COORDINATES" | "NO_FENCE_CONFIGURED" };

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in metres between two coordinates. */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinate(point: Partial<GeoPoint> | null | undefined): boolean {
  if (!point) return false;
  const { latitude, longitude } = point;
  if (typeof latitude !== "number" || typeof longitude !== "number") return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/**
 * Resolves a check-in location against the configured fences.
 *
 * `requireMatch` distinguishes the two policies the settings screen exposes:
 * when true, an OUTSIDE result must be rejected; when false it is only recorded
 * for reporting.
 */
export function validateLocation(
  point: GeoPoint | null,
  fences: readonly GeoFence[],
): GeoValidationOutcome {
  if (!point || !isValidCoordinate(point)) {
    return { kind: "NO_LOCATION", reason: "MISSING_COORDINATES" };
  }
  if (fences.length === 0) {
    return { kind: "NO_LOCATION", reason: "NO_FENCE_CONFIGURED" };
  }

  let nearest: GeoFence | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const fence of fences) {
    const distance = haversineDistanceMeters(point, fence);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = fence;
    }
    if (distance <= fence.radiusMeters) {
      return { kind: "VALID", fence, distanceMeters: distance };
    }
  }

  return {
    kind: "OUTSIDE",
    nearestFence: nearest,
    distanceMeters: Number.isFinite(nearestDistance) ? nearestDistance : null,
  };
}

/** Formats a distance for the UI, e.g. "42 m" or "1.2 km". */
export function formatDistance(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Accuracy sanity check. A browser may report a fix with very low accuracy
 * (poor signal); such coordinates are still usable but worth surfacing.
 */
export function isAcceptableAccuracy(accuracyMeters: number | null | undefined): boolean {
  if (accuracyMeters === null || accuracyMeters === undefined) return true;
  return Number.isFinite(accuracyMeters) && accuracyMeters >= 0 && accuracyMeters <= 5_000;
}

/**
 * A rough estimate of how long the employee worked *today so far*, used for the
 * live counter on the dashboard before check-out happens.
 */
export function elapsedMinutesSince(checkInAt: Date, now: Date): number {
  if (now.getTime() <= checkInAt.getTime()) return 0;
  return Math.floor((now.getTime() - checkInAt.getTime()) / MS_PER_MINUTE);
}