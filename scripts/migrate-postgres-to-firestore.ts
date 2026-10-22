/**
 * One-off PostgreSQL → Firestore migration.
 *
 * The application no longer reads PostgreSQL at runtime. This script exists only
 * to copy the existing Supabase/PostgreSQL data into the new Firestore project so
 * attendance history is not lost.
 *
 *   npm run db:migrate-from-postgres            # dry run: counts only
 *   npm run db:migrate-from-postgres -- --apply # write to Firestore
 *
 * Required environment:
 *   DATABASE_URL            the old PostgreSQL connection string
 *   FIREBASE_*              the new Firestore service account (see .env.example)
 *
 * The migration is idempotent: documents are written with `set`, so re-running it
 * overwrites the same records instead of duplicating them.
 */
import "dotenv/config";
import pg from "pg";
import { getApps } from "firebase-admin/app";
import { firestore } from "../src/lib/firebase-config";
import { parseEmployeeCode } from "../src/lib/attendance/employee-code";

// Keep timestamps as strings so node-postgres does not reinterpret Prisma's
// `timestamp without time zone` columns in the machine's local timezone.
pg.types.setTypeParser(1114, (value: string) => value); // timestamp
pg.types.setTypeParser(1184, (value: string) => value); // timestamptz
pg.types.setTypeParser(1082, (value: string) => value); // date

const COLLECTIONS = {
  users: "users",
  schedules: "schedules",
  locations: "locations",
  settings: "settings",
  attendance: "attendance",
  auditLogs: "auditLogs",
  userEmails: "userEmails",
  employeeCodes: "employeeCodes",
  counters: "counters",
} as const;

const SETTINGS_DOC_ID = "organization";
const APPLY = process.argv.includes("--apply");

type Row = Record<string, unknown>;

interface PendingWrite {
  ref: FirebaseFirestore.DocumentReference;
  data: Row;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized);
  const date = new Date(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

async function commitAll(writes: PendingWrite[]): Promise<void> {
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = firestore.batch();
    for (const write of writes.slice(offset, offset + 400)) {
      batch.set(write.ref, write.data);
    }
    await batch.commit();
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. It is only needed for this one-off migration; see .env.example.",
    );
  }

  const parsedUrl = new URL(url);
  console.log(
    `Source: postgresql://${parsedUrl.username}@${parsedUrl.hostname}:${parsedUrl.port || 5432}${parsedUrl.pathname}`,
  );
  console.log(`Target: Firestore${process.env.FIRESTORE_EMULATOR_HOST ? ` emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : ""}`);
  console.log(APPLY ? "Mode:   APPLY (writes to Firestore)\n" : "Mode:   DRY RUN (pass --apply to write)\n");

  const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };
  const client = new pg.Client({ connectionString: url, ssl });

  try {
    await client.connect();

    const users = (await client.query('select * from "users"')).rows as Row[];
    const schedules = (await client.query('select * from "work_schedules"')).rows as Row[];
    const scheduleDays = (await client.query('select * from "work_schedule_days"')).rows as Row[];
    const locations = (await client.query('select * from "work_locations"')).rows as Row[];
    const settings = (await client.query('select * from "settings"')).rows as Row[];
    const attendances = (await client.query('select * from "attendances"')).rows as Row[];
    const auditLogs = (await client.query('select * from "audit_logs"')).rows as Row[];

    console.log(
      `Read ${users.length} users, ${schedules.length} schedules, ${locations.length} locations, ` +
        `${attendances.length} attendance rows, ${auditLogs.length} audit entries.`,
    );

    if (!APPLY) {
      console.log("\nDry run complete. Re-run with `-- --apply` to write to Firestore.");
      return;
    }

    const usersById = new Map(users.map((user) => [String(user.id), user]));
    const daysBySchedule = new Map<string, Row[]>();
    for (const day of scheduleDays) {
      const key = String(day.scheduleId);
      const list = daysBySchedule.get(key) ?? [];
      list.push({
        id: day.id,
        scheduleId: day.scheduleId,
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
        lateToleranceMinutes: day.lateToleranceMinutes,
        isWorkingDay: day.isWorkingDay,
      });
      daysBySchedule.set(key, list);
    }

    const writes: PendingWrite[] = [];

    for (const user of users) {
      const id = String(user.id);
      const email = String(user.email).toLowerCase();
      writes.push({
        ref: firestore.collection(COLLECTIONS.users).doc(id),
        data: {
          email,
          passwordHash: user.passwordHash,
          name: user.name,
          employeeCode: user.employeeCode ?? null,
          role: user.role,
          department: user.department ?? null,
          phone: user.phone ?? null,
          isActive: user.isActive !== false,
          scheduleId: user.scheduleId ?? null,
          createdAt: toDate(user.createdAt),
          updatedAt: toDate(user.updatedAt),
        },
      });
      writes.push({
        ref: firestore.collection(COLLECTIONS.userEmails).doc(email),
        data: { userId: id },
      });
      if (user.employeeCode) {
        writes.push({
          ref: firestore.collection(COLLECTIONS.employeeCodes).doc(String(user.employeeCode)),
          data: { userId: id },
        });
      }
    }

    for (const schedule of schedules) {
      const id = String(schedule.id);
      // The old per-day rows become the flat list of working days the schedule
      // applies to. Schedules without day rows fall back to Monday–Friday.
      const workingDays = (daysBySchedule.get(id) ?? [])
        .filter((day) => day.isWorkingDay === true)
        .map((day) => day.dayOfWeek)
        .filter(
          (day): day is number =>
            typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
        );
      writes.push({
        ref: firestore.collection(COLLECTIONS.schedules).doc(id),
        data: {
          name: schedule.name,
          description: schedule.description ?? null,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          lateToleranceMinutes: schedule.lateToleranceMinutes ?? 0,
          breakMinutes: schedule.breakMinutes ?? 60,
          workingDays:
            workingDays.length > 0 ? [...new Set(workingDays)].sort((a, b) => a - b) : [1, 2, 3, 4, 5],
          isActive: schedule.isActive !== false,
          isOrganizationDefault: schedule.isOrganizationDefault === true,
          days: daysBySchedule.get(id) ?? [],
          createdAt: toDate(schedule.createdAt),
          updatedAt: toDate(schedule.updatedAt),
        },
      });
    }

    for (const location of locations) {
      writes.push({
        ref: firestore.collection(COLLECTIONS.locations).doc(String(location.id)),
        data: {
          name: location.name,
          address: location.address ?? null,
          latitude: location.latitude,
          longitude: location.longitude,
          radiusMeters: location.radiusMeters ?? 200,
          isActive: location.isActive !== false,
          createdAt: toDate(location.createdAt),
          updatedAt: toDate(location.updatedAt),
        },
      });
    }

    const setting = settings[0];
    if (setting) {
      writes.push({
        ref: firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID),
        data: {
          organizationName: setting.organizationName ?? "Universal Attendance",
          timezone: setting.timezone ?? "Asia/Jakarta",
          defaultScheduleId: setting.defaultScheduleId ?? null,
          requireLocationValidation: setting.requireLocationValidation === true,
          updatedAt: toDate(setting.updatedAt),
        },
      });
    }

    for (const attendance of attendances) {
      const userId = String(attendance.userId);
      const workDate = dateKey(attendance.workDate);
      if (!workDate) continue;
      writes.push({
        ref: firestore.collection(COLLECTIONS.attendance).doc(`${userId}_${workDate}`),
        data: {
          userId,
          workDate,
          checkInAt: toDate(attendance.checkInAt),
          checkOutAt: toDate(attendance.checkOutAt),
          checkInLatitude: attendance.checkInLatitude ?? null,
          checkInLongitude: attendance.checkInLongitude ?? null,
          checkInDistanceM: attendance.checkInDistanceM ?? null,
          checkOutLatitude: attendance.checkOutLatitude ?? null,
          checkOutLongitude: attendance.checkOutLongitude ?? null,
          checkOutDistanceM: attendance.checkOutDistanceM ?? null,
          status: attendance.status,
          lateMinutes: attendance.lateMinutes ?? 0,
          workedMinutes: attendance.workedMinutes ?? 0,
          outsideRadius: attendance.outsideRadius === true,
          notes: attendance.notes ?? null,
          createdAt: toDate(attendance.createdAt),
          updatedAt: toDate(attendance.updatedAt),
        },
      });
    }

    for (const log of auditLogs) {
      const actorId = log.actorId ? String(log.actorId) : null;
      const actor = actorId ? usersById.get(actorId) : undefined;
      writes.push({
        ref: firestore.collection(COLLECTIONS.auditLogs).doc(String(log.id)),
        data: {
          actorId,
          actorName: actor ? actor.name : null,
          actorEmail: actor ? String(actor.email).toLowerCase() : null,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId ?? null,
          summary: log.summary,
          metadata: log.metadata ?? null,
          ipAddress: log.ipAddress ?? null,
          createdAt: toDate(log.createdAt),
        },
      });
    }

    // Counters keep generated employee codes ahead of every migrated code.
    const highestByPrefix = new Map<string, number>();
    for (const user of users) {
      if (!user.employeeCode) continue;
      const parsed = parseEmployeeCode(String(user.employeeCode));
      if (!parsed) continue;
      highestByPrefix.set(
        parsed.prefix,
        Math.max(highestByPrefix.get(parsed.prefix) ?? 0, parsed.sequence),
      );
    }
    for (const [prefix, value] of highestByPrefix) {
      writes.push({
        ref: firestore.collection(COLLECTIONS.counters).doc(prefix),
        data: { value },
      });
    }

    await commitAll(writes);
    console.log(`\nMigrated ${writes.length} documents to Firestore.`);
    console.log("Run `npm run db:check` to verify the target, then deploy the new app.");
  } finally {
    await client.end().catch(() => {});
    // A dry run never touches Firestore, so terminating would initialize a
    // client just to shut it down — and fail if no service account is present.
    if (getApps().length > 0) {
      await firestore.terminate().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error("\nMigration failed:", error);
  process.exitCode = 1;
});
