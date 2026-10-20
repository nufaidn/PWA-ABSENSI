import "server-only";
import { cache } from "react";
import bcrypt from "bcryptjs";
import type { Prisma, Role, User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, assertRole, assertUser } from "./auth";
import { recordAudit } from "./audit";
import { hasRole } from "@/lib/attendance/time";
import {
  codePrefixForRole,
  formatEmployeeCode,
  highestSequence,
  nextSequence,
  type CodedPrefix,
} from "@/lib/attendance/employee-code";
import type { ScheduleWithUsage } from "./settings";

/**
 * Employee and schedule Data Access Layer.
 *
 * Two invariants are enforced here rather than in the UI:
 *   1. An administrator can never escalate a user above their own rank.
 *   2. The last remaining super admin cannot be demoted or removed.
 */

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verifies employee credentials. Returns null for unknown user *and* wrong
 * password.
 *
 * Employees sign in with their `employeeCode`, because that is what they are
 * given on their joining paperwork. Email is accepted as a fallback so someone
 * who does not remember the format can still get in; both columns are unique, so
 * a single lookup per candidate is enough.
 */
export async function verifyCredentials(
  identifier: string,
  password: string,
): Promise<User | null> {
  const value = identifier.trim();
  const normalized = value.toLowerCase();

  const user =
    (await db.user.findUnique({ where: { employeeCode: value } })) ??
    (await db.user.findUnique({ where: { email: normalized } }));

  if (!user) {
    // Hash a dummy value so a missing account costs the same time as a wrong
    // password, removing the user-enumeration signal from response latency.
    await bcrypt.compare(password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return null;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  if (!user.isActive) return null;
  return user;
}

/**
 * Admin-only variant of `verifyCredentials`.
 *
 * Identical failure handling, but rejects anyone below ADMIN so the public
 * employee form cannot be used to reach the admin area with an employee
 * account. Kept separate rather than adding a flag: the rule belongs at the
 * call site that makes it.
 */
export async function verifyAdminCredentials(
  identifier: string,
  password: string,
): Promise<User | null> {
  const user = await verifyCredentials(identifier, password);
  if (!user) return null;
  return hasRole(user.role, "ADMIN") ? user : null;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface EmployeeListItem {
  id: string;
  name: string;
  email: string;
  employeeCode: string | null;
  role: Role;
  department: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  schedule: { id: string; name: string } | null;
}

export const getEmployees = cache(
  async (options: { search?: string; department?: string; role?: Role | "ALL"; active?: "ALL" | "active" | "inactive" } = {}): Promise<EmployeeListItem[]> => {
    await assertRole("ADMIN");

    const where: Prisma.UserWhereInput = {
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { email: { contains: options.search, mode: "insensitive" } },
              { employeeCode: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(options.department ? { department: options.department } : {}),
      ...(options.role && options.role !== "ALL" ? { role: options.role } : {}),
      ...(options.active === "active"
        ? { isActive: true }
        : options.active === "inactive"
          ? { isActive: false }
          : {}),
    };

    return db.user.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
        createdAt: true,
        schedule: { select: { id: true, name: true } },
      },
    });
  },
);

export async function getEmployee(id: string): Promise<EmployeeListItem> {
  await assertRole("ADMIN");
  const employee = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      employeeCode: true,
      role: true,
      department: true,
      phone: true,
      isActive: true,
      createdAt: true,
      schedule: { select: { id: true, name: true } },
    },
  });
  if (!employee) throw new NotFoundError("Karyawan tidak ditemukan.");
  return employee;
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  password: string;
  employeeCode?: string | null;
  role: Role;
  department?: string | null;
  phone?: string | null;
  scheduleId?: string | null;
}

/**
 * Suggests the next employee code for a role's track.
 *
 * **A preview, not a reservation.** Two calls a moment apart both return the same
 * number when nothing has been created in between, because this only reads. That
 * is fine for showing a suggestion in the form, and the create path does not rely
 * on it � `createEmployee` allocates *inside the same locked transaction as the
 * insert*, which is what actually makes the number exclusive.
 *
 * Returns null for roles that do not use codes (admins sign in by email).
 */
export async function allocateEmployeeCode(role: Role): Promise<string | null> {
  const prefix = codePrefixForRole(role);
  if (!prefix) return null;
  return nextCodeForPrefix(prefix);
}

/**
 * Takes the code-allocation advisory lock for `prefix`.
 *
 * Transaction-scoped, so PostgreSQL releases it on commit *and* on an exception,
 * where no cleanup call would run. `hashtext` derives a stable key from the
 * string. The key is per-prefix: allocating an `INT` code does not block an
 * `EMP` one.
 *
 * `$executeRawUnsafe` rather than `$queryRaw`: the lock function returns `void`,
 * which Prisma cannot deserialise, and nothing here needs the result.
 */
async function lockCodePrefix(tx: Prisma.TransactionClient, prefix: CodedPrefix): Promise<void> {
  await tx.$executeRawUnsafe(`select pg_advisory_xact_lock(hashtext($1))`, `uas-code-${prefix}`);
}

/** The next free number for a track, given whatever the caller can already see. */
async function nextCodeForPrefix(
  prefix: CodedPrefix,
  client: Pick<Prisma.TransactionClient, "user"> = db,
): Promise<string> {
  const taken = await client.user.findMany({
    where: { employeeCode: { startsWith: `${prefix}-` } },
    select: { employeeCode: true },
  });
  const codes = taken.map((row) => row.employeeCode).filter((code): code is string => code !== null);
  const highest = highestSequence(codes, prefix);
  return formatEmployeeCode(prefix, nextSequence(new Set(), highest));
}

/**
 * Creates the employee, assigning the code inside the insert's own transaction.
 *
 * The read and the write share one transaction under the prefix lock. A separate
 * "allocate, then insert" pair cannot work: the advisory lock would serialise the
 * two reads but reserve nothing, so two administrators would both compute
 * `EMP-002` and one would still fail on the unique index. Holding the lock
 * across the insert is what turns the number into a guarantee.
 *
 * A code supplied by the admin is used as-is and never auto-corrected � if it is
 * taken, they should be told rather than silently given a different identity.
 */
async function createWithAssignedCode(
  build: (tx: Prisma.TransactionClient, employeeCode: string | null) => Promise<User>,
  role: Role,
  explicitCode: string | null,
): Promise<User> {
  const prefix = codePrefixForRole(role);

  if (explicitCode || !prefix) {
    return build(db, explicitCode);
  }

  return db.$transaction(async (tx) => {
    await lockCodePrefix(tx, prefix);
    const code = await nextCodeForPrefix(prefix, tx);
    return build(tx, code);
  });
}

export async function createEmployee(input: CreateEmployeeInput): Promise<User> {
  const actor = await assertRole("ADMIN");

  if (!hasRole(actor.role, input.role)) {
    throw new ForbiddenError("Anda tidak dapat membuat akun dengan role di atas akun Anda.");
  }

  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  // An explicit code from the form always wins; a blank one is generated inside
  // the insert's transaction.
  const explicitCode = input.employeeCode?.trim() || null;

  const persist = async (
    tx: Prisma.TransactionClient,
    generatedCode: string | null,
  ): Promise<User> =>
    tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        employeeCode: explicitCode ?? generatedCode,
        role: input.role,
        department: input.department?.trim() || null,
        phone: input.phone?.trim() || null,
        scheduleId: input.scheduleId || null,
      },
    });

  try {
    const created = await createWithAssignedCode(persist, input.role, explicitCode);

    await recordAudit({
      actorId: actor.id,
      action: "EMPLOYEE_CREATED",
      entityType: "User",
      entityId: created.id,
      summary: `Membuat karyawan ${created.name} (${created.email}) dengan role ${created.role}`,
      metadata: {
        role: created.role,
        department: created.department,
        employeeCode: created.employeeCode,
      },
    });

    return created;
  } catch (error) {
    throw translateUniqueError(error, "Email atau kode karyawan sudah digunakan.");
  }
}

export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  employeeCode?: string | null;
  role?: Role;
  department?: string | null;
  phone?: string | null;
  scheduleId?: string | null;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<User> {
  const actor = await assertRole("ADMIN");
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");

  if (input.role && !hasRole(actor.role, input.role)) {
    throw new ForbiddenError("Anda tidak dapat menetapkan role di atas akun Anda.");
  }
  if (input.role && existing.role === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN") {
    await assertNotLastSuperAdmin(id);
  }

  try {
    const updated = await db.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.employeeCode !== undefined
          ? { employeeCode: input.employeeCode?.trim() || null }
          : {}),
        ...(input.department !== undefined ? { department: input.department?.trim() || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.scheduleId !== undefined ? { scheduleId: input.scheduleId || null } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
      },
    });

    await recordAudit({
      actorId: actor.id,
      action: input.role && input.role !== existing.role ? "EMPLOYEE_ROLE_CHANGED" : "EMPLOYEE_UPDATED",
      entityType: "User",
      entityId: id,
      summary:
        input.role && input.role !== existing.role
          ? `Mengubah role ${existing.name} dari ${existing.role} menjadi ${input.role}`
          : `Memperbarui data karyawan ${updated.name}`,
      metadata: { before: { role: existing.role }, after: { role: updated.role } },
    });

    return updated;
  } catch (error) {
    throw translateUniqueError(error, "Email atau kode karyawan sudah digunakan.");
  }
}

export async function setEmployeeActive(id: string, isActive: boolean): Promise<void> {
  const actor = await assertRole("ADMIN");
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");

  // Without this guard an admin could lock every administrator out of the app.
  if (!isActive && existing.role === "SUPER_ADMIN") {
    await assertNotLastSuperAdmin(id);
  }

  await db.user.update({ where: { id }, data: { isActive } });

  await recordAudit({
    actorId: actor.id,
    action: isActive ? "EMPLOYEE_REACTIVATED" : "EMPLOYEE_DEACTIVATED",
    entityType: "User",
    entityId: id,
    summary: `${isActive ? "Mengaktifkan" : "Menonaktifkan"} akun ${existing.name}`,
  });
}

export async function deleteEmployee(id: string): Promise<void> {
  const actor = await assertRole("ADMIN");
  if (actor.id === id) {
    throw new ForbiddenError("Anda tidak dapat menghapus akun Anda sendiri.");
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");
  if (existing.role === "SUPER_ADMIN") {
    await assertNotLastSuperAdmin(id);
  }

  // Cascades to Attendance via the schema's onDelete rule.
  await db.user.delete({ where: { id } });

  await recordAudit({
    actorId: actor.id,
    action: "EMPLOYEE_DELETED",
    entityType: "User",
    entityId: id,
    summary: `Menghapus karyawan ${existing.name} (${existing.email})`,
  });
}

export async function resetEmployeePassword(id: string, newPassword: string): Promise<void> {
  const actor = await assertRole("ADMIN");
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id }, data: { passwordHash } });

  await recordAudit({
    actorId: actor.id,
    action: "EMPLOYEE_PASSWORD_RESET",
    entityType: "User",
    entityId: id,
    summary: `Mereset password karyawan ${existing.name}`,
  });
}

/** Blocks any change that would remove the organization's last super admin. */
async function assertNotLastSuperAdmin(excludingUserId: string): Promise<void> {
  const remaining = await db.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, id: { not: excludingUserId } },
  });
  if (remaining === 0) {
    throw new ForbiddenError(
      "Ini adalah satu-satunya Super Admin aktif. Promosikan admin lain terlebih dahulu.",
    );
  }
}

/** True for a PostgreSQL unique-constraint violation, whatever layer raised it. */
function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Error && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return true;
  }
  // With a driver adapter the Prisma code may be nested under the driver error.
  if (error && typeof error === "object" && "meta" in error) {
    const nested = (error as { meta?: { driverAdapterError?: { code?: string } } }).meta
      ?.driverAdapterError;
    if (nested?.code === "23505") return true;
  }
  return false;
}

function translateUniqueError(error: unknown, message: string): Error {
  if (isUniqueViolation(error)) {
    return new Error(message);
  }
  if (error instanceof Error && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003") {
      return new Error("Data masih terkait dengan entitas lain dan tidak dapat dihapus.");
    }
  }
  return error instanceof Error ? error : new Error("Terjadi kesalahan tak terduga.");
}

// ---------------------------------------------------------------------------
// Self-service
// ---------------------------------------------------------------------------

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = await assertUser();
  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record) throw new NotFoundError("Akun tidak ditemukan.");

  const ok = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!ok) throw new Error("Password saat ini salah.");

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export interface ScheduleInput {
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  breakMinutes: number;
  isActive: boolean;
  makeDefault: boolean;
}

export async function createSchedule(input: ScheduleInput): Promise<ScheduleWithUsage> {
  const actor = await assertRole("ADMIN");

  const created = await db.$transaction(async (tx) => {
    if (input.makeDefault) {
      await tx.workSchedule.updateMany({ data: { isOrganizationDefault: false } });
    }
    return tx.workSchedule.create({
      data: {
        name: input.name.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
        lateToleranceMinutes: input.lateToleranceMinutes,
        breakMinutes: input.breakMinutes,
        isActive: input.isActive,
        isOrganizationDefault: input.makeDefault,
      },
      include: { _count: { select: { users: true } } },
    });
  });

  await syncSettingDefault(created.id);

  await recordAudit({
    actorId: actor.id,
    action: "SCHEDULE_CREATED",
    entityType: "WorkSchedule",
    entityId: created.id,
    summary: `Membuat jadwal ${created.name} (${created.startTime}-${created.endTime})`,
  });

  return created;
}

export async function updateSchedule(id: string, input: ScheduleInput): Promise<ScheduleWithUsage> {
  const actor = await assertRole("ADMIN");
  const existing = await db.workSchedule.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Jadwal tidak ditemukan.");

  const updated = await db.$transaction(async (tx) => {
    if (input.makeDefault) {
      await tx.workSchedule.updateMany({ data: { isOrganizationDefault: false } });
    }
    return tx.workSchedule.update({
      where: { id },
      data: {
        name: input.name.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
        lateToleranceMinutes: input.lateToleranceMinutes,
        breakMinutes: input.breakMinutes,
        isActive: input.isActive,
        ...(input.makeDefault ? { isOrganizationDefault: true } : {}),
      },
      include: { _count: { select: { users: true } } },
    });
  });

  await syncSettingDefault(id);

  await recordAudit({
    actorId: actor.id,
    action: "SCHEDULE_UPDATED",
    entityType: "WorkSchedule",
    entityId: id,
    summary: `Memperbarui jadwal ${updated.name} (${updated.startTime}-${updated.endTime})`,
  });

  return updated;
}

export async function deleteSchedule(id: string): Promise<void> {
  const actor = await assertRole("ADMIN");
  const existing = await db.workSchedule.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) throw new NotFoundError("Jadwal tidak ditemukan.");

  if (existing._count.users > 0) {
    throw new Error(
      `Jadwal masih digunakan oleh ${existing._count.users} karyawan. Lepaskan terlebih dahulu.`,
    );
  }

  await db.workSchedule.delete({ where: { id } });
  if (existing.isOrganizationDefault) {
    await syncSettingDefault(null);
  }

  await recordAudit({
    actorId: actor.id,
    action: "SCHEDULE_DELETED",
    entityType: "WorkSchedule",
    entityId: id,
    summary: `Menghapus jadwal ${existing.name}`,
  });
}

/** Points the singleton settings row at the organization default schedule. */
async function syncSettingDefault(scheduleId: string | null): Promise<void> {
  await db.setting.upsert({
    where: { id: 1 },
    create: { id: 1, defaultScheduleId: scheduleId },
    update: { defaultScheduleId: scheduleId },
  });
}

