import "server-only";
import { cache } from "react";
import type { WorkLocation, WorkSchedule } from "@/lib/domain";
import {
  COLLECTIONS,
  SETTINGS_DOC_ID,
  firestore,
  toSetting,
  toWorkLocation,
  toWorkSchedule,
} from "@/lib/db";
import type { GeoFence } from "@/lib/attendance/geofence";
import { DEFAULT_TIMEZONE, WEEKDAY_INDEXES } from "@/lib/attendance/time";

/**
 * Settings and schedule Data Access Layer.
 */

export interface EffectiveSchedule {
  id: string;
  name: string;
  /** Free-form note about the schedule, shown to employees. */
  description: string | null;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  breakMinutes: number;
  /** Days this schedule applies to, `0 = Minggu` … `6 = Sabtu`. */
  workingDays: readonly number[];
  /** True when this came from the organization default rather than the user. */
  isOrganizationDefault: boolean;
}

/** Fallback used before the database is seeded or if configuration is missing. */
const FALLBACK_SCHEDULE: EffectiveSchedule = {
  id: "fallback",
  name: "Jam Kerja Default",
  description: null,
  startTime: "09:00",
  endTime: "18:00",
  lateToleranceMinutes: 10,
  breakMinutes: 60,
  workingDays: WEEKDAY_INDEXES,
  isOrganizationDefault: true,
};

async function getScheduleById(id: string): Promise<WorkSchedule | null> {
  const snapshot = await firestore.collection(COLLECTIONS.schedules).doc(id).get();
  return snapshot.exists ? toWorkSchedule(snapshot.id, snapshot.data() ?? {}) : null;
}

async function readSettings() {
  const snapshot = await firestore
    .collection(COLLECTIONS.settings)
    .doc(SETTINGS_DOC_ID)
    .get();
  return snapshot.exists ? toSetting(snapshot.id, snapshot.data() ?? {}) : null;
}

/**
 * The organization's schedule for a user: their own assignment if present,
 * otherwise the organization default, otherwise a hardcoded fallback so the
 * app still functions on a freshly seeded database.
 */
export const getEffectiveSchedule = cache(async (userId: string): Promise<EffectiveSchedule> => {
  const userSnapshot = await firestore.collection(COLLECTIONS.users).doc(userId).get();
  const scheduleId = userSnapshot.exists
    ? (userSnapshot.data()?.scheduleId as string | undefined)
    : undefined;

  if (scheduleId) {
    const schedule = await getScheduleById(scheduleId);
    if (schedule) return toEffectiveSchedule(schedule, false);
  }

  const setting = await readSettings();
  if (setting?.defaultScheduleId) {
    const schedule = await getScheduleById(setting.defaultScheduleId);
    if (schedule) return toEffectiveSchedule(schedule, true);
  }

  const snapshot = await firestore.collection(COLLECTIONS.schedules).get();
  const schedules = snapshot.docs
    .map((doc) => toWorkSchedule(doc.id, doc.data()))
    .filter((schedule) => schedule.isOrganizationDefault && schedule.isActive)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return schedules[0] ? toEffectiveSchedule(schedules[0], true) : FALLBACK_SCHEDULE;
});

function toEffectiveSchedule(
  schedule: Pick<
    WorkSchedule,
    | "id"
    | "name"
    | "description"
    | "startTime"
    | "endTime"
    | "lateToleranceMinutes"
    | "breakMinutes"
    | "workingDays"
  >,
  isOrganizationDefault: boolean,
): EffectiveSchedule {
  return {
    id: schedule.id,
    name: schedule.name,
    description: schedule.description,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    lateToleranceMinutes: schedule.lateToleranceMinutes,
    breakMinutes: schedule.breakMinutes,
    workingDays: schedule.workingDays,
    isOrganizationDefault,
  };
}

export interface LocationPolicy {
  organizationName: string;
  timezone: string;
  requireLocationValidation: boolean;
}

/** Reads the singleton settings document, falling back to documented defaults. */
export const getLocationPolicy = cache(async (): Promise<LocationPolicy> => {
  const setting = await readSettings();
  return {
    organizationName: setting?.organizationName ?? "Universal Attendance",
    timezone: setting?.timezone ?? DEFAULT_TIMEZONE,
    requireLocationValidation: setting?.requireLocationValidation ?? false,
  };
});

export const getSettings = cache(async () => {
  const existing = await readSettings();
  if (existing) return existing;

  // Created lazily so a freshly created Firestore project is still usable.
  const now = new Date();
  await firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID).set({
    organizationName: "Universal Attendance",
    timezone: DEFAULT_TIMEZONE,
    defaultScheduleId: null,
    requireLocationValidation: false,
    updatedAt: now,
  });
  return {
    id: SETTINGS_DOC_ID,
    organizationName: "Universal Attendance",
    timezone: DEFAULT_TIMEZONE,
    defaultScheduleId: null,
    requireLocationValidation: false,
    updatedAt: now,
  };
});

export async function getActiveFences(): Promise<GeoFence[]> {
  const snapshot = await firestore.collection(COLLECTIONS.locations).get();
  return snapshot.docs
    .map((doc) => toWorkLocation(doc.id, doc.data()))
    .filter((location) => location.isActive)
    .map(({ name, latitude, longitude, radiusMeters }) => ({
      name,
      latitude,
      longitude,
      radiusMeters,
    }));
}

export const getAllFences = cache(async (): Promise<WorkLocation[]> => {
  const snapshot = await firestore.collection(COLLECTIONS.locations).get();
  return snapshot.docs
    .map((doc) => toWorkLocation(doc.id, doc.data()))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
});

export type ScheduleWithUsage = WorkSchedule & { _count: { users: number } };

export const getAllSchedules = cache(async (): Promise<ScheduleWithUsage[]> => {
  const [scheduleSnapshot, userSnapshot] = await Promise.all([
    firestore.collection(COLLECTIONS.schedules).get(),
    firestore.collection(COLLECTIONS.users).get(),
  ]);

  const usage = new Map<string, number>();
  for (const doc of userSnapshot.docs) {
    const scheduleId = doc.data().scheduleId;
    if (typeof scheduleId === "string") {
      usage.set(scheduleId, (usage.get(scheduleId) ?? 0) + 1);
    }
  }

  return scheduleSnapshot.docs
    .map((doc) => {
      const schedule = toWorkSchedule(doc.id, doc.data());
      return { ...schedule, _count: { users: usage.get(schedule.id) ?? 0 } };
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name, "id");
    });
});

/** Options for employee pickers. */
export const getActiveSchedules = cache(async () => {
  const snapshot = await firestore.collection(COLLECTIONS.schedules).get();
  return snapshot.docs
    .map((doc) => toWorkSchedule(doc.id, doc.data()))
    .filter((schedule) => schedule.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, "id"))
    .map(({ id, name, startTime, endTime, workingDays }) => ({
      id,
      name,
      startTime,
      endTime,
      workingDays,
    }));
});
