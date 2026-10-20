"use server";

import { revalidatePath } from "next/cache";
import { checkIn, checkOut, AttendanceError } from "@/lib/dal/attendance";
import type { GeoPoint } from "@/lib/attendance/geofence";
import { UnauthorizedError, ForbiddenError } from "@/lib/dal/auth";
import { checkInSchema } from "@/lib/validation/schemas";
import { publishAttendanceEvent } from "@/lib/realtime";

/**
 * Attendance Server Actions.
 *
 * The client may send coordinates but never a timestamp: the wall-clock time is
 * always read from the server inside the DAL. Authorization is re-checked here
 * as well as in the DAL, because a Server Action is an untrusted POST endpoint.
 */

export interface AttendanceActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Server-authoritative payload so the UI never shows a client-side guess. */
  result?: {
    action: "check-in" | "check-out";
    timestamp: string;
    status?: string;
    lateMinutes?: number;
    workedMinutes?: number;
    distanceMeters?: number | null;
    outsideRadius?: boolean;
  };
}

function toClientError(error: unknown): { error: string } {
  if (error instanceof AttendanceError) {
    return { error: error.message };
  }
  if (error instanceof UnauthorizedError) {
    return { error: "Sesi Anda berakhir. Silakan masuk kembali." };
  }
  if (error instanceof ForbiddenError) {
    return { error: error.message };
  }
  console.error("[attendance] action failed", error);
  return { error: "Terjadi kesalahan tak terduga. Silakan coba lagi." };
}

/**
 * Accepts coordinates from either a `<form action>` submission or a direct
 * `JSON` body. Both shapes are validated by the same schema.
 */
async function readPoint(formData: FormData): Promise<GeoPoint | null> {
  const raw = formData.get("payload");
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = checkInSchema.safeParse(JSON.parse(raw));
      // Both halves must be present for a coordinate to mean anything;
      // a half-present pair is treated as "location unavailable".
      if (parsed.success && parsed.data.latitude !== null && parsed.data.longitude !== null) {
        return { latitude: parsed.data.latitude, longitude: parsed.data.longitude };
      }
    } catch {
      // Fall through to the discrete fields below.
    }
  }

  const lat = formData.get("latitude");
  const lng = formData.get("longitude");
  const latitude = lat === null || lat === "" ? Number.NaN : Number(lat);
  const longitude = lng === null || lng === "" ? Number.NaN : Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export async function checkInAction(
  _prev: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const point = await readPoint(formData);

  try {
    const record = await checkIn({ point });

    revalidatePath("/dashboard");
    revalidatePath("/attendance");

    // Tells open admin dashboards to refetch. Fire-and-forget: the write has
    // already committed, so a failure here must not fail the check-in.
    void publishAttendanceEvent("check-in");

    return {
      ok: true,
      message:
        record.status === "LATE"
          ? `Check-in tercatat sebagai terlambat ${record.lateMinutes} menit.`
          : "Check-in berhasil. Semoga productive!",
      result: {
        action: "check-in",
        timestamp: record.checkInAt.toISOString(),
        status: record.status,
        lateMinutes: record.lateMinutes,
        distanceMeters: record.distanceMeters,
        outsideRadius: record.outsideRadius,
      },
    };
  } catch (error) {
    return { ok: false, ...toClientError(error) };
  }
}

export async function checkOutAction(
  _prev: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const point = await readPoint(formData);

  try {
    const record = await checkOut({ point });

    revalidatePath("/dashboard");
    revalidatePath("/attendance");

    void publishAttendanceEvent("check-out");

    return {
      ok: true,
      message: "Check-out berhasil. Sampai jumpa besok!",
      result: {
        action: "check-out",
        timestamp: record.checkOutAt.toISOString(),
        status: record.status,
        lateMinutes: record.lateMinutes,
        workedMinutes: record.workedMinutes,
      },
    };
  } catch (error) {
    return { ok: false, ...toClientError(error) };
  }
}