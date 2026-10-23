"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartColumn,
  CircleUserRound,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  MapPin,
  ScrollText,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Monogram } from "./badges";
import { ROLE_LABEL, ROLE_RANK, type Role } from "@/lib/attendance/time";

export interface NavUser {
  name: string;
  email: string;
  role: Role;
  department: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Minimum role required to see this entry. */
  minRole?: Role;
}

/**
 * Uses the shared rank rather than a local copy.
 *
 * A duplicate of this table here is how the `INTERN` role shipped invisible for
 * a moment: the compiler flagged the stale copy, but only because the object was
 * typed `Record<Role, number>`. Anything looser would have silently filtered the
 * wrong menu entries instead.
 */
const RANK = ROLE_RANK;

export const EMPLOYEE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: LayoutDashboard },
  { href: "/attendance", label: "Riwayat", icon: CalendarDays },
  { href: "/statistics", label: "Statistik", icon: ChartColumn },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
  { href: "/profile", label: "Profil", icon: CircleUserRound },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/overview", label: "Ringkasan", icon: LayoutDashboard, minRole: "ADMIN" },
  { href: "/admin/reports", label: "Laporan", icon: FileClock, minRole: "ADMIN" },
  { href: "/admin/employees", label: "Karyawan", icon: Users, minRole: "ADMIN" },
  { href: "/admin/schedules", label: "Jadwal Kerja", icon: ClipboardList, minRole: "ADMIN" },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings, minRole: "SUPER_ADMIN" },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText, minRole: "ADMIN" },
];

/**
 * `/admin` is the public admin sign-in, not a landing page, so the overview entry
 * is matched exactly like the employee dashboard — otherwise every admin page
 * would light up the "Ringkasan" item via the prefix match.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/overview" || href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Brand block. Rendered in the desktop sidebar and the mobile top bar.
 *
 * `homeHref` matters for administrators: pointing the logo at `/dashboard` would
 * silently drop an admin onto the employee home after tapping the wordmark.
 */
export function Brand({
  organizationName,
  homeHref = "/dashboard",
}: {
  organizationName: string;
  homeHref?: string;
}) {
  return (
    <Link href={homeHref} className="flex min-w-0 items-center gap-2.5">
      <span className="brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm shadow-primary/25">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 2v4M16 2v4M3 10h18M9 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold leading-tight tracking-tight">
          {organizationName}
        </span>
        <span className="block text-[11px] leading-tight text-muted-foreground">
          Attendance System
        </span>
      </span>
    </Link>
  );
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
              active
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar. Hidden below the `lg` breakpoint. */
export function Sidebar({
  user,
  organizationName,
  pathname,
  logoutSlot,
}: {
  user: NavUser;
  organizationName: string;
  pathname: string;
  logoutSlot: React.ReactNode;
}) {
  const isAdmin = RANK[user.role] >= RANK.ADMIN;
  // Administrators do not record attendance, so the employee destinations
  // (check-in, history, personal statistics) are deliberately absent here.
  const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="px-5 py-5">
        <Brand organizationName={organizationName} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isAdmin ? "Administrasi" : "Menu"}
        </p>
        <NavLinks items={nav} pathname={pathname} />
      </div>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Monogram name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>
        <div className="mt-1">{logoutSlot}</div>
      </div>
    </aside>
  );
}

/**
 * Mobile navigation.
 *
 * Two pieces, matching where a thumb rests on a phone:
 *   - a sticky top bar carrying the brand and the overflow menu
 *   - a bottom tab bar for the handful of destinations people open daily
 *
 * The overflow menu is controlled state rather than a `<details>` element. A
 * `<details>` stays open across App Router navigation — the layout persists, so
 * tapping a link moved the page and left the menu hanging over it — and there
 * was no way to dismiss it by tapping outside.
 */
export function MobileNav({
  user,
  organizationName,
  pathname,
  logoutSlot,
}: {
  user: NavUser;
  organizationName: string;
  pathname: string;
  logoutSlot: React.ReactNode;
}) {
  const livePathname = usePathname();
  const isAdmin = RANK[user.role] >= RANK.ADMIN;

  // Five destinations fit comfortably in the employee bar — home, history,
  // statistics, the gear tab and, as its own entry point, the profile tab the
  // gear page deliberately does not duplicate. Admins keep four admin pages and
  // reach the audit log and device permissions behind the overflow menu.
  const primary: NavItem[] = isAdmin ? ADMIN_NAV.slice(0, 4) : EMPLOYEE_NAV;

  const overflow: NavItem[] = isAdmin ? ADMIN_NAV.slice(4) : EMPLOYEE_NAV.slice(5);

  /**
   * Records which route the menu was opened on, not a plain boolean.
   *
   * Navigation changes `livePathname` without touching this state, so comparing
   * the two closes the menu as a *derived* value. Doing it in an effect would
   * mean a second render pass on every route change just to hide a panel.
   */
  const [openedOn, setOpenedOn] = React.useState<string | null>(null);
  const menuOpen = openedOn !== null && openedOn === livePathname;

  const closeMenu = React.useCallback(() => setOpenedOn(null), []);

  return (
    <>
      {/* Top bar ------------------------------------------------------- */}
      {/* `relative` so the panel anchors to this bar instead of the viewport, which
          would leave it floating over the content after a scroll. */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur lg:hidden"
        style={{ boxShadow: "inset 0 -1px 0 0 oklch(0.545 0.222 260 / 0.12)" }}>
        <div className="flex h-14 items-center gap-3 px-4">
          <Brand organizationName={organizationName} homeHref={isAdmin ? "/admin/overview" : "/dashboard"} />

          <button
            type="button"
            onClick={() => setOpenedOn(menuOpen ? null : livePathname)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            className="ml-auto grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground surface-elevated"
          >
            {menuOpen ? (
              <X className="size-5" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="19" r="1.5" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>

        {/* The panel is positioned against the bar above. */}
        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={closeMenu}
              className="fixed inset-0 top-14 z-40 cursor-default bg-foreground/20 lg:hidden"
            />
            <div
              role="menu"
              className="absolute right-4 top-[3.4rem] z-50 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 surface-elevated"
            >
              <div className="flex items-center gap-2.5 px-1 pb-3">
                <Monogram name={user.name} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{user.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {ROLE_LABEL[user.role]}
                  </p>
                </div>
              </div>
              <NavLinks items={overflow} pathname={pathname} onNavigate={closeMenu} />
              <div className="mt-3 border-t border-border pt-3">{logoutSlot}</div>
            </div>
          </>
        ) : null}
      </div>

      {/* Bottom tab bar ------------------------------------------------ */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/*
          Column count follows the item count. It was hardcoded to five, which
          squeezed an employee's three tabs into 60% of the width and left the
          right-hand 40% blank.
        */}
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}>
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-[19px]", active && "stroke-[2.25]")} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Shared by the admin roster and employee detail headers. */
export function IconLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

export { MapPin, UserCog };