import "server-only";
import { cache } from "react";
import type { AuditAction } from "@/lib/domain";
import { COLLECTIONS, firestore, toAuditLog } from "@/lib/db";
import { headers } from "next/headers";
import { assertRole } from "./auth";

/**
 * Audit log Data Access Layer.
 *
 * `recordAudit` is the only write path and it is deliberately callable from
 * anywhere in the server: administrative mutations should not be able to
 * forget to log themselves.
 */

export interface AuditEntryInput {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

/** Appends an audit entry. Never throws — logging must not break a mutation. */
export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  try {
    let ipAddress: string | null = null;
    try {
      const headerList = await headers();
      ipAddress =
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        headerList.get("x-real-ip") ??
        null;
    } catch {
      // `headers()` is unavailable outside a request scope (e.g. in seed scripts).
    }

    await firestore.collection(COLLECTIONS.auditLogs).add({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      metadata: entry.metadata ?? null,
      ipAddress,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[audit] failed to record entry", error);
  }
}

export interface AuditPage {
  rows: Array<{
    id: string;
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    summary: string;
    ipAddress: string | null;
    createdAt: Date;
    actor: { name: string; email: string } | null;
  }>;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

/**
 * Firestore has no server-side join, so actor names are resolved from a users
 * lookup after the log is read. The log is capped at the most recent 1,000
 * entries: an audit screen that needs to page through more than that should
 * move to a BigQuery export rather than paying for an unbounded read.
 */
export async function getAuditLog(options: {
  page?: number;
  pageSize?: number;
  action?: AuditAction | "ALL";
  search?: string;
} = {}): Promise<AuditPage> {
  await assertRole("ADMIN");

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 20));

  const snapshot = await firestore
    .collection(COLLECTIONS.auditLogs)
    .orderBy("createdAt", "desc")
    .limit(1000)
    .get();

  const logs = snapshot.docs.map((doc) => toAuditLog(doc.id, doc.data()));

  const actorIds = [...new Set(logs.map((log) => log.actorId).filter(Boolean))] as string[];
  const actors = new Map<string, { name: string; email: string }>();
  await Promise.all(
    actorIds.map(async (id) => {
      const user = await firestore.collection(COLLECTIONS.users).doc(id).get();
      if (user.exists) {
        const data = user.data() ?? {};
        actors.set(id, {
          name: typeof data.name === "string" ? data.name : "",
          email: typeof data.email === "string" ? data.email : "",
        });
      }
    }),
  );

  const search = options.search?.trim().toLowerCase();
  const filtered = logs.filter((log) => {
    if (options.action && options.action !== "ALL" && log.action !== options.action) {
      return false;
    }
    if (!search) return true;
    const actor = log.actorId ? actors.get(log.actorId) : undefined;
    return (
      log.summary.toLowerCase().includes(search) ||
      log.entityType.toLowerCase().includes(search) ||
      (actor?.name.toLowerCase().includes(search) ?? false) ||
      (actor?.email.toLowerCase().includes(search) ?? false)
    );
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize).map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    summary: log.summary,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt,
    actor: log.actorId ? actors.get(log.actorId) ?? null : null,
  }));

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const getAuditActions = cache(async (): Promise<AuditAction[]> => {
  const snapshot = await firestore.collection(COLLECTIONS.auditLogs).limit(1000).get();
  const actions = new Set<AuditAction>();
  for (const doc of snapshot.docs) {
    const action = doc.data().action;
    if (typeof action === "string") actions.add(action as AuditAction);
  }
  return [...actions];
});

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  EMPLOYEE_CREATED: "Karyawan dibuat",
  EMPLOYEE_UPDATED: "Karyawan diperbarui",
  EMPLOYEE_DEACTIVATED: "Karyawan dinonaktifkan",
  EMPLOYEE_REACTIVATED: "Karyawan diaktifkan kembali",
  EMPLOYEE_DELETED: "Karyawan dihapus",
  EMPLOYEE_ROLE_CHANGED: "Role karyawan diubah",
  EMPLOYEE_PASSWORD_RESET: "Password karyawan direset",
  SCHEDULE_CREATED: "Jadwal dibuat",
  SCHEDULE_UPDATED: "Jadwal diperbarui",
  SCHEDULE_DELETED: "Jadwal dihapus",
  ATTENDANCE_ADJUSTED: "Absensi disesuaikan",
  SETTINGS_UPDATED: "Pengaturan diperbarui",
  LOCATION_CREATED: "Lokasi dibuat",
  LOCATION_UPDATED: "Lokasi diperbarui",
  LOCATION_DELETED: "Lokasi dihapus",
};
