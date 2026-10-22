import "server-only";
import { cache } from "react";
import bcrypt from "bcryptjs";
import type { Transaction } from "firebase-admin/firestore";
import type { Role, User } from "@/lib/domain";
import {
  COLLECTIONS,
  SETTINGS_DOC_ID,
  firestore,
  toUser,
  toWorkSchedule,
} from "@/lib/db";
import { ForbiddenError, NotFoundError, assertRole, assertUser } from "./auth";
import { recordAudit } from "./audit";
import { hasRole } from "@/lib/attendance/time";
import {
  codePrefixForRole,
  formatEmployeeCode,
  highestSequence,
  nextSequence,
  parseEmployeeCode,
  type CodedPrefix,
} from "@/lib/attendance/employee-code";
import type { ScheduleWithUsage } from "./settings";

/**
 * Employee and schedule Data Access Layer.
 *
 * Two invariants are enforced here rather than in the UI:
 *   1. An administrator can never escalate a user above their own rank.
 *   2. The last remaining super admin cannot be demoted or removed.
 *
 * Firestore has no unique indexes, so email and employee-code uniqueness live in
 * dedicated documents (`userEmails/{email}` and `employeeCodes/{code}`) written
 * in the same transaction as the user. The attendance document id
 * (`${userId}_${workDate}`) gives the same guarantee for one-record-per-day.
 */

const BCRYPT_ROUNDS = 12;

const users = () => firestore.collection(COLLECTIONS.users);
const employeeCodes = () => firestore.collection(COLLECTIONS.employeeCodes);
const userEmails = () => firestore.collection(COLLECTIONS.userEmails);
const counters = () => firestore.collection(COLLECTIONS.counters);
const schedules = () => firestore.collection(COLLECTIONS.schedules);

class DuplicateEmployeeError extends Error {
  constructor(message = "Email atau kode karyawan sudah digunakan.") {
    super(message);
    this.name = "DuplicateEmployeeError";
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function getUserById(id: string): Promise<User | null> {
  const snapshot = await users().doc(id).get();
  return snapshot.exists ? toUser(snapshot.id, snapshot.data() ?? {}) : null;
}

async function findUserByField(
  field: "email" | "employeeCode",
  value: string,
): Promise<User | null> {
  const snapshot = await users().where(field, "==", value).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? toUser(doc.id, doc.data()) : null;
}

/**
 * Verifies employee credentials. Returns null for unknown user *and* wrong
 * password.
 *
 * Employees sign in with their `employeeCode`, because that is what they are
 * given on their joining paperwork. Email is accepted as a fallback so someone
 * who does not remember the format can still get in.
 */
export async function verifyCredentials(
  identifier: string,
  password: string,
): Promise<User | null> {
  const value = identifier.trim();
  const normalized = normalizeEmail(value);

  const user =
    (await findUserByField("employeeCode", value)) ??
    (await findUserByField("email", normalized));

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

async function scheduleNameMap(): Promise<Map<string, string>> {
  const snapshot = await schedules().get();
  return new Map(
    snapshot.docs.map((doc) => [
      doc.id,
      typeof doc.data().name === "string" ? doc.data().name : "",
    ]),
  );
}

export const getEmployees = cache(
  async (
    options: {
      search?: string;
      department?: string;
      role?: Role | "ALL";
      active?: "ALL" | "active" | "inactive";
    } = {},
  ): Promise<EmployeeListItem[]> => {
    await assertRole("ADMIN");

    const [snapshot, scheduleNames] = await Promise.all([
      users().get(),
      scheduleNameMap(),
    ]);

    const search = options.search?.trim().toLowerCase();
    return snapshot.docs
      .map((doc) => toUser(doc.id, doc.data()))
      .filter((user) => {
        if (options.department && user.department !== options.department) return false;
        if (options.role && options.role !== "ALL" && user.role !== options.role) return false;
        if (options.active === "active" && !user.isActive) return false;
        if (options.active === "inactive" && user.isActive) return false;
        if (!search) return true;
        return (
          user.name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search) ||
          (user.employeeCode?.toLowerCase().includes(search) ?? false)
        );
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name, "id");
      })
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        employeeCode: user.employeeCode,
        role: user.role,
        department: user.department,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
        schedule: user.scheduleId
          ? { id: user.scheduleId, name: scheduleNames.get(user.scheduleId) ?? "—" }
          : null,
      }));
  },
);

export async function getEmployee(id: string): Promise<EmployeeListItem> {
  await assertRole("ADMIN");
  const [user, scheduleNames] = await Promise.all([getUserById(id), scheduleNameMap()]);
  if (!user) throw new NotFoundError("Karyawan tidak ditemukan.");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeCode: user.employeeCode,
    role: user.role,
    department: user.department,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt,
    schedule: user.scheduleId
      ? { id: user.scheduleId, name: scheduleNames.get(user.scheduleId) ?? "—" }
      : null,
  };
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

function codesForPrefix(snapshotCodes: readonly string[], prefix: CodedPrefix): Set<number> {
  const taken = new Set<number>();
  for (const code of snapshotCodes) {
    const parsed = parseEmployeeCode(code);
    if (parsed?.prefix === prefix) taken.add(parsed.sequence);
  }
  return taken;
}

/**
 * Suggests the next employee code for a role's track.
 *
 * **A preview, not a reservation.** Two calls a moment apart both return the same
 * number when nothing has been created in between, because this only reads. That
 * is fine for showing a suggestion in the form; `createEmployee` allocates
 * inside the same transaction as the insert.
 */
export async function allocateEmployeeCode(role: Role): Promise<string | null> {
  const prefix = codePrefixForRole(role);
  if (!prefix) return null;

  const snapshot = await users()
    .where("employeeCode", ">=", `${prefix}-`)
    .where("employeeCode", "<", `${prefix}-\uf8ff`)
    .get();
  const codes = snapshot.docs
    .map((doc) => doc.data().employeeCode)
    .filter((code): code is string => typeof code === "string");
  const highest = highestSequence(codes, prefix);
  return formatEmployeeCode(prefix, nextSequence(codesForPrefix(codes, prefix), highest));
}

async function allocateInsideTransaction(
  tx: Transaction,
  prefix: CodedPrefix,
): Promise<string> {
  const counterRef = counters().doc(prefix);
  const counterSnapshot = await tx.get(counterRef);
  const codeSnapshot = await tx.get(
    users()
      .where("employeeCode", ">=", `${prefix}-`)
      .where("employeeCode", "<", `${prefix}-\uf8ff`),
  );

  const codes = codeSnapshot.docs
    .map((doc) => doc.data().employeeCode)
    .filter((code): code is string => typeof code === "string");
  const taken = codesForPrefix(codes, prefix);
  const counterValue =
    typeof counterSnapshot.data()?.value === "number" ? counterSnapshot.data()!.value : 0;
  const highest = Math.max(highestSequence(codes, prefix), counterValue);

  let candidate = nextSequence(taken, highest);
  // A uniqueness document is authoritative even if a user document was removed
  // without cleaning it up. Read before writing, as Firestore requires.
  while ((await tx.get(employeeCodes().doc(formatEmployeeCode(prefix, candidate)))).exists) {
    candidate += 1;
  }

  return formatEmployeeCode(prefix, candidate);
}

export async function createEmployee(input: CreateEmployeeInput): Promise<User> {
  const actor = await assertRole("ADMIN");

  if (!hasRole(actor.role, input.role)) {
    throw new ForbiddenError("Anda tidak dapat membuat akun dengan role di atas akun Anda.");
  }

  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const explicitCode = input.employeeCode?.trim() || null;
  const prefix = codePrefixForRole(input.role);
  const userId = crypto.randomUUID();
  const now = new Date();

  try {
    const created = await firestore.runTransaction(async (tx) => {
      const emailRef = userEmails().doc(email);
      const emailSnapshot = await tx.get(emailRef);
      if (emailSnapshot.exists) throw new DuplicateEmployeeError();

      let employeeCode = explicitCode;
      if (employeeCode) {
        const codeSnapshot = await tx.get(employeeCodes().doc(employeeCode));
        if (codeSnapshot.exists) throw new DuplicateEmployeeError();
      } else if (prefix) {
        employeeCode = await allocateInsideTransaction(tx, prefix);
      }

      // Keep the counter monotonic even when an administrator supplies an
      // explicit code below the current high-water mark. Reusing a number that
      // was already issued would make an old code point at a new person.
      let counterValue = 0;
      if (prefix && employeeCode) {
        const counterSnapshot = await tx.get(counters().doc(prefix));
        const current =
          typeof counterSnapshot.data()?.value === "number"
            ? counterSnapshot.data()!.value
            : 0;
        counterValue = Math.max(parseEmployeeCode(employeeCode)?.sequence ?? 0, current);
      }

      const data = {
        email,
        passwordHash,
        name: input.name.trim(),
        employeeCode,
        role: input.role,
        department: input.department?.trim() || null,
        phone: input.phone?.trim() || null,
        isActive: true,
        scheduleId: input.scheduleId || null,
        createdAt: now,
        updatedAt: now,
      };

      tx.set(users().doc(userId), data);
      tx.set(emailRef, { userId });
      if (employeeCode) {
        tx.set(employeeCodes().doc(employeeCode), { userId });
        if (prefix && counterValue > 0) {
          tx.set(counters().doc(prefix), { value: counterValue }, { merge: true });
        }
      }

      return toUser(userId, data);
    });

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
    if (error instanceof DuplicateEmployeeError) throw error;
    throw error instanceof Error ? error : new Error("Terjadi kesalahan tak terduga.");
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
  const existing = await getUserById(id);
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");

  if (input.role && !hasRole(actor.role, input.role)) {
    throw new ForbiddenError("Anda tidak dapat menetapkan role di atas akun Anda.");
  }
  if (input.role && existing.role === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN") {
    await assertNotLastSuperAdmin(id);
  }

  const nextEmail =
    input.email !== undefined ? normalizeEmail(input.email) : existing.email;
  const nextCode =
    input.employeeCode !== undefined
      ? input.employeeCode?.trim() || null
      : existing.employeeCode;

  try {
    const updated = await firestore.runTransaction(async (tx) => {
      const userRef = users().doc(id);
      const userSnapshot = await tx.get(userRef);
      if (!userSnapshot.exists) throw new NotFoundError("Karyawan tidak ditemukan.");

      if (nextEmail !== existing.email) {
        const emailSnapshot = await tx.get(userEmails().doc(nextEmail));
        if (emailSnapshot.exists) throw new DuplicateEmployeeError();
      }
      if (nextCode && nextCode !== existing.employeeCode) {
        const codeSnapshot = await tx.get(employeeCodes().doc(nextCode));
        if (codeSnapshot.exists) throw new DuplicateEmployeeError();
      }

      const data = {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: nextEmail } : {}),
        ...(input.employeeCode !== undefined ? { employeeCode: nextCode } : {}),
        ...(input.department !== undefined
          ? { department: input.department?.trim() || null }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.scheduleId !== undefined ? { scheduleId: input.scheduleId || null } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        updatedAt: new Date(),
      };

      tx.update(userRef, data);

      if (nextEmail !== existing.email) {
        tx.delete(userEmails().doc(existing.email));
        tx.set(userEmails().doc(nextEmail), { userId: id });
      }
      if (nextCode !== existing.employeeCode) {
        if (existing.employeeCode) tx.delete(employeeCodes().doc(existing.employeeCode));
        if (nextCode) tx.set(employeeCodes().doc(nextCode), { userId: id });
      }

      return toUser(id, { ...existing, ...data });
    });

    await recordAudit({
      actorId: actor.id,
      action:
        input.role && input.role !== existing.role
          ? "EMPLOYEE_ROLE_CHANGED"
          : "EMPLOYEE_UPDATED",
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
    if (error instanceof DuplicateEmployeeError) throw error;
    throw error instanceof Error ? error : new Error("Terjadi kesalahan tak terduga.");
  }
}

export async function setEmployeeActive(id: string, isActive: boolean): Promise<void> {
  const actor = await assertRole("ADMIN");
  const existing = await getUserById(id);
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");

  // Without this guard an admin could lock every administrator out of the app.
  if (!isActive && existing.role === "SUPER_ADMIN") {
    await assertNotLastSuperAdmin(id);
  }

  await users().doc(id).update({ isActive, updatedAt: new Date() });

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

  const existing = await getUserById(id);
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");
  if (existing.role === "SUPER_ADMIN") {
    await assertNotLastSuperAdmin(id);
  }

  // Firestore has no cascading delete. Attendance rows are removed first so a
  // failure leaves the account (and its login) intact rather than orphaning rows.
  const attendance = await firestore
    .collection(COLLECTIONS.attendance)
    .where("userId", "==", id)
    .get();
  for (let offset = 0; offset < attendance.docs.length; offset += 400) {
    const batch = firestore.batch();
    for (const doc of attendance.docs.slice(offset, offset + 400)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  const batch = firestore.batch();
  batch.delete(users().doc(id));
  if (existing.employeeCode) batch.delete(employeeCodes().doc(existing.employeeCode));
  batch.delete(userEmails().doc(existing.email));
  await batch.commit();

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
  const existing = await getUserById(id);
  if (!existing) throw new NotFoundError("Karyawan tidak ditemukan.");

  const passwordHash = await hashPassword(newPassword);
  await users().doc(id).update({ passwordHash, updatedAt: new Date() });

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
  const snapshot = await users().get();
  const remaining = snapshot.docs
    .map((doc) => toUser(doc.id, doc.data()))
    .filter(
      (user) =>
        user.role === "SUPER_ADMIN" && user.isActive && user.id !== excludingUserId,
    ).length;
  if (remaining === 0) {
    throw new ForbiddenError(
      "Ini adalah satu-satunya Super Admin aktif. Promosikan admin terlebih dahulu.",
    );
  }
}

// ---------------------------------------------------------------------------
// Self-service
// ---------------------------------------------------------------------------

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = await assertUser();
  const record = await getUserById(user.id);
  if (!record) throw new NotFoundError("Akun tidak ditemukan.");

  const ok = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!ok) throw new Error("Password saat ini salah.");

  const passwordHash = await hashPassword(newPassword);
  await users().doc(user.id).update({ passwordHash, updatedAt: new Date() });
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export interface ScheduleInput {
  name: string;
  /** Free-form note shown to employees and administrators. */
  description: string | null;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  breakMinutes: number;
  /** Days the schedule applies to, `0 = Minggu` … `6 = Sabtu`. */
  workingDays: number[];
  isActive: boolean;
  makeDefault: boolean;
}

async function scheduleUsage(id: string): Promise<number> {
  const snapshot = await users().where("scheduleId", "==", id).get();
  return snapshot.size;
}

async function syncSettingDefault(scheduleId: string | null): Promise<void> {
  await firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID).set(
    { defaultScheduleId: scheduleId, updatedAt: new Date() },
    { merge: true },
  );
}

export async function createSchedule(input: ScheduleInput): Promise<ScheduleWithUsage> {
  const actor = await assertRole("ADMIN");
  const scheduleId = crypto.randomUUID();
  const now = new Date();

  const created = await firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(schedules());
    if (input.makeDefault) {
      for (const doc of snapshot.docs) {
        tx.update(doc.ref, { isOrganizationDefault: false, updatedAt: now });
      }
    }

    const data = {
      name: input.name.trim(),
      description: input.description ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      lateToleranceMinutes: input.lateToleranceMinutes,
      breakMinutes: input.breakMinutes,
      workingDays: [...input.workingDays].sort((a, b) => a - b),
      isActive: input.isActive,
      isOrganizationDefault: input.makeDefault,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(schedules().doc(scheduleId), data);
    return toWorkSchedule(scheduleId, data);
  });

  if (input.makeDefault) await syncSettingDefault(created.id);

  await recordAudit({
    actorId: actor.id,
    action: "SCHEDULE_CREATED",
    entityType: "WorkSchedule",
    entityId: created.id,
    summary: `Membuat jadwal ${created.name} (${created.startTime}-${created.endTime})`,
    metadata: { workingDays: created.workingDays },
  });

  return { ...created, _count: { users: 0 } };
}

export async function updateSchedule(id: string, input: ScheduleInput): Promise<ScheduleWithUsage> {
  const actor = await assertRole("ADMIN");
  const existingSnapshot = await schedules().doc(id).get();
  if (!existingSnapshot.exists) throw new NotFoundError("Jadwal tidak ditemukan.");

  const now = new Date();
  const updated = await firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(schedules());
    if (input.makeDefault) {
      for (const doc of snapshot.docs) {
        if (doc.id !== id) {
          tx.update(doc.ref, { isOrganizationDefault: false, updatedAt: now });
        }
      }
    }

    const data = {
      name: input.name.trim(),
      description: input.description ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      lateToleranceMinutes: input.lateToleranceMinutes,
      breakMinutes: input.breakMinutes,
      workingDays: [...input.workingDays].sort((a, b) => a - b),
      isActive: input.isActive,
      ...(input.makeDefault ? { isOrganizationDefault: true } : {}),
      updatedAt: now,
    };
    tx.update(schedules().doc(id), data);
    return toWorkSchedule(id, { ...(existingSnapshot.data() ?? {}), ...data });
  });

  if (input.makeDefault) await syncSettingDefault(id);

  await recordAudit({
    actorId: actor.id,
    action: "SCHEDULE_UPDATED",
    entityType: "WorkSchedule",
    entityId: id,
    summary: `Memperbarui jadwal ${updated.name} (${updated.startTime}-${updated.endTime})`,
    metadata: { workingDays: updated.workingDays },
  });

  return { ...updated, _count: { users: await scheduleUsage(id) } };
}

export async function deleteSchedule(id: string): Promise<void> {
  const actor = await assertRole("ADMIN");
  const existingSnapshot = await schedules().doc(id).get();
  if (!existingSnapshot.exists) throw new NotFoundError("Jadwal tidak ditemukan.");
  const existing = toWorkSchedule(existingSnapshot.id, existingSnapshot.data() ?? {});

  const usedBy = await scheduleUsage(id);
  if (usedBy > 0) {
    throw new Error(
      `Jadwal masih digunakan oleh ${usedBy} karyawan. Lepaskan terlebih dahulu.`,
    );
  }

  await schedules().doc(id).delete();
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
