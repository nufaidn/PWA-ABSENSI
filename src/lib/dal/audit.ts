import "server-only";
import type { AuditAction } from "@/lib/domain";
import { COLLECTIONS, firestore } from "@/lib/db";
import { headers } from "next/headers";

/**
 * Audit log writer.
 *
 * `recordAudit` is the only write path and it is deliberately callable from
 * anywhere in the server: administrative mutations should not be able to
 * forget to log themselves.
 *
 * There is no read API because the admin-facing Audit Log screen was removed.
 * Entries are still appended to the `auditLogs` collection and can be inspected
 * directly in the Firebase console when an incident needs tracing.
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
