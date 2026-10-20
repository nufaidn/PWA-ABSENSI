"use server";

import { revalidatePath } from "next/cache";
import {
  allocateEmployeeCode,
  createEmployee,
  deleteEmployee,
  resetEmployeePassword,
  setEmployeeActive,
  updateEmployee,
} from "@/lib/dal/employees";
import { assertRole, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/dal/auth";
import type { Role } from "@/generated/prisma/enums";
import {
  createEmployeeSchema,
  fieldErrors,
  parseBoolean,
  resetPasswordSchema,
  setActiveSchema,
  deleteEmployeeSchema,
  updateEmployeeSchema,
} from "@/lib/validation/schemas";
import type { ActionState } from "@/lib/action-state";

/**
 * Administrative employee Server Actions.
 *
 * `assertRole` runs inside the DAL, not here, so these actions cannot be called
 * without a session even if the page-level guard were bypassed.
 */

export type { ActionState };

function toState(error: unknown): { error: string } {
  if (error instanceof ForbiddenError) return { error: error.message };
  if (error instanceof UnauthorizedError) {
    return { error: "Sesi Anda berakhir. Silakan masuk kembali." };
  }
  if (error instanceof NotFoundError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  console.error("[admin] action failed", error);
  return { error: "Terjadi kesalahan tak terduga." };
}

function revalidateEmployeeViews() {
  revalidatePath("/admin/employees");
  revalidatePath("/admin/reports");
}

/**
 * Hands the form the next free employee code for a role's track.
 *
 * Called when the create dialog opens and again whenever the role changes, so
 * the field shows a real code rather than an empty box. It is only a preview:
 * `createEmployee` allocates again inside a locked transaction, because another
 * administrator may take the number between this call and the submit.
 */
export async function previewEmployeeCodeAction(formData: FormData): Promise<string | null> {
  const role = (formData.get("role") ?? "EMPLOYEE") as Role;
  try {
    // Admin-only, matching createEmployee: code allocation reveals how many
    // people have been added.
    await assertRole("ADMIN");
    return await allocateEmployeeCode(role);
  } catch {
    return null;
  }
}

export async function createEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    employeeCode: formData.get("employeeCode") || undefined,
    role: formData.get("role") || "EMPLOYEE",
    department: formData.get("department") || undefined,
    phone: formData.get("phone") || undefined,
    scheduleId: formData.get("scheduleId") || undefined,
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    const created = await createEmployee(parsed.data);
    revalidateEmployeeViews();
    return { ok: true, message: `Karyawan ${created.name} berhasil ditambahkan.` };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function updateEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "ID karyawan tidak valid." };
  }

  const parsed = updateEmployeeSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email") || undefined,
    employeeCode: formData.get("employeeCode") || undefined,
    role: formData.get("role") || undefined,
    department: formData.get("department") || undefined,
    phone: formData.get("phone") || undefined,
    scheduleId: formData.get("scheduleId") || undefined,
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    const updated = await updateEmployee(id, parsed.data);
    revalidateEmployeeViews();
    return { ok: true, message: `Data ${updated.name} berhasil diperbarui.` };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function setEmployeeActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = setActiveSchema.safeParse({
    id: formData.get("id"),
    isActive: parseBoolean(formData.get("isActive")),
  });

  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  try {
    await setEmployeeActive(parsed.data.id, parsed.data.isActive);
    revalidateEmployeeViews();
    return {
      ok: true,
      message: parsed.data.isActive ? "Akun berhasil diaktifkan." : "Akun berhasil dinonaktifkan.",
    };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function deleteEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteEmployeeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  try {
    await deleteEmployee(parsed.data.id);
    revalidateEmployeeViews();
    return { ok: true, message: "Karyawan berhasil dihapus beserta riwayat absensinya." };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    id: formData.get("id"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    await resetEmployeePassword(parsed.data.id, parsed.data.newPassword);
    revalidatePath("/admin/employees");
    return { ok: true, message: "Password berhasil direset." };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}