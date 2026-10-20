import { describe, expect, it } from "vitest";
import {
  EARTH_RADIUS_METERS,
  elapsedMinutesSince,
  formatDistance,
  haversineDistanceMeters,
  isAcceptableAccuracy,
  isValidCoordinate,
  toRadians,
  validateLocation,
  type GeoFence,
} from "@/lib/attendance/geofence";

const JAKARTA = { latitude: -6.2088, longitude: 106.8456 };

function fence(overrides: Partial<GeoFence> = {}): GeoFence {
  return {
    name: "Kantor Pusat",
    latitude: JAKARTA.latitude,
    longitude: JAKARTA.longitude,
    radiusMeters: 200,
    ...overrides,
  };
}

describe("toRadians", () => {
  it("converts degrees to radians", () => {
    expect(toRadians(0)).toBe(0);
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe("haversineDistanceMeters", () => {
  it("is zero for identical coordinates", () => {
    expect(haversineDistanceMeters(JAKARTA, JAKARTA)).toBe(0);
  });

  it("measures one degree of latitude as the meridian arc", () => {
    const distance = haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    // One degree on a sphere of radius R is exactly π/180 · R metres.
    expect(distance).toBeCloseTo((Math.PI / 180) * EARTH_RADIUS_METERS, 3);
    expect(distance).toBeGreaterThan(111_000);
  });

  it("matches a known city-to-city distance", () => {
    // Jakarta → Bandung is roughly 117 km.
    const bandung = { latitude: -6.9175, longitude: 107.6191 };
    const distance = haversineDistanceMeters(JAKARTA, bandung);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(125_000);
  });

  it("is symmetric", () => {
    const bandung = { latitude: -6.9175, longitude: 107.6191 };
    expect(haversineDistanceMeters(JAKARTA, bandung)).toBeCloseTo(
      haversineDistanceMeters(bandung, JAKARTA),
      6,
    );
  });

  it("stays accurate across the antimeridian", () => {
    // Two points either side of 180° are close, not ~40,000 km apart.
    const distance = haversineDistanceMeters(
      { latitude: 0, longitude: 179.9 },
      { latitude: 0, longitude: -179.9 },
    );
    expect(distance).toBeLessThan(25_000);
  });
});

describe("isValidCoordinate", () => {
  it("accepts coordinates within range", () => {
    expect(isValidCoordinate(JAKARTA)).toBe(true);
    expect(isValidCoordinate({ latitude: -90, longitude: 180 })).toBe(true);
  });

  it("rejects out-of-range and malformed coordinates", () => {
    expect(isValidCoordinate({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidCoordinate({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: Number.POSITIVE_INFINITY, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: "6" as never, longitude: 0 })).toBe(false);
    expect(isValidCoordinate(null)).toBe(false);
    expect(isValidCoordinate(undefined)).toBe(false);
    expect(isValidCoordinate({ latitude: 0 })).toBe(false);
  });
});

describe("validateLocation", () => {
  it("accepts a point inside the fence radius", () => {
    const inside = { latitude: JAKARTA.latitude + 0.0005, longitude: JAKARTA.longitude };
    const result = validateLocation(inside, [fence()]);
    expect(result.kind).toBe("VALID");
    if (result.kind === "VALID") {
      expect(result.fence.name).toBe("Kantor Pusat");
      expect(result.distanceMeters).toBeLessThan(200);
    }
  });

  it("reports the nearest fence when every point is outside", () => {
    const far = { latitude: -6.9175, longitude: 107.6191 }; // Bandung
    const result = validateLocation(far, [fence()]);
    expect(result.kind).toBe("OUTSIDE");
    if (result.kind === "OUTSIDE") {
      expect(result.nearestFence?.name).toBe("Kantor Pusat");
      expect(result.distanceMeters).toBeGreaterThan(200);
    }
  });

  it("picks the closest fence when several are configured", () => {
    const bandung = fence({
      name: "Kantor Bandung",
      latitude: -6.9175,
      longitude: 107.6191,
      radiusMeters: 100,
    });

    const inside = validateLocation({ latitude: -6.9175, longitude: 107.6191 }, [fence(), bandung]);
    expect(inside.kind).toBe("VALID");
    if (inside.kind === "VALID") expect(inside.fence.name).toBe("Kantor Bandung");

    // A point north of Bandung is still nearer Jakarta than Bandung.
    const outside = validateLocation({ latitude: -6.5, longitude: 106.9 }, [fence(), bandung]);
    expect(outside.kind).toBe("OUTSIDE");
    if (outside.kind === "OUTSIDE") expect(outside.nearestFence?.name).toBe("Kantor Pusat");
  });

  it("distinguishes missing coordinates from an unconfigured fence", () => {
    const missing = validateLocation(null, [fence()]);
    expect(missing).toEqual({ kind: "NO_LOCATION", reason: "MISSING_COORDINATES" });

    const noFence = validateLocation(JAKARTA, []);
    expect(noFence).toEqual({ kind: "NO_LOCATION", reason: "NO_FENCE_CONFIGURED" });
  });

  it("treats an invalid coordinate as a missing one", () => {
    const result = validateLocation({ latitude: 999, longitude: 0 }, [fence()]);
    expect(result.kind).toBe("NO_LOCATION");
  });
});

describe("formatDistance", () => {
  it("switches from metres to kilometres at 1000 m", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(42.4)).toBe("42 m");
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1234)).toBe("1.2 km");
  });

  it("renders an unknown distance as a dash", () => {
    expect(formatDistance(null)).toBe("—");
    expect(formatDistance(Number.NaN)).toBe("—");
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("isAcceptableAccuracy", () => {
  it("accepts a normal GPS fix and a missing accuracy value", () => {
    expect(isAcceptableAccuracy(12)).toBe(true);
    expect(isAcceptableAccuracy(null)).toBe(true);
    expect(isAcceptableAccuracy(undefined)).toBe(true);
  });

  it("rejects implausible or invalid accuracy readings", () => {
    expect(isAcceptableAccuracy(5_000)).toBe(true);
    expect(isAcceptableAccuracy(5_001)).toBe(false);
    expect(isAcceptableAccuracy(-1)).toBe(false);
    expect(isAcceptableAccuracy(Number.NaN)).toBe(false);
  });
});

describe("elapsedMinutesSince", () => {
  it("counts whole minutes elapsed", () => {
    const checkIn = new Date("2026-10-13T02:00:00Z");
    expect(elapsedMinutesSince(checkIn, new Date("2026-10-13T02:45:00Z"))).toBe(45);
    expect(elapsedMinutesSince(checkIn, new Date("2026-10-13T02:45:59Z"))).toBe(45);
  });

  it("returns 0 rather than a negative span", () => {
    const checkIn = new Date("2026-10-13T02:00:00Z");
    expect(elapsedMinutesSince(checkIn, checkIn)).toBe(0);
    expect(elapsedMinutesSince(checkIn, new Date("2026-10-13T01:00:00Z"))).toBe(0);
  });
});