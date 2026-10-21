import { beforeEach, vi } from "vitest";
import {
  COLLECTIONS,
  SETTINGS_DOC_ID,
  attendanceDocId,
  firestore,
  toAttendance,
  toSetting,
  toUser,
  toWorkLocation,
  toWorkSchedule,
} from "@/lib/db";
import type { Attendance } from "@/lib/domain";

/**
 * Per-suite wiring for integration tests.
 *
 * Only the identity is faked. `assertUser()` is replaced with a fixture user so
 * the DAL can run outside a request cycle. Everything else — the Firestore
 * transactions, the `${userId}_${workDate}` document id, the status derivation —
 * is the real thing talking to the Firestore emulator, which is the only way to
 * prove the guarantees in `docs/architecture.md` §3.
 *
 * The emulator is started by `npm run test:integration` via
 * `firebase emulators:exec`, which exports `FIRESTORE_EMULATOR_HOST`.
 */

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId =
  process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "demo-attendance";

type TestAttendance = Omit<Attendance, "workDate"> & { workDate: Date };

function assertEmulator(): string {
  if (!emulatorHost) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. Run integration tests with `npm run test:integration`.",
    );
  }
  return emulatorHost.replace(/^https?:\/\//, "");
}

function workDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  throw new Error(`Invalid workDate: ${String(value)}`);
}

function toTestAttendance(id: string, data: FirebaseFirestore.DocumentData): TestAttendance {
  const record = toAttendance(id, data);
  return { ...record, workDate: new Date(`${record.workDate}T00:00:00.000Z`) };
}

function attendanceRef(where: {
  id?: string;
  userId_workDate?: { userId: string; workDate: Date | string };
}) {
  if (where.id) {
    return firestore.collection(COLLECTIONS.attendance).doc(where.id);
  }
  if (where.userId_workDate) {
    return firestore
      .collection(COLLECTIONS.attendance)
      .doc(
        attendanceDocId(
          where.userId_workDate.userId,
          workDateKey(where.userId_workDate.workDate),
        ),
      );
  }
  throw new Error("Unsupported attendance where clause");
}

function matchesWhere(
  row: TestAttendance,
  where: {
    userId?: string;
    workDate?: Date | string | { gte?: Date | string; lte?: Date | string };
    status?: string;
  },
): boolean {
  if (where.userId && row.userId !== where.userId) return false;
  if (where.status && row.status !== where.status) return false;
  if (where.workDate) {
    const key = row.workDate.toISOString().slice(0, 10);
    if (where.workDate instanceof Date || typeof where.workDate === "string") {
      if (key !== workDateKey(where.workDate)) return false;
    } else {
      if (where.workDate.gte && key < workDateKey(where.workDate.gte)) return false;
      if (where.workDate.lte && key > workDateKey(where.workDate.lte)) return false;
    }
  }
  return true;
}

/**
 * A deliberately tiny subset of the Prisma client used by the integration
 * tests. It talks to the same Firestore collections as the DAL, so the tests
 * exercise the real data layer instead of a mock.
 */
export const db = {
  attendance: {
    async findUnique({
      where,
    }: {
      where: { id?: string; userId_workDate?: { userId: string; workDate: Date | string } };
    }) {
      const snapshot = await attendanceRef(where).get();
      return snapshot.exists ? toTestAttendance(snapshot.id, snapshot.data() ?? {}) : null;
    },

    async findFirst() {
      const snapshot = await firestore.collection(COLLECTIONS.attendance).limit(1).get();
      const doc = snapshot.docs[0];
      return doc ? toTestAttendance(doc.id, doc.data()) : null;
    },

    async count(args?: {
      where?: {
        userId?: string;
        workDate?: Date | string | { gte?: Date | string; lte?: Date | string };
        status?: string;
      };
    }) {
      if (!args?.where) {
        const snapshot = await firestore.collection(COLLECTIONS.attendance).count().get();
        return snapshot.data().count;
      }
      const snapshot = await firestore.collection(COLLECTIONS.attendance).get();
      return snapshot.docs
        .map((doc) => toTestAttendance(doc.id, doc.data()))
        .filter((row) => matchesWhere(row, args.where!)).length;
    },

    async create({ data }: { data: Record<string, unknown> }) {
      const userId = String(data.userId);
      const key = workDateKey(data.workDate);
      const ref = firestore
        .collection(COLLECTIONS.attendance)
        .doc(attendanceDocId(userId, key));
      const now = new Date();
      await ref.create({
        ...data,
        userId,
        workDate: key,
        createdAt: data.createdAt ?? now,
        updatedAt: now,
      });
      const snapshot = await ref.get();
      return toTestAttendance(snapshot.id, snapshot.data() ?? {});
    },

    async update({
      where,
      data,
    }: {
      where: { id?: string; userId_workDate?: { userId: string; workDate: Date | string } };
      data: Record<string, unknown>;
    }) {
      const ref = attendanceRef(where);
      const payload = { ...data };
      if (payload.workDate !== undefined) payload.workDate = workDateKey(payload.workDate);
      await ref.update({ ...payload, updatedAt: new Date() });
      const snapshot = await ref.get();
      return toTestAttendance(snapshot.id, snapshot.data() ?? {});
    },
  },

  user: {
    async create({ data }: { data: Record<string, unknown> }) {
      const id = data.id ? String(data.id) : crypto.randomUUID();
      const email = String(data.email).toLowerCase();
      const now = new Date();
      const payload = {
        email,
        passwordHash: data.passwordHash ?? "",
        name: data.name ?? "",
        employeeCode: data.employeeCode ?? null,
        role: data.role ?? "EMPLOYEE",
        department: data.department ?? null,
        phone: data.phone ?? null,
        isActive: data.isActive ?? true,
        scheduleId: data.scheduleId ?? null,
        createdAt: data.createdAt ?? now,
        updatedAt: now,
      };
      const batch = firestore.batch();
      batch.set(firestore.collection(COLLECTIONS.users).doc(id), payload);
      batch.set(firestore.collection(COLLECTIONS.userEmails).doc(email), { userId: id });
      if (payload.employeeCode) {
        batch.set(
          firestore.collection(COLLECTIONS.employeeCodes).doc(String(payload.employeeCode)),
          { userId: id },
        );
      }
      await batch.commit();
      return toUser(id, payload);
    },
  },

  workSchedule: {
    async create({ data }: { data: Record<string, unknown> }) {
      const id = crypto.randomUUID();
      const now = new Date();
      const payload = {
        name: data.name ?? "Shift",
        description: data.description ?? null,
        startTime: data.startTime ?? "09:00",
        endTime: data.endTime ?? "18:00",
        lateToleranceMinutes: data.lateToleranceMinutes ?? 0,
        breakMinutes: data.breakMinutes ?? 60,
        isActive: data.isActive ?? true,
        isOrganizationDefault: data.isOrganizationDefault ?? false,
        createdAt: now,
        updatedAt: now,
      };
      await firestore.collection(COLLECTIONS.schedules).doc(id).set(payload);
      return toWorkSchedule(id, payload);
    },
  },

  workLocation: {
    async create({ data }: { data: Record<string, unknown> }) {
      const id = crypto.randomUUID();
      const now = new Date();
      const payload = {
        name: data.name ?? "Location",
        address: data.address ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        radiusMeters: data.radiusMeters ?? 200,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      await firestore.collection(COLLECTIONS.locations).doc(id).set(payload);
      return toWorkLocation(id, payload);
    },
  },

  setting: {
    async upsert({
      create,
      update,
    }: {
      where: { id: number };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const ref = firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID);
      const existing = await ref.get();
      const now = new Date();
      const payload = existing.exists
        ? { ...update, updatedAt: now }
        : {
            organizationName: create.organizationName ?? "Test Org",
            timezone: create.timezone ?? "Asia/Jakarta",
            defaultScheduleId: create.defaultScheduleId ?? null,
            requireLocationValidation: create.requireLocationValidation ?? false,
            updatedAt: now,
          };
      await ref.set(payload, { merge: true });
      const snapshot = await ref.get();
      return toSetting(snapshot.id, snapshot.data() ?? {});
    },

    async update({
      data,
    }: {
      where: { id: number };
      data: Record<string, unknown>;
    }) {
      const ref = firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID);
      await ref.set({ ...data, updatedAt: new Date() }, { merge: true });
      const snapshot = await ref.get();
      return toSetting(snapshot.id, snapshot.data() ?? {});
    },
  },

  async $disconnect(): Promise<void> {
    // The Admin SDK owns its transport; nothing to close between suites.
  },
};

/** The signed-in user for the current test. Mutated by `signInAs`. */
export const currentUser = {
  id: "",
  email: "test@attendance.test",
  name: "Test Employee",
  // Not `as const`: suites sign in as an admin, and a narrower type here would
  // make that assignment a compile error rather than a test failure.
  role: "EMPLOYEE" as "EMPLOYEE" | "INTERN" | "ADMIN" | "SUPER_ADMIN",
  department: null,
  employeeCode: null,
  phone: null,
  scheduleId: null,
  isActive: true,
};

vi.mock("@/lib/dal/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dal/auth")>("@/lib/dal/auth");
  class UnauthorizedError extends actual.UnauthorizedError {}
  class ForbiddenError extends actual.ForbiddenError {}
  class NotFoundError extends actual.NotFoundError {}
  return {
    ...actual,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    assertUser: async () => ({ ...currentUser }),
    getCurrentUser: async () => ({ ...currentUser }),
    getCurrentUserUncached: async () => ({ ...currentUser }),
    requireUser: async () => ({ ...currentUser }),
    requireRole: async () => ({ ...currentUser }),
    assertRole: async () => ({ ...currentUser }),
    requireActiveUserById: async () => ({ ...currentUser }),
  };
});

/** Clears the emulator. The REST endpoint is the only reliable full wipe. */
export async function resetDatabase(): Promise<void> {
  const host = assertEmulator();
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to clear Firestore emulator: ${response.status} ${response.statusText}`);
  }
}

export interface ScheduleSeed {
  startTime?: string;
  endTime?: string;
  lateToleranceMinutes?: number;
  breakMinutes?: number;
  isDefault?: boolean;
}

/** Creates a schedule and makes it the organization default. */
export async function seedSchedule(overrides: ScheduleSeed = {}) {
  return db.workSchedule.create({
    data: {
      name: overrides.isDefault === false ? "Shift Pagi" : "Shift Default",
      startTime: overrides.startTime ?? "09:00",
      endTime: overrides.endTime ?? "18:00",
      lateToleranceMinutes: overrides.lateToleranceMinutes ?? 10,
      breakMinutes: overrides.breakMinutes ?? 60,
      isOrganizationDefault: overrides.isDefault !== false,
      isActive: true,
    },
  });
}

export interface UserSeed {
  email?: string;
  name?: string;
  role?: "EMPLOYEE" | "INTERN" | "ADMIN" | "SUPER_ADMIN";
  scheduleId?: string | null;
  isActive?: boolean;
}

export async function seedUser(overrides: UserSeed = {}) {
  const email =
    overrides.email ?? `user-${Math.random().toString(36).slice(2, 8)}@attendance.test`;
  return db.user.create({
    data: {
      email,
      passwordHash: "not-used-in-these-tests",
      name: overrides.name ?? "Test Employee",
      role: overrides.role ?? "EMPLOYEE",
      isActive: overrides.isActive ?? true,
      scheduleId: overrides.scheduleId ?? null,
    },
  });
}

export async function seedLocation(input: {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  isActive?: boolean;
}) {
  return db.workLocation.create({
    data: {
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters ?? 200,
      isActive: input.isActive ?? true,
    },
  });
}

export async function seedSettings(
  overrides: {
    timezone?: string;
    requireLocationValidation?: boolean;
    defaultScheduleId?: string | null;
  } = {},
) {
  return db.setting.upsert({
    where: { id: 1 },
    create: {
      organizationName: "Test Org",
      timezone: overrides.timezone ?? "Asia/Jakarta",
      requireLocationValidation: overrides.requireLocationValidation ?? false,
      defaultScheduleId: overrides.defaultScheduleId ?? null,
    },
    update: {
      timezone: overrides.timezone,
      requireLocationValidation: overrides.requireLocationValidation,
      defaultScheduleId: overrides.defaultScheduleId,
    },
  });
}

/** Points the mocked identity at a freshly seeded user. */
export function signInAs(user: {
  id: string;
  email: string;
  name: string;
  role?: "EMPLOYEE" | "INTERN" | "ADMIN" | "SUPER_ADMIN";
}): void {
  currentUser.id = user.id;
  currentUser.email = user.email;
  currentUser.name = user.name;
  currentUser.role = user.role ?? "EMPLOYEE";
}

/**
 * Seeds an admin and signs in as them.
 *
 * Required by any suite exercising a function that calls `assertRole("ADMIN")` —
 * `createEmployee` and `updateEmployee` both do.
 */
export async function seedAdmin(email = `admin-${Date.now()}@attendance.test`) {
  const admin = await db.user.create({
    data: {
      email,
      passwordHash: "not-used-in-these-tests",
      name: "Test Admin",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });
  currentUser.role = "SUPER_ADMIN";
  signInAs(admin);
  return admin;
}

/**
 * Minimal fixture: one schedule as the default, one employee signed in.
 * Returns both so tests can assert against real ids.
 */
export async function baseFixture(
  overrides: UserSeed = {},
  scheduleOverrides: ScheduleSeed = {},
) {
  await resetDatabase();
  const schedule = await seedSchedule(scheduleOverrides);
  await seedSettings({ defaultScheduleId: schedule.id });
  const user = await seedUser(overrides);
  signInAs(user);
  return { schedule, user };
}

export function beforeEachDb(): void {
  beforeEach(async () => {
    await resetDatabase();
  });
}
