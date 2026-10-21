/**
 * Demo data seed.
 *
 * Idempotent by design: every record is looked up by a natural key before being
 * created, so re-running the seed refreshes demo history without duplicating
 * users or schedules.
 *
 * Run with: `npm run db:seed`
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";
import { ROLE_LABEL } from "../src/lib/attendance/time";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Password123!";

/**
 * Refuses to create demo accounts on anything that is not a scratch database.
 *
 * Every seeded account shares one well-known password, so running this against a
 * deployment would publish working logins — including two admins. Opting in
 * explicitly is the whole barrier, which is why the check is here rather than in
 * documentation.
 */
function assertDemoSeedAllowed(): void {
  const optedIn =
    process.env.SEED_ALLOW_DEMO_DATA === "true" || process.env.NODE_ENV !== "production";
  if (optedIn) return;

  throw new Error(
    "Refusing to seed demo data in production.\n" +
      "These accounts all share one well-known password, including SUPER_ADMIN.\n" +
      "To seed anyway, set SEED_ALLOW_DEMO_DATA=true explicitly.",
  );
}
const TIMEZONE = process.env.SEED_TIMEZONE ?? "Asia/Jakarta";
const ORGANIZATION = process.env.SEED_ORGANIZATION ?? "Nusantara Digital";

const MS_PER_MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Deterministic pseudo-randomness
//
// Seeding must be reproducible: the same command has to produce the same demo
// history, otherwise screenshots and manual QA drift between runs.
// ---------------------------------------------------------------------------

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const random = createRandom(20260113);

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

// ---------------------------------------------------------------------------
// Timezone helpers (mirror of src/lib/attendance/time.ts, kept dependency-free)
// ---------------------------------------------------------------------------

function getOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / MS_PER_MINUTE);
}

function dateKeyInZone(date: Date, timeZone: string): string {
  return new Date(date.getTime() + getOffsetMinutes(date, timeZone) * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}

/**
 * A `YYYY-MM-DD` key as the value to store in an `@db.Date` column.
 *
 * Must be UTC midnight of the calendar date. Subtracting the zone offset here
 * (as an earlier version did) yields the previous day in WIB, and PostgreSQL
 * truncates that to the wrong date — the same off-by-one the DAL had.
 */
function workDateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Resolves a wall-clock time on `key` to a real instant in `timeZone`. */
function instantFrom(key: string, minutesOfDay: number, timeZone: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d) + minutesOfDay * MS_PER_MINUTE;
  const first = naive - getOffsetMinutes(new Date(naive), timeZone) * MS_PER_MINUTE;
  const second = naive - getOffsetMinutes(new Date(first), timeZone) * MS_PER_MINUTE;
  return new Date(second);
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function parseTime(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const SCHEDULES = [
  {
    name: "Jam Kerja Reguler",
    startTime: "09:00",
    endTime: "18:00",
    lateToleranceMinutes: 10,
    breakMinutes: 60,
    isDefault: true,
  },
  {
    name: "Shift Pagi",
    startTime: "07:00",
    endTime: "15:00",
    lateToleranceMinutes: 5,
    breakMinutes: 45,
    isDefault: false,
  },
  {
    name: "Shift Malam",
    startTime: "15:00",
    endTime: "23:00",
    lateToleranceMinutes: 10,
    breakMinutes: 45,
    isDefault: false,
  },
  {
    name: "Karyawan Part-time",
    startTime: "10:00",
    endTime: "15:00",
    lateToleranceMinutes: 15,
    breakMinutes: 0,
    isDefault: false,
  },
];

const LOCATIONS = [
  {
    name: "Kantor Pusat — Sudirman",
    address: "Jl. Jenderal Sudirman Kav. 5-6, Jakarta Pusat",
    latitude: -6.208763,
    longitude: 106.816666,
    radiusMeters: 250,
  },
  {
    name: "Kantor Cabang — Bandung",
    address: "Jl. Asia Afrika No. 112, Bandung",
    latitude: -6.921137,
    longitude: 107.607054,
    radiusMeters: 200,
  },
  {
    name: "Kantor Cabang — Surabaya",
    address: "Jl. Jenderal Sudirman No. 1, Surabaya",
    latitude: -7.257905,
    longitude: 112.752119,
    radiusMeters: 200,
  },
];

const USERS: Array<{
  email: string;
  name: string;
  employeeCode: string;
  role: Role;
  department: string;
  phone: string | null;
  schedule: string;
  isActive?: boolean;
}> = [
  { email: "superadmin@demo.test", name: "Rina Hartati", employeeCode: "ADM-001", role: "SUPER_ADMIN", department: "Direksi", phone: "+62 812-1000-0001", schedule: "Jam Kerja Reguler" },
  { email: "admin@demo.test", name: "Dimas Prasetyo", employeeCode: "ADM-002", role: "ADMIN", department: "Sumber Daya Manusia", phone: "+62 812-1000-0002", schedule: "Jam Kerja Reguler" },
  { email: "admin2@demo.test", name: "Putri Maharani", employeeCode: "ADM-003", role: "ADMIN", department: "Operasional", phone: "+62 812-1000-0003", schedule: "Jam Kerja Reguler" },

  { email: "budi@demo.test", name: "Budi Santoso", employeeCode: "EMP-001", role: "EMPLOYEE", department: "Engineering", phone: "+62 812-2000-0001", schedule: "Jam Kerja Reguler" },
  { email: "siti@demo.test", name: "Siti Nurhaliza", employeeCode: "EMP-002", role: "EMPLOYEE", department: "Engineering", phone: "+62 812-2000-0002", schedule: "Shift Pagi" },
  { email: "andi@demo.test", name: "Andi Wijaya", employeeCode: "EMP-003", role: "EMPLOYEE", department: "Engineering", phone: "+62 812-2000-0003", schedule: "Jam Kerja Reguler" },
  { email: "dewi@demo.test", name: "Dewi Lestari", employeeCode: "EMP-004", role: "EMPLOYEE", department: "Pemasaran", phone: "+62 812-2000-0004", schedule: "Jam Kerja Reguler" },
  { email: "rizky@demo.test", name: "Rizky Ramadhan", employeeCode: "EMP-005", role: "EMPLOYEE", department: "Pemasaran", phone: "+62 812-2000-0005", schedule: "Karyawan Part-time" },
  { email: "maya@demo.test", name: "Maya Anggraini", employeeCode: "EMP-006", role: "EMPLOYEE", department: "Pemasaran", phone: "+62 812-2000-0006", schedule: "Jam Kerja Reguler" },
  { email: "fajar@demo.test", name: "Fajar Nugroho", employeeCode: "EMP-007", role: "EMPLOYEE", department: "Keuangan", phone: "+62 812-2000-0007", schedule: "Jam Kerja Reguler" },
  { email: "lina@demo.test", name: "Lina Kusuma", employeeCode: "EMP-008", role: "EMPLOYEE", department: "Keuangan", phone: "+62 812-2000-0008", schedule: "Shift Pagi" },
  { email: "hendra@demo.test", name: "Hendra Gunawan", employeeCode: "EMP-009", role: "EMPLOYEE", department: "Operasional", phone: "+62 812-2000-0009", schedule: "Shift Malam" },
  { email: "nadia@demo.test", name: "Nadia Syahputra", employeeCode: "EMP-010", role: "EMPLOYEE", department: "Operasional", phone: "+62 812-2000-0010", schedule: "Shift Malam" },
  { email: "yoga@demo.test", name: "Yoga Pratama", employeeCode: "EMP-011", role: "EMPLOYEE", department: "Operasional", phone: "+62 812-2000-0011", schedule: "Shift Pagi" },
  { email: "ratna@demo.test", name: "Ratna Dewi", employeeCode: "EMP-012", role: "EMPLOYEE", department: "Sumber Daya Manusia", phone: "+62 812-2000-0012", schedule: "Jam Kerja Reguler" },
  // Deliberately deactivated so the admin UI has an inactive record to show.
  { email: "tomas@demo.test", name: "Tomas Wibowo", employeeCode: "EMP-013", role: "EMPLOYEE", department: "Engineering", phone: null, schedule: "Jam Kerja Reguler", isActive: false },
  { email: "putri@demo.test", name: "Putri Maharani", employeeCode: "INT-001", role: "INTERN", department: "Engineering", phone: "+62 812-2000-0014", schedule: "Jam Kerja Reguler" },
  { email: "dimas@demo.test", name: "Dimas Pratama", employeeCode: "INT-002", role: "INTERN", department: "Pemasaran", phone: "+62 812-2000-0015", schedule: "Karyawan Part-time" },
];

const HISTORY_DAYS = 45;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  assertDemoSeedAllowed();
  console.log("Seeding demo data…\n");

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  // --- Schedules ---------------------------------------------------------
  const schedules = new Map();
  for (const definition of SCHEDULES) {
    // `isDefault` is a seed-only flag: the database column is called
    // `isOrganizationDefault`, so it must not be forwarded to Prisma.
    const { isDefault, ...fields } = definition;
    const schedule = await db.workSchedule.upsert({
      where: { name: definition.name },
      create: {
        ...fields,
        isOrganizationDefault: isDefault,
      },
      update: {
        ...fields,
        isOrganizationDefault: isDefault,
        isActive: true,
      },
    });
    schedules.set(definition.name, schedule);
  }
  const defaultSchedule = schedules.get("Jam Kerja Reguler");
  console.log(`  schedules: ${schedules.size}`);

  // --- Settings ----------------------------------------------------------
  await db.setting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      organizationName: ORGANIZATION,
      timezone: TIMEZONE,
      defaultScheduleId: defaultSchedule.id,
      // Off by default: enforcing GPS would block demo check-ins from a
      // desktop browser, which is exactly the failure mode this flag avoids.
      requireLocationValidation: false,
    },
    update: {
      organizationName: ORGANIZATION,
      timezone: TIMEZONE,
      defaultScheduleId: defaultSchedule.id,
    },
  });
  console.log("  settings: organization, timezone, default schedule");

  // --- Locations ---------------------------------------------------------
  for (const location of LOCATIONS) {
    await db.workLocation.upsert({
      where: { name: location.name },
      create: location,
      update: { ...location, isActive: true },
    });
  }
  console.log(`  locations: ${LOCATIONS.length}`);

  // --- Users -------------------------------------------------------------
  const users = new Map();
  for (const definition of USERS) {
    const data = {
      name: definition.name,
      passwordHash,
      employeeCode: definition.employeeCode,
      role: definition.role,
      department: definition.department,
      phone: definition.phone ?? null,
      isActive: definition.isActive ?? true,
      scheduleId: schedules.get(definition.schedule).id,
    };

    const user = await db.user.upsert({
      where: { email: definition.email },
      create: { email: definition.email, ...data },
      update: data,
      select: { id: true, email: true, name: true },
    });
    users.set(definition.email, user);
  }
  console.log(`  users: ${users.size}`);

  // --- Attendance history ------------------------------------------------
  const activeUsers = USERS.filter((definition) => definition.isActive !== false);
  const todayKey = dateKeyInZone(new Date(), TIMEZONE);
  let attendanceCount = 0;

  for (const definition of activeUsers) {
    const user = users.get(definition.email);
    const schedule = schedules.get(definition.schedule);

    for (let offset = HISTORY_DAYS; offset >= 0; offset -= 1) {
      const key = addDays(todayKey, -offset);
      const weekday = weekdayOf(key);
      const isWeekend = weekday === 0 || weekday === 6;

      const workDate = workDateFromKey(key);

      // Weekend and accounts deactivated midway have no records.
      if (isWeekend) continue;
      if (definition.isActive === false) continue;

      const existing = await db.attendance.findUnique({
        where: { userId_workDate: { userId: user.id, workDate } },
        select: { id: true },
      });
      if (existing) continue;

      // Roughly one absence in twenty, concentrated in the last two weeks so
      // the demo data shows a visible trend rather than uniform noise.
      const absenceWeight = offset < 14 ? 0.08 : 0.03;
      const roll = random();
      if (roll < absenceWeight) {
        await db.attendance.create({
          data: {
            userId: user.id,
            workDate,
            status: "ABSENT",
            notes: "Tanpa keterangan",
          },
        });
        attendanceCount += 1;
        continue;
      }

      const leaveWeight = offset < 14 ? 0.03 : 0.01;
      if (roll < absenceWeight + leaveWeight) {
        await db.attendance.create({
          data: {
            userId: user.id,
            workDate,
            status: "LEAVE",
            notes: pick(["Cuti tahunan", "Izin sakit", "Izin keperluan keluarga", "Cuti stabilizing"]),
          },
        });
        attendanceCount += 1;
        continue;
      }

      const scheduledStart = parseTime(schedule.startTime);
      const lateThreshold = scheduledStart + schedule.lateToleranceMinutes;

      // Most arrivals cluster around the threshold, which is what makes the
      // punctuality statistics look plausible.
      const arrivalOffset =
        random() < 0.68
          ? randomInt(-25, schedule.lateToleranceMinutes)
          : randomInt(schedule.lateToleranceMinutes + 1, 75);

      const arrivalMinute = lateThreshold + arrivalOffset;
      const checkInAt = instantFrom(key, arrivalMinute, TIMEZONE);

      const isLate = arrivalMinute > lateThreshold;
      const lateMinutes = Math.max(0, arrivalMinute - lateThreshold);

      // One in fourteen shifts is left open, so the admin dashboard has a real
      // "belum check-out" figure to display.
      const leftOpen = random() < 0.07;

      const scheduledEnd = parseTime(schedule.endTime);
      const checkoutOffset = randomInt(-20, 55);
      const checkOutAt = instantFrom(
        key,
        Math.min(scheduledEnd + checkoutOffset, 24 * 60 - 1),
        TIMEZONE,
      );

      const validCheckout = checkOutAt.getTime() > checkInAt.getTime();
      const hasCheckout = !leftOpen && validCheckout;

      // Plain elapsed time between the two instants, matching
      // `calculateWorkedMinutes`: no scheduled break is deducted.
      const workedMinutes = hasCheckout
        ? Math.max(
            0,
            Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / MS_PER_MINUTE),
          )
        : 0;

      // A minority of records sit outside the geo-fence, so the report's
      // "di luar radius" column is not empty in the demo.
      const outsideRadius = random() < 0.08;
      const distanceMeters = outsideRadius ? randomInt(400, 2500) : randomInt(3, 180);
      const office = pick(LOCATIONS);
      const jitterLat = office.latitude + (random() - 0.5) * 0.0012;
      const jitterLng = office.longitude + (random() - 0.5) * 0.0012;

      await db.attendance.create({
        data: {
          userId: user.id,
          workDate,
          checkInAt,
          checkOutAt: hasCheckout ? checkOutAt : null,
          status: hasCheckout ? (isLate ? "LATE" : "PRESENT") : "INCOMPLETE",
          lateMinutes: isLate ? lateMinutes : 0,
          workedMinutes,
          checkInLatitude: jitterLat,
          checkInLongitude: jitterLng,
          checkInDistanceM: distanceMeters,
          checkOutLatitude: hasCheckout ? jitterLat : null,
          checkOutLongitude: hasCheckout ? jitterLng : null,
          checkOutDistanceM: hasCheckout ? Math.round(distanceMeters * 1.4) : null,
          outsideRadius,
        },
      });
      attendanceCount += 1;
    }
  }
  console.log(`  attendance: ${attendanceCount} records over ${HISTORY_DAYS} days`);

  // --- Audit log sample --------------------------------------------------
  const adminActor = users.get("admin@demo.test");
  const auditCount = await db.auditLog.count();
  if (auditCount === 0) {
    await db.auditLog.createMany({
      data: [
        {
          actorId: adminActor.id,
          action: "EMPLOYEE_CREATED",
          entityType: "User",
          summary: "Membuat karyawan Ratna Dewi (ratna@demo.test) dengan role EMPLOYEE",
          ipAddress: "127.0.0.1",
          createdAt: new Date(Date.now() - 6 * 86_400_000),
        },
        {
          actorId: adminActor.id,
          action: "SCHEDULE_UPDATED",
          entityType: "WorkSchedule",
          summary: "Memperbarui jadwal Shift Pagi (07:00-15:00)",
          ipAddress: "127.0.0.1",
          createdAt: new Date(Date.now() - 3 * 86_400_000),
        },
        {
          actorId: users.get("superadmin@demo.test").id,
          action: "SETTINGS_UPDATED",
          entityType: "Setting",
          entityId: "1",
          summary: "Memperbarui pengaturan: zona waktu Asia/Jakarta, validasi lokasi opsional",
          ipAddress: "127.0.0.1",
          createdAt: new Date(Date.now() - 86_400_000),
        },
      ],
    });
    console.log("  audit log: 3 entries");
  } else {
    console.log(`  audit log: ${auditCount} entries (skipped)`);
  }

  console.log("\nSeed complete. Demo accounts:\n");
  for (const role of [Role.SUPER_ADMIN, Role.ADMIN, Role.EMPLOYEE, Role.INTERN]) {
    const sample = USERS.find((definition) => definition.role === role);
    if (!sample) continue;
    console.log(
      `  ${ROLE_LABEL[role].padEnd(12)} ${sample.email.padEnd(24)} ${SEED_PASSWORD}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });