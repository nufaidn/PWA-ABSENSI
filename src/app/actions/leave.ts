"use server";

import { revalidatePath } from "next/cache";
import { assertUser, ForbiddenError, UnauthorizedError } from "@/lib/dal/auth";
import { createLeaveRequest, LeaveError } from "@/lib/dal/leave";
import {
  CloudinaryConfigurationError,
  createLeaveUploadSignature,
  getCloudinaryConfig,
  isLeaveDoctorNoteUrl,
  type LeaveUploadSignature,
} from "@/lib/cloudinary";
import { fieldErrors, leaveRequestSchema } from "@/lib/validation/schemas";
import { isAttendanceRole } from "@/lib/attendance/time";
import { LEAVE_TYPE_LABEL, formatLeaveRange } from "@/lib/leave";
import type { ActionState } from "@/lib/action-state";

/**
 * Cuti / izin / sakit Server Actions.
 *
 * Authorization is checked here and again inside the DAL. The doctor-note URL
 * comes from a hidden field, so it is re-validated against this Cloudinary
 * account and the employee's own folder before it is stored.
 */

export type LeaveUploadState =
  | { ok: true; upload: LeaveUploadSignature }
  | { ok: false; error: string };

function toState(error: unknown): ActionState {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message };
  if (error instanceof UnauthorizedError) return { ok: false, error: error.message };
  if (error instanceof LeaveError) return { ok: false, error: error.message };
  if (error instanceof CloudinaryConfigurationError) {
    return { ok: false, error: error.message };
  }
  console.error("[leave] action failed", error);
  return { ok: false, error: "Terjadi kesalahan tak terduga." };
}

export async function getLeaveUploadSignatureAction(): Promise<LeaveUploadState> {
  try {
    const user = await assertUser();
    if (!isAttendanceRole(user.role)) {
      return {
        ok: false,
        error: "Akun administrator tidak dapat mengunggah surat dokter.",
      };
    }
    return { ok: true, upload: createLeaveUploadSignature(user.id) };
  } catch (error) {
    if (error instanceof CloudinaryConfigurationError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof UnauthorizedError) {
      return { ok: false, error: error.message };
    }
    console.error("[leave] signature failed", error);
    return { ok: false, error: "Gagal menyiapkan unggahan. Coba lagi." };
  }
}

export async function createLeaveRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = leaveRequestSchema.safeParse({
    type: formData.get("type"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") ?? undefined,
    doctorNoteUrl: formData.get("doctorNoteUrl") ?? undefined,
    doctorNotePublicId: formData.get("doctorNotePublicId") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const user = await assertUser();
    if (!isAttendanceRole(user.role)) {
      throw new ForbiddenError(
        "Admin tidak dapat mengajukan cuti, izin, atau sakit.",
      );
    }

    let doctorNoteUrl: string | null = null;
    let doctorNotePublicId: string | null = null;

    if (input.type === "SAKIT") {
      const config = getCloudinaryConfig();
      if (!input.doctorNoteUrl || !isLeaveDoctorNoteUrl(input.doctorNoteUrl, user.id, config)) {
        return {
          ok: false,
          error: "Surat dokter tidak valid. Unggah ulang melalui form.",
          fieldErrors: { doctorNoteUrl: "Surat dokter wajib diunggah." },
        };
      }
      doctorNoteUrl = input.doctorNoteUrl;
      doctorNotePublicId = input.doctorNotePublicId;
    }

    const created = await createLeaveRequest({
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      doctorNoteUrl,
      doctorNotePublicId,
    });

    for (const path of [
      "/cuti-izin",
      "/dashboard",
      "/attendance",
      "/statistics",
      "/admin/leave",
      "/admin/reports",
      "/admin/overview",
      "/admin/audit-log",
    ]) {
      revalidatePath(path);
    }

    const skipped =
      created.skippedDays > 0
        ? ` ${created.skippedDays} hari kerja dilewati karena sudah ada absensi.`
        : "";

    return {
      ok: true,
      message: `${LEAVE_TYPE_LABEL[input.type]} ${formatLeaveRange(
        input.startDate,
        input.endDate,
      )} tercatat. ${created.recordedDays} hari kerja ditandai sebagai izin/cuti.${skipped}`,
    };
  } catch (error) {
    return toState(error);
  }
}
