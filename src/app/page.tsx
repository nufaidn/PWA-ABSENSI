import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal/auth";
import { hasRole } from "@/lib/attendance/time";

/**
 * Entry point.
 *
 * Signed-out visitors go to the login screen. Everyone else is routed straight
 * to the surface that matches their role, so the root URL is never a dead end.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  redirect(hasRole(user.role, "ADMIN") ? "/admin/overview" : "/dashboard");
}