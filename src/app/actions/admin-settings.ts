"use server";

import { revalidatePath } from "next/cache";
import { COLLECTIONS, SETTINGS_DOC_ID, firestore, toWorkLocation } from "@/lib/db";
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

/**
 * Reads the selected working days from the form.
 *
 * Every day chip is a checkbox named `workingDays`, so the browser sends one
 * entry per selected day. An empty selection is passed through as an empty
 * array and rejected by the schema — silently defaulting to Monday–Friday
 * would make a misclick invisible.
 */
function readWorkingDays(formData: FormData): string[] {
  return formData
    .getAll("workingDays")
    .filter((value): value is string => typeof value === "string");
}

export async function createScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scheduleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    lateToleranceMinutes: formData.get("lateToleranceMinutes"),
    breakMinutes: formData.get("breakMinutes"),
    workingDays: readWorkingDays(formData),
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
    description: formData.get("description") ?? undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    lateToleranceMinutes: formData.get("lateToleranceMinutes"),
    breakMinutes: formData.get("breakMinutes"),
    workingDays: readWorkingDays(formData),
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
    const result = await deleteSchedule(parsed.data.id);
    revalidateScheduleViews();

    const notes: string[] = [];
    if (result.movedUsers > 0) {
      notes.push(
        `${result.movedUsers} karyawan yang memakai jadwal ini kembali memakai jadwal default organisasi`,
      );
    }
    if (result.newDefaultName) {
      notes.push(`jadwal default organisasi sekarang "${result.newDefaultName}"`);
    }

    return {
      ok: true,
      message:
        notes.length > 0
          ? `Jadwal berhasil dihapus. ${notes.join("; ")}.`
          : "Jadwal berhasil dihapus.",
    };
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
    const now = new Date();
    const ref = firestore.collection(COLLECTIONS.locations).doc();
    await ref.set({
      ...parsed.data,
      address: parsed.data.address ?? null,
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit({
      actorId: actor.id,
      action: "LOCATION_CREATED",
      entityType: "WorkLocation",
      entityId: ref.id,
      summary: `Menambahkan lokasi absensi ${parsed.data.name} (radius ${parsed.data.radiusMeters} m)`,
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: `Lokasi ${parsed.data.name} berhasil ditambahkan.` };
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
    const ref = firestore.collection(COLLECTIONS.locations).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new NotFoundError("Lokasi tidak ditemukan.");
    const updated = toWorkLocation(snapshot.id, {
      ...(snapshot.data() ?? {}),
      ...parsed.data,
      address: parsed.data.address ?? null,
    });
    await ref.update({
      ...parsed.data,
      address: parsed.data.address ?? null,
      updatedAt: new Date(),
    });
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
    const ref = firestore.collection(COLLECTIONS.locations).doc(parsed.data.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new NotFoundError("Lokasi tidak ditemukan.");
    const existing = toWorkLocation(snapshot.id, snapshot.data() ?? {});

    await ref.delete();
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
    const now = new Date();
    await firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID).set(
      {
        organizationName: parsed.data.organizationName,
        timezone: parsed.data.timezone,
        defaultScheduleId: parsed.data.defaultScheduleId ?? null,
        requireLocationValidation: parsed.data.requireLocationValidation,
        updatedAt: now,
      },
      { merge: true },
    );

    // Keep the denormalised flag consistent so admin UIs can show which
    // schedule is the organization default without a second lookup.
    if (parsed.data.defaultScheduleId) {
      const target = firestore
        .collection(COLLECTIONS.schedules)
        .doc(parsed.data.defaultScheduleId);
      const targetSnapshot = await target.get();
      if (!targetSnapshot.exists) throw new NotFoundError("Jadwal tidak ditemukan.");

      const snapshot = await firestore.collection(COLLECTIONS.schedules).get();
      const batch = firestore.batch();
      for (const doc of snapshot.docs) {
        batch.update(doc.ref, {
          isOrganizationDefault: doc.id === parsed.data.defaultScheduleId,
          updatedAt: now,
        });
      }
      await batch.commit();
    }

    await recordAudit({
      actorId: actor.id,
      action: "SETTINGS_UPDATED",
      entityType: "Setting",
      entityId: SETTINGS_DOC_ID,
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
