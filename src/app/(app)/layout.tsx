import type { Metadata } from "next";
import { requireUser } from "@/lib/dal/auth";
import { getLocationPolicy } from "@/lib/dal/settings";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Absensi",
};

/**
 * Authentication boundary for every screen under `(app)`.
 *
 * `requireUser` runs here as an early filter, but it is deliberately *not* the
 * security boundary: a layout does not stop a child page or a Server Action
 * from executing, so each of those re-verifies authorization through the DAL.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const policy = await getLocationPolicy();

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      }}
      organizationName={policy.organizationName}
    >
      {children}
    </AppShell>
  );
}