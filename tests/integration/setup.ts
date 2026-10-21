import { beforeEach, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { sslFor, testDatabaseUrl, TEST_SCHEMA } from "./env";

/**
 * Per-suite wiring for integration tests.
 *
 * Only the *identity* and the *connection* are faked. `assertUser()` is replaced
 * with a fixture user so the DAL can run outside a request cycle, and `@/lib/db`
 * is pointed at the throwaway schema. Everything below those — the queries, the
 * transactions, the `(userId, workDate)` unique constraint, the status
 * derivation — is the real thing talking to a real PostgreSQL, which is the only
 * way to prove the guarantees in `docs/architecture.md` §3.
 */

/**
 * Prisma bound to the throwaway schema, not to whatever DATABASE_URL points at.
 *
 * Two independent settings are required, and neither implies the other — each was
 * verified against a live database, and getting one wrong leaks the run into the
 * development schema:
 *
 *  - `schema` on the adapter is what Prisma qualifies its *generated* statements
 *    with. Under Prisma 7's driver adapter the `?schema=` query parameter is
 *    ignored here; with it absent Prisma defaults to `public` and every
 *    `db.model.create()` lands in the development tables even while the pool is
 *    pointed elsewhere.
 *  - `search_path` in the connection `options` is what *unqualified* SQL resolves
 *    against (`resetDatabase`'s TRUNCATE, `current_schema()`).
 *
 * `ssl` is set explicitly because the URL carries no `sslmode` (see env.ts).
 */
export const db = new PrismaClient({
  adapter: new PrismaPg(
    {
      connectionString: testDatabaseUrl(),
      ssl: sslFor(),
      // Vitest runs the integration files in parallel. The `pg` default of 10
      // clients per file multiplied by three files is enough to exhaust
      // Supabase's 15-client session pooler, so each suite gets a small pool.
      max: 2,
      connectionTimeoutMillis: 10_000,
    },
    { schema: TEST_SCHEMA },
  ),
});

/**
 * The DAL imports the client from `@/lib/db`, which builds its own connection
 * from `process.env.DATABASE_URL` at import time.
 *
 * Without this mock the DAL would run against the *development* schema while the
 * fixtures above wrote to the test schema — so `resetDatabase()`'s TRUNCATE would
 * hit the developer's real attendance rows. That is not hypothetical: it is
 * exactly what happened the first time this suite ran.
 */
vi.mock("@/lib/db", () => ({ db, serverDb: db }));

/** Row id used by the schema-leak probe in `resetDatabase`. */
const SCHEMA_PROBE_ID = "schema-probe-id";

/** The signed-in user for the current test. Mutated by `signInAs`. */
export const currentUser = {
  id: "",
  email: "test@attendance.test",
  name: "Test Employee",
  // Not `as const`: suites sign in as an admin, and a narrower type here would
  // make that assignment a compile error rather than a test failure.
  role: "EMPLOYEE" as "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN",
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

export async function resetDatabase(): Promise<void> {
  // Second line of defence, inside the suite itself. Both settings from the
  // client above are verified, because either one alone leaves the run writing
  // into `public`:
  //
  //  - `current_schema()` covers raw SQL, resolved via the pool's `search_path`.
  //  - a model-level write covers Prisma's generated statements, which are
  //    qualified from the adapter's `schema` option rather than the URL.
  //
  // The first version checked only `search_path`, which passed while every write
  // still went to the development tables.
  const schemaRows = await db.$queryRawUnsafe<{ current_schema: string }[]>(
    "select current_schema()",
  );
  if (schemaRows[0]?.current_schema !== TEST_SCHEMA) {
    throw new Error(
      `Refusing to truncate: pool search_path is "${schemaRows[0]?.current_schema}", expected "${TEST_SCHEMA}".`,
    );
  }

  await db.user.create({
    data: {
      id: SCHEMA_PROBE_ID,
      email: "schema-probe@attendance.test",
      passwordHash: "x",
      name: "schema probe",
    },
  });
  const leaked = await db.$queryRawUnsafe<{ n: number }[]>(
    `select count(*)::int as n from public.users where id = '${SCHEMA_PROBE_ID}'`,
  );
  if ((leaked[0]?.n ?? 0) > 0) {
    throw new Error(
      "Refusing to truncate: a Prisma write landed in public.users. The test schema is not being used.",
    );
  }

  // TRUNCATE ... CASCADE also clears the foreign keys between these tables.
  await db.$executeRawUnsafe(
    `truncate table "attendances", "audit_logs", "users", "work_locations", "work_schedules", "settings" restart identity cascade`,
  );
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
  role?: "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";
  scheduleId?: string | null;
  isActive?: boolean;
}

export async function seedUser(overrides: UserSeed = {}) {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2, 8)}@attendance.test`;
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

export async function seedSettings(overrides: {
  timezone?: string;
  requireLocationValidation?: boolean;
  defaultScheduleId?: string | null;
} = {}) {
  return db.setting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
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
export function signInAs(user: { id: string; email: string; name: string }): void {
  currentUser.id = user.id;
  currentUser.email = user.email;
  currentUser.name = user.name;
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
export async function baseFixture(overrides: UserSeed = {}, scheduleOverrides: ScheduleSeed = {}) {
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
