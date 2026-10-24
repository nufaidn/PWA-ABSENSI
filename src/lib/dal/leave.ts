import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import {
  AttendanceStatus,
  type Attendance,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/domain";
import {
  COLLECTIONS,
  attendanceDocId,
  firestore,
  toAttendance,
  toLeaveRequest,
} from "@/lib/db";
import { assertRole, assertUser, ForbiddenError } from "./auth";
import { recordAudit } from "./audit";
import { getEffectiveSchedule } from "./settings";
import {
  enumerateDateKeys,
  isAttendanceRole,
  isWorkingDay,
} from "@/lib/attendance/time";
import { LEAVE_TYPE_LABEL } from "@/lib/leave";

/**
 * Cuti / izin / sakit Data Access Layer.
 *
 * There is no approval step by design: submitting a request writes the request
 * document and, in the same batch, marks every working day in the range as
 * `LEAVE`. A day that already has a real check-in is left untouched — the
 * employee came to work, so the attendance record wins and the request simply
 * reports fewer recorded days.
 */

export const MAX_LEAVE_DAYS = 31;
const MAX_STORED_REQUESTS = 500;

export class LeaveError extends Error {
  constructor(
    message: string,
    readonly code: "OVERLAP" | "NO_WORKING_DAY" | "INVALID_RANGE" | "TOO_LONG",
  ) {
    super(message);
    this.name = "LeaveError";
  }
}

export interface CreateLeaveRequestInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  doctorNoteUrl: string | null;
  doctorNotePublicId: string | null;
}

export interface CreatedLeaveRequest {
  request: LeaveRequest;
  /** Working days that were actually written as LEAVE. */
  recordedDays: number;
  /** Working days skipped because the employee had already checked in. */
  skippedDays: number;
}

function leaveNote(input: CreateLeaveRequestInput): string {
  if (input.type === "SAKIT") return "Sakit (surat dokter)";
  if (input.type === "CUTI") return input.reason ? `Cuti: ${input.reason}` : "Cuti";
  return `Izin: ${input.reason}`;
}

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
): Promise<CreatedLeaveRequest> {
  const user = await assertUser();
  if (!isAttendanceRole(user.role)) {
    throw new ForbiddenError("Admin tidak dapat mengajukan cuti, izin, atau sakit.");
  }

  if (input.endDate < input.startDate) {
    throw new LeaveError(
      "Tanggal selesai tidak boleh sebelum tanggal mulai.",
      "INVALID_RANGE",
    );
  }

  const days = enumerateDateKeys(input.startDate, input.endDate);
  if (days.length === 0) {
    throw new LeaveError("Rentang tanggal tidak valid.", "INVALID_RANGE");
  }
  if (days.length > MAX_LEAVE_DAYS) {
    throw new LeaveError(
      `Satu pengajuan maksimal ${MAX_LEAVE_DAYS} hari. Pecah menjadi beberapa pengajuan.`,
      "TOO_LONG",
    );
  }

  const schedule = await getEffectiveSchedule(user.id);

  const workingDates = days.filter((dateKey) =>
    isWorkingDay(dateKey, schedule.workingDays),
  );
  if (workingDates.length === 0) {
    throw new LeaveError(
      "Rentang tanggal yang dipilih tidak memuat hari kerja. Pilih tanggal lain.",
      "NO_WORKING_DAY",
    );
  }

  const now = new Date();
  const requestId = crypto.randomUUID();
  const note = leaveNote(input);
  let recordedDays = 0;
  let skippedDays = 0;

  /*
   * A transaction, not a batch: two taps on "Ajukan" (or two tabs) must not
   * both pass the overlap check and create duplicate requests. The range is at
   * most 31 attendance documents plus the request itself, well inside
   * Firestore's 500-write transaction limit.
   */
  await firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(
      firestore
        .collection(COLLECTIONS.attendance)
        .where(FieldPath.documentId(), ">=", attendanceDocId(user.id, input.startDate))
        .where(FieldPath.documentId(), "<=", attendanceDocId(user.id, input.endDate)),
    );

    const existing = new Map<string, Attendance>();
    for (const doc of snapshot.docs) {
      const record = toAttendance(doc.id, doc.data());
      if (record.userId !== user.id) continue;
      if (record.status === AttendanceStatus.LEAVE) {
        throw new LeaveError(
          "Sudah ada cuti, izin, atau sakit yang tercatat pada rentang tanggal tersebut.",
          "OVERLAP",
        );
      }
      existing.set(record.workDate, record);
    }

    tx.set(firestore.collection(COLLECTIONS.leaveRequests).doc(requestId), {
      userId: user.id,
      userName: user.name,
      employeeCode: user.employeeCode,
      department: user.department,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      doctorNoteUrl: input.doctorNoteUrl,
      doctorNotePublicId: input.doctorNotePublicId,
      createdAt: now,
    });

    recordedDays = 0;
    skippedDays = 0;

    for (const dateKey of workingDates) {
      const existingRecord = existing.get(dateKey);
      if (existingRecord?.checkInAt || existingRecord?.checkOutAt) {
        skippedDays += 1;
        continue;
      }

      tx.set(
        firestore
          .collection(COLLECTIONS.attendance)
          .doc(attendanceDocId(user.id, dateKey)),
        {
          userId: user.id,
          workDate: dateKey,
          checkInAt: null,
          checkOutAt: null,
          checkInLatitude: null,
          checkInLongitude: null,
          checkInDistanceM: null,
          checkOutLatitude: null,
          checkOutLongitude: null,
          checkOutDistanceM: null,
          status: AttendanceStatus.LEAVE,
          lateMinutes: 0,
          workedMinutes: 0,
          outsideRadius: false,
          notes: note,
          createdAt: existingRecord?.createdAt ?? now,
          updatedAt: now,
        },
        { merge: true },
      );
      recordedDays += 1;
    }
  });

  await recordAudit({
    actorId: user.id,
    action: "LEAVE_REQUESTED",
    entityType: "LeaveRequest",
    entityId: requestId,
    summary: `${user.name} mengajukan ${LEAVE_TYPE_LABEL[input.type].toLowerCase()} ${input.startDate} sampai ${input.endDate}`,
    metadata: {
      type: input.type,
      recordedDays,
      skippedDays,
      hasDoctorNote: Boolean(input.doctorNoteUrl),
    },
  });

  return {
    request: toLeaveRequest(requestId, {
      userId: user.id,
      userName: user.name,
      employeeCode: user.employeeCode,
      department: user.department,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      doctorNoteUrl: input.doctorNoteUrl,
      doctorNotePublicId: input.doctorNotePublicId,
      createdAt: now,
    }),
    recordedDays,
    skippedDays,
  };
}

/** The signed-in employee's own requests, newest first. */
export async function getOwnLeaveRequests(): Promise<LeaveRequest[]> {
  const user = await assertUser();
  if (!isAttendanceRole(user.role)) return [];

  const snapshot = await firestore
    .collection(COLLECTIONS.leaveRequests)
    .where("userId", "==", user.id)
    .limit(MAX_STORED_REQUESTS)
    .get();

  return snapshot.docs
    .map((doc) => toLeaveRequest(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export interface LeaveRequestFilters {
  type?: LeaveType | "ALL";
  search?: string;
}

/**
 * Admin-wide request list.
 *
 * Filtering happens in memory because the collection is small and this avoids
 * a composite index for every search/type combination. The newest 500 requests
 * are enough for the dashboard; older records remain queryable in Firestore.
 */
export async function getAllLeaveRequests(
  filters: LeaveRequestFilters = {},
): Promise<LeaveRequest[]> {
  await assertRole("ADMIN");

  const snapshot = await firestore
    .collection(COLLECTIONS.leaveRequests)
    .orderBy("createdAt", "desc")
    .limit(MAX_STORED_REQUESTS)
    .get();

  const search = filters.search?.trim().toLowerCase();

  return snapshot.docs
    .map((doc) => toLeaveRequest(doc.id, doc.data()))
    .filter((request) => {
      if (filters.type && filters.type !== "ALL" && request.type !== filters.type) {
        return false;
      }
      if (!search) return true;
      return [request.userName, request.employeeCode, request.department, request.reason]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(search));
    });
}
