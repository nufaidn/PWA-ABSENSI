"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { NotFoundError, assertRole } from "@/lib/dal/auth";
import { recordAudit } from "@/lib/dal/audit";
import { createSchedule, deleteSchedule, updateSchedule } from "@/lib/dal/employees";
import {
  deleteLocationSchema,
  deleteScheduleSchema,
  fieldErrors,
  locationSchema,
  parseBoolean,
  scheduleSchema,
  settingsSchema,
} from "@/lib/validation/schemas";
import type { ActionState } from "@/lib/action-state";

/**
 * Schedule, location and global settings Server Actions.
 * Settings mutation is restricted to SUPER_ADMIN.
 */

function toState(error: unknown): { error: string } {
  if (error instanceof NotFoundError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  console.error("[admin] action failed", error);
  return { error: "Terjadi kesalahan tak terduga." };
}

function revalidateScheduleViews() {
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/employees");
  revalidatePath("/dashboard");
}

export async function createScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scheduleSchema.safeParse({
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    lateToleranceMinutes: formData.get("lateToleranceMinutes"),
    breakMinutes: formData.get("breakMinutes"),
    isActive: parseBoolean(formData.get("isActive")),
    makeDefault: parseBoolean(formData.get("makeDefault")),
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    const created = await createSchedule(parsed.data);
    revalidateScheduleViews();
    return { ok: true, message: `Jadwal ${created.name} berhasil dibuat.` };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function updateScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "ID jadwal tidak valid." };
  }

  const parsed = scheduleSchema.safeParse({
    name: formData.get("name"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    lateToleranceMinutes: formData.get("lateToleranceMinutes"),
    breakMinutes: formData.get("breakMinutes"),
    isActive: parseBoolean(formData.get("isActive")),
    makeDefault: parseBoolean(formData.get("makeDefault")),
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    const updated = await updateSchedule(id, parsed.data);
    revalidateScheduleViews();
    return { ok: true, message: `Jadwal ${updated.name} berhasil diperbarui.` };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function deleteScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteScheduleSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  try {
    await deleteSchedule(parsed.data.id);
    revalidateScheduleViews();
    return { ok: true, message: "Jadwal berhasil dihapus." };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

// ---------------------------------------------------------------------------
// Geo-fences
// ---------------------------------------------------------------------------

export async function createLocationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertRole("SUPER_ADMIN");
  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    radiusMeters: formData.get("radiusMeters"),
    isActive: parseBoolean(formData.get("isActive")),
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    const created = await db.workLocation.create({ data: parsed.data });
    await recordAudit({
      actorId: actor.id,
      action: "LOCATION_CREATED",
      entityType: "WorkLocation",
      entityId: created.id,
      summary: `Menambahkan lokasi absensi ${created.name} (radius ${created.radiusMeters} m)`,
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: `Lokasi ${created.name} berhasil ditambahkan.` };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function updateLocationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertRole("SUPER_ADMIN");
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "ID lokasi tidak valid." };
  }

  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    radiusMeters: formData.get("radiusMeters"),
    isActive: parseBoolean(formData.get("isActive")),
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    const updated = await db.workLocation.update({ where: { id }, data: parsed.data });
    await recordAudit({
      actorId: actor.id,
      action: "LOCATION_UPDATED",
      entityType: "WorkLocation",
      entityId: id,
      summary: `Memperbarui lokasi absensi ${updated.name}`,
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: `Lokasi ${updated.name} berhasil diperbarui.` };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

export async function deleteLocationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertRole("SUPER_ADMIN");
  const parsed = deleteLocationSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };

  try {
    const existing = await db.workLocation.findUnique({ where: { id: parsed.data.id } });
    if (!existing) throw new NotFoundError("Lokasi tidak ditemukan.");

    await db.workLocation.delete({ where: { id: parsed.data.id } });
    await recordAudit({
      actorId: actor.id,
      action: "LOCATION_DELETED",
      entityType: "WorkLocation",
      entityId: parsed.data.id,
      summary: `Menghapus lokasi absensi ${existing.name}`,
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: "Lokasi berhasil dihapus." };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}

// ---------------------------------------------------------------------------
// Global settings
// ---------------------------------------------------------------------------

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertRole("SUPER_ADMIN");
  const parsed = settingsSchema.safeParse({
    organizationName: formData.get("organizationName"),
    timezone: formData.get("timezone"),
    defaultScheduleId: formData.get("defaultScheduleId") || undefined,
    requireLocationValidation: parseBoolean(formData.get("requireLocationValidation")),
  });

  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    await db.setting.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed.data },
      update: parsed.data,
    });

    // Keep the denormalised flag consistent so admin UIs can show which
    // schedule is the organization default without a second lookup.
    if (parsed.data.defaultScheduleId) {
      await db.$transaction([
        db.workSchedule.updateMany({
          where: { id: { not: parsed.data.defaultScheduleId } },
          data: { isOrganizationDefault: false },
        }),
        db.workSchedule.update({
          where: { id: parsed.data.defaultScheduleId },
          data: { isOrganizationDefault: true },
        }),
      ]);
    }

    await recordAudit({
      actorId: actor.id,
      action: "SETTINGS_UPDATED",
      entityType: "Setting",
      entityId: "1",
      summary: `Memperbarui pengaturan: zona waktu ${parsed.data.timezone}, validasi lokasi ${
        parsed.data.requireLocationValidation ? "wajib" : "opsional"
      }`,
      metadata: parsed.data,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/dashboard");
    return { ok: true, message: "Pengaturan berhasil disimpan." };
  } catch (error) {
    return { ok: false, ...toState(error) };
  }
}
