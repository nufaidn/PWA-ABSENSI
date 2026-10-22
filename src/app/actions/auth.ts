"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  loginSchema,
  adminLoginSchema,
  fieldErrors,
  changePasswordSchema,
} from "@/lib/validation/schemas";
import {
  verifyCredentials,
  verifyAdminCredentials,
  changeOwnPassword,
} from "@/lib/dal/employees";
import { assertUser, getCurrentUserUncached } from "@/lib/dal/auth";
import { createSession, destroySession } from "@/lib/session";
import { hasRole } from "@/lib/attendance/time";
import { MissingEnvironmentVariableError } from "@/lib/env";
import { FirebaseConfigurationError } from "@/lib/firebase-config";

/**
 * Authentication Server Actions.
 *
 * Failures are returned as state rather than thrown, so the login form can
 * render an inline message without an error boundary.
 */

export interface LoginState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Only same-origin relative paths are honoured, so a crafted `?next=` cannot
 * bounce a freshly authenticated user to another host.
 */
function safeRedirectTarget(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/**
 * Turns a deployment misconfiguration into a message the user can act on.
 *
 * A missing `FIREBASE_*` variable or `AUTH_SECRET` is an operator problem, not
 * a wrong-password problem. Left unhandled it bubbles up to the root error
 * boundary and the operator sees a generic "Terjadi kesalahan" page with a
 * reference code and no hint. Caught here it becomes a plain sentence naming
 * the variable that has to be set.
 *
 * Returns null for every other error so real failures keep their stack trace.
 */
function configurationMessage(error: unknown): string | null {
  if (error instanceof FirebaseConfigurationError) {
    return "Server belum dikonfigurasi: kredensial Firebase belum lengkap. Hubungi admin.";
  }
  if (error instanceof MissingEnvironmentVariableError) {
    return `Server belum dikonfigurasi: variabel ${error.variable} belum diset. Hubungi admin.`;
  }
  return null;
}

/** Employee sign-in. Accepts an employee code or, as a fallback, an email. */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier") ?? formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  let user: Awaited<ReturnType<typeof verifyCredentials>>;
  try {
    user = await verifyCredentials(parsed.data.identifier, parsed.data.password);
  } catch (error) {
    const message = configurationMessage(error);
    if (message) return { error: message };
    throw error;
  }

  // One generic message for both "unknown account" and "wrong password" so the
  // form cannot be used to discover which accounts exist.
  if (!user) {
    return { error: "ID Karyawan atau password salah, atau akun sedang dinonaktifkan." };
  }

  try {
    await createSession(user.id);
  } catch (error) {
    const message = configurationMessage(error);
    if (message) return { error: message };
    throw error;
  }
  const safeNext = safeRedirectTarget(parsed.data.next);
  if (safeNext) redirect(safeNext);

  redirect(hasRole(user.role, "ADMIN") ? "/admin/overview" : "/dashboard");
}

/**
 * Admin sign-in, used only by `/admin`.
 *
 * Separate from `loginAction` so the admin area has its own credential path and
 * a non-admin account is rejected here rather than being silently redirected to
 * the employee dashboard.
 */
export async function adminLoginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = adminLoginSchema.safeParse({
    identifier: formData.get("identifier") ?? formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  let user: Awaited<ReturnType<typeof verifyAdminCredentials>>;
  try {
    user = await verifyAdminCredentials(parsed.data.identifier, parsed.data.password);
  } catch (error) {
    const message = configurationMessage(error);
    if (message) return { error: message };
    throw error;
  }

  // Deliberately identical wording to the employee form. Saying "this account is
  // not an administrator" would confirm that the credentials were correct.
  if (!user) {
    return { error: "Email atau password salah, atau akun sedang dinonaktifkan." };
  }

  try {
    await createSession(user.id);
  } catch (error) {
    const message = configurationMessage(error);
    if (message) return { error: message };
    throw error;
  }

  const safeNext = safeRedirectTarget(parsed.data.next);
  if (safeNext) redirect(safeNext);

  redirect("/admin/overview");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await changeOwnPassword(parsed.data.currentPassword, parsed.data.newPassword);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal mengubah password." };
  }

  revalidatePath("/profile");
  return { ok: true };
}

/** Guards an admin-only navigation entry point. */
export async function requireAdminAccess(): Promise<void> {
  const user = await getCurrentUserUncached();
  if (user && hasRole(user.role, "ADMIN")) redirect("/admin/overview");
  await assertUser();
}