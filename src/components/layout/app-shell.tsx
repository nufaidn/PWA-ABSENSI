"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Sidebar, MobileNav } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";
import type { Role } from "@/lib/attendance/time";

/**
 * Authenticated application shell.
 *
 * This is a Client Component only because `usePathname` is needed to highlight
 * the active navigation entry. No authorization decision is made here — the
 * layout above has already required a session, and every page and Server Action
 * independently re-verifies authorization through the DAL.
 */
export function AppShell({
  user,
  organizationName,
  children,
}: {
  user: { name: string; email: string; role: Role; department: string | null };
  organizationName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const logout = (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2.5 text-[13px] font-medium text-muted-foreground"
      >
        <LogOut className="size-4" />
        Keluar
      </Button>
    </form>
  );

  return (
    /*
      Column on mobile, row from `lg` up.
      
      `MobileNav` used to be a sibling of the content column inside a plain
      `flex` row, which put its top bar *beside* the page instead of above it —
      so the top bar took a slice of the viewport width and squeezed every page
      into what was left, clipping cards off the right edge. It now lives inside
      the content column; its bottom tab bar is `fixed`, so it still escapes the
      flow regardless of where it is declared.
    */
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <Sidebar
        user={user}
        organizationName={organizationName}
        pathname={pathname}
        logoutSlot={logout}
      />

      {/*
        The bottom padding clears the fixed mobile tab bar; on desktop the
        padding is zero because the sidebar is in normal flow.
      */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0">
        <MobileNav
          user={user}
          organizationName={organizationName}
          pathname={pathname}
          logoutSlot={logout}
        />

        {children}
      </div>
    </div>
  );
}