import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/domain";
import { COLLECTIONS, firestore, userFromSnapshot } from "@/lib/db";
import { decryptSession, readSessionToken } from "@/lib/session";
import { hasRole } from "@/lib/attendance/time";

export type { Role } from "@/lib/domain";

/**
 * Authentication / authorization Data Access Layer.
 *
 * This module is the only place allowed to turn a cookie into an identity.
 * Everything downstream receives a `CurrentUser` and never touches the session
 * token, which keeps the blast radius of a token-parsing bug small.
 */

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  employeeCode: string | null;
  phone: string | null;
  scheduleId: string | null;
  isActive: boolean;
}

export class UnauthorizedError extends Error {
  constructor(message = "Sesi tidak valid. Silakan masuk kembali.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Anda tidak memiliki izin untuk tindakan ini.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Data tidak ditemukan.") {
    super(message);
    this.name = "NotFoundError";
  }
}

function toCurrentUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  employeeCode: string | null;
  phone: string | null;
  scheduleId: string | null;
  isActive: boolean;
}): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    employeeCode: user.employeeCode,
    phone: user.phone,
    scheduleId: user.scheduleId,
    isActive: user.isActive,
  };
}

async function findUserById(id: string): Promise<CurrentUser | null> {
  const snapshot = await firestore.collection(COLLECTIONS.users).doc(id).get();
  const user = userFromSnapshot(snapshot);
  // A missing, deactivated or otherwise invalid account is treated as signed
  // out. This is what makes role changes take effect on the very next request.
  if (!user || !user.isActive) return null;
  return toCurrentUser(user);
}

/**
 * Resolves the signed-in user, or null when there is no usable session.
 *
 * `cache` deduplicates the lookup within a single render pass. Note that Server
 * Actions and Route Handlers are *not* part of a render pass, so callers there
 * must not assume this is memoised for them.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  const session = await decryptSession(token);
  if (!session) return null;
  return findUserById(session.sub);
});

/** Same as `getCurrentUser` but never cached across mutations. */
export async function getCurrentUserUncached(): Promise<CurrentUser | null> {
  const token = await readSessionToken();
  const session = await decryptSession(token);
  if (!session) return null;
  return findUserById(session.sub);
}

/** Redirects to the login page when signed out. Use in pages and layouts. */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  }
  return user;
}

/** Redirects when signed out, and sends under-privileged users to their home. */
export async function requireRole(role: Role, returnTo?: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!hasRole(user.role, role)) redirect("/dashboard");
  return user;
}

/** Throwing variants for use inside Server Actions and Route Handlers. */
export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUserUncached();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function assertRole(role: Role): Promise<CurrentUser> {
  const user = await assertUser();
  if (!hasRole(user.role, role)) throw new ForbiddenError();
  return user;
}

/**
 * Re-reads a user for administrative screens. Callers in admin pages should use
 * this rather than `requireUser` so that a role change made moments ago shows up.
 */
export async function requireActiveUserById(id: string): Promise<CurrentUser> {
  const user = await findUserById(id);
  if (!user) throw new NotFoundError("Karyawan tidak ditemukan.");
  return user;
}
