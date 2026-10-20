import "server-only";
import { cache } from "react";
import type { WorkLocation, WorkSchedule } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { GeoFence } from "@/lib/attendance/geofence";
import { DEFAULT_TIMEZONE, WEEKDAY_INDEXES } from "@/lib/attendance/time";

/**
 * Settings and schedule Data Access Layer.
 */

export interface EffectiveSchedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  breakMinutes: number;
  /** True when this came from the organization default rather than the user. */
  isDefault: boolean;
}

/** Fallback used before the database is seeded or if configuration is missing. */
const FALLBACK_SCHEDULE: EffectiveSchedule = {
  id: "fallback",
  name: "Jam Kerja Default",
  startTime: "09:00",
  endTime: "18:00",
  lateToleranceMinutes: 10,
  breakMinutes: 60,
  isDefault: true,
};

export const SETTINGS_ID = 1;

/**
 * The organization's schedule for a user: their own assignment if present,
 * otherwise the organization default, otherwise a hardcoded fallback so the
 * app still functions on a freshly migrated database.
 */
export const getEffectiveSchedule = cache(async (userId: string): Promise<EffectiveSchedule> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { schedule: true },
  });

  if (user?.schedule) {
    return toEffectiveSchedule(user.schedule, false);
  }

  const setting = await db.setting.findUnique({
    where: { id: SETTINGS_ID },
    select: { defaultSchedule: true },
  });

  if (setting?.defaultSchedule) {
    return toEffectiveSchedule(setting.defaultSchedule, true);
  }

  const anyDefault = await db.workSchedule.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return anyDefault ? toEffectiveSchedule(anyDefault, true) : FALLBACK_SCHEDULE;
});

function toEffectiveSchedule(
  schedule: Pick<
    WorkSchedule,
    "id" | "name" | "startTime" | "endTime" | "lateToleranceMinutes" | "breakMinutes"
  >,
  isDefault: boolean,
): EffectiveSchedule {
  return {
    id: schedule.id,
    name: schedule.name,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    lateToleranceMinutes: schedule.lateToleranceMinutes,
    breakMinutes: schedule.breakMinutes,
    isDefault,
  };
}

export interface LocationPolicy {
  organizationName: string;
  timezone: string;
  requireLocationValidation: boolean;
  workingDays: readonly number[];
}

/** Reads the singleton settings row, falling back to documented defaults. */
export const getLocationPolicy = cache(async (): Promise<LocationPolicy> => {
  const setting = await db.setting.findUnique({ where: { id: SETTINGS_ID } });
  return {
    organizationName: setting?.organizationName ?? "Universal Attendance",
    timezone: setting?.timezone ?? DEFAULT_TIMEZONE,
    requireLocationValidation: setting?.requireLocationValidation ?? false,
    workingDays: WEEKDAY_INDEXES,
  };
});

export const getSettings = cache(async () => {
  const existing = await db.setting.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  // Created lazily so a migrated-but-unseeded database is still usable.
  return db.setting.create({ data: { id: SETTINGS_ID } });
});

export async function getActiveFences(): Promise<GeoFence[]> {
  const locations = await db.workLocation.findMany({
    where: { isActive: true },
    select: { name: true, latitude: true, longitude: true, radiusMeters: true },
  });
  return locations;
}

export const getAllFences = cache(async (): Promise<WorkLocation[]> => {
  return db.workLocation.findMany({ orderBy: { createdAt: "asc" } });
});

export type ScheduleWithUsage = WorkSchedule & { _count: { users: number } };

export const getAllSchedules = cache(async (): Promise<ScheduleWithUsage[]> => {
  return db.workSchedule.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
});

/** Options for employee pickers. */
export const getActiveSchedules = cache(async () => {
  return db.workSchedule.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, startTime: true, endTime: true },
  });
});