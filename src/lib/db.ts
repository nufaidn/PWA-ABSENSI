import "server-only";
import { Timestamp, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { firestore } from "@/lib/firebase-config";
import { WEEKDAY_INDEXES } from "@/lib/attendance/time";
import {
  AuditAction,
  AttendanceStatus,
  Role,
  isAttendanceStatus,
  isAuditAction,
  isRole,
  type Attendance,
  type AuditLog,
  type Setting,
  type User,
  type WorkLocation,
  type WorkSchedule,
} from "@/lib/domain";

/**
 * Firestore Admin SDK entry point for the application.
 *
 * The browser never talks to Firestore directly. Every read and write goes
 * through Server Components, Server Actions or Route Handlers using the
 * service-account client in `firebase-config.ts`, so Firestore security rules
 * can deny all client access and no Firebase key is ever shipped to the browser.
 */

export const COLLECTIONS = {
  users: "users",
  schedules: "schedules",
  locations: "locations",
  settings: "settings",
  attendance: "attendance",
  auditLogs: "auditLogs",
  employeeCodes: "employeeCodes",
  userEmails: "userEmails",
  counters: "counters",
  realtime: "realtime",
} as const;

export const SETTINGS_DOC_ID = "organization";
export const REALTIME_DOC_ID = "attendance";

export { firestore };

export function attendanceDocId(userId: string, workDate: string): string {
  return `${userId}_${workDate}`;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function dateOr(value: unknown, fallback = new Date(0)): Date {
  return toDate(value) ?? fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringOr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOr(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Reads the list of working days from a schedule document.
 *
 * Anything unusable — a missing field (documents written before schedules
 * carried their days), a non-array, an out-of-range index — falls back to
 * Monday–Friday, which is what the application assumed globally before the
 * days became part of the schedule.
 */
function workingDaysOr(value: unknown, fallback: readonly number[]): number[] {
  if (!Array.isArray(value)) return [...fallback];
  const days = value.filter(
    (day): day is number =>
      typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
  );
  if (days.length === 0) return [...fallback];
  return [...new Set(days)].sort((a, b) => a - b);
}

function workDateKey(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function toUser(id: string, data: DocumentData): User {
  return {
    id,
    email: stringOr(data.email),
    passwordHash: stringOr(data.passwordHash),
    name: stringOr(data.name),
    employeeCode: nullableString(data.employeeCode),
    role: isRole(data.role) ? data.role : Role.EMPLOYEE,
    department: nullableString(data.department),
    phone: nullableString(data.phone),
    isActive: data.isActive !== false,
    scheduleId: nullableString(data.scheduleId),
    createdAt: dateOr(data.createdAt),
    updatedAt: dateOr(data.updatedAt),
  };
}

export function toWorkSchedule(id: string, data: DocumentData): WorkSchedule {
  return {
    id,
    name: stringOr(data.name),
    description: nullableString(data.description),
    startTime: stringOr(data.startTime, "09:00"),
    endTime: stringOr(data.endTime, "18:00"),
    lateToleranceMinutes: numberOr(data.lateToleranceMinutes),
    breakMinutes: numberOr(data.breakMinutes, 60),
    workingDays: workingDaysOr(data.workingDays, WEEKDAY_INDEXES),
    isActive: data.isActive !== false,
    isOrganizationDefault: booleanOr(data.isOrganizationDefault),
    createdAt: dateOr(data.createdAt),
    updatedAt: dateOr(data.updatedAt),
  };
}

export function toAttendance(id: string, data: DocumentData): Attendance {
  return {
    id,
    userId: stringOr(data.userId),
    workDate: workDateKey(data.workDate),
    checkInAt: toDate(data.checkInAt),
    checkOutAt: toDate(data.checkOutAt),
    checkInLatitude: numberOrNull(data.checkInLatitude),
    checkInLongitude: numberOrNull(data.checkInLongitude),
    checkInDistanceM: numberOrNull(data.checkInDistanceM),
    checkOutLatitude: numberOrNull(data.checkOutLatitude),
    checkOutLongitude: numberOrNull(data.checkOutLongitude),
    checkOutDistanceM: numberOrNull(data.checkOutDistanceM),
    status: isAttendanceStatus(data.status) ? data.status : AttendanceStatus.PRESENT,
    lateMinutes: numberOr(data.lateMinutes),
    workedMinutes: numberOr(data.workedMinutes),
    outsideRadius: booleanOr(data.outsideRadius),
    notes: nullableString(data.notes),
    createdAt: dateOr(data.createdAt),
    updatedAt: dateOr(data.updatedAt),
  };
}

export function toWorkLocation(id: string, data: DocumentData): WorkLocation {
  return {
    id,
    name: stringOr(data.name),
    address: nullableString(data.address),
    latitude: numberOr(data.latitude),
    longitude: numberOr(data.longitude),
    radiusMeters: numberOr(data.radiusMeters, 200),
    isActive: data.isActive !== false,
    createdAt: dateOr(data.createdAt),
    updatedAt: dateOr(data.updatedAt),
  };
}

export function toSetting(id: string, data: DocumentData): Setting {
  return {
    id,
    organizationName: stringOr(data.organizationName, "Universal Attendance"),
    timezone: stringOr(data.timezone, "Asia/Jakarta"),
    defaultScheduleId: nullableString(data.defaultScheduleId),
    requireLocationValidation: booleanOr(data.requireLocationValidation),
    updatedAt: dateOr(data.updatedAt),
  };
}

export function toAuditLog(id: string, data: DocumentData): AuditLog {
  return {
    id,
    actorId: nullableString(data.actorId),
    actorName: nullableString(data.actorName),
    actorEmail: nullableString(data.actorEmail),
    action: isAuditAction(data.action) ? data.action : AuditAction.SETTINGS_UPDATED,
    entityType: stringOr(data.entityType),
    entityId: nullableString(data.entityId),
    summary: stringOr(data.summary),
    metadata:
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : null,
    ipAddress: nullableString(data.ipAddress),
    createdAt: dateOr(data.createdAt),
  };
}

export function userFromSnapshot(snapshot: DocumentSnapshot): User | null {
  if (!snapshot.exists) return null;
  return toUser(snapshot.id, snapshot.data() ?? {});
}

export { Timestamp };
