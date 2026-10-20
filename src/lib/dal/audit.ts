import "server-only";
import { cache } from "react";
import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { headers } from "next/headers";
import { db } from "@/lib/db";
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
  metadata?: Prisma.InputJsonValue | null;
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

    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        metadata: entry.metadata ?? undefined,
        ipAddress,
      },
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

export async function getAuditLog(options: {
  page?: number;
  pageSize?: number;
  action?: AuditAction | "ALL";
  search?: string;
} = {}): Promise<AuditPage> {
  await assertRole("ADMIN");

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 20));

  const where: Prisma.AuditLogWhereInput = {
    ...(options.action && options.action !== "ALL" ? { action: options.action } : {}),
    ...(options.search
      ? {
          OR: [
            { summary: { contains: options.search, mode: "insensitive" } },
            { entityType: { contains: options.search, mode: "insensitive" } },
            { actor: { name: { contains: options.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        ipAddress: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const getAuditActions = cache(async (): Promise<AuditAction[]> => {
  const rows = await db.auditLog.groupBy({ by: ["action"] });
  return rows.map((r) => r.action);
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