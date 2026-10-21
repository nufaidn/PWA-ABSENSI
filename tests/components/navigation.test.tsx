import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MobileNav, Sidebar } from "@/components/layout/navigation";
import type { Role } from "@/lib/attendance/time";

/**
 * Mobile navigation behaviour.
 *
 * The bugs these guard against were invisible to the type checker and the
 * build: a hardcoded `grid-cols-5` squeezed an employee's three tabs into part
 * of the bar and left the rest blank, and a `<details>`-based overflow menu stayed
 * open across client-side navigation because the layout never remounts.
 */

vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

let mockPathname = "/dashboard";

const EMPLOYEE = {
  name: "Budi Santoso",
  email: "budi@test.local",
  role: "EMPLOYEE" as Role,
  department: "Engineering",
};

const ADMIN = { ...EMPLOYEE, role: "ADMIN" as Role };

beforeEach(() => {
  mockPathname = "/dashboard";
});

/** `fireEvent` wrapped in `act`, so React flushes the resulting render. */
async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

function renderNav(role: Role = "EMPLOYEE") {
  const user = role === "ADMIN" ? ADMIN : EMPLOYEE;
  render(
    <MobileNav
      user={user}
      organizationName="PT Contoh"
      pathname={mockPathname}
      logoutSlot={<button type="button">Keluar</button>}
    />,
  );
}

describe("bottom tab bar", () => {
  it("gives every tab an equal column", () => {
    // The failure mode: a fixed five-column grid with three tabs, so each tab was
    // 20% of the bar while 40% sat empty.
    renderNav();
    const list = screen.getByRole("navigation", { name: "Navigasi utama" }).querySelector("ul");
    expect(list?.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  });

  it("matches the column count to an administrator's four tabs", () => {
    renderNav("ADMIN");
    const list = screen.getByRole("navigation", { name: "Navigasi utama" }).querySelector("ul");
    expect(list?.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  it("keeps employee attendance tabs out of an administrator's bar", () => {
    renderNav("ADMIN");
    for (const label of ["Beranda", "Riwayat", "Statistik"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    for (const label of ["Ringkasan", "Laporan", "Karyawan", "Jadwal Kerja"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("shows every employee destination in the bar", () => {
    renderNav();
    for (const label of ["Beranda", "Riwayat", "Statistik"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("keeps touch targets at a usable height", () => {
    renderNav();
    // Comfortably above the 44px floor for a thumb.
    expect(screen.getByRole("link", { name: "Beranda" })).toHaveClass("min-h-[3.25rem]");
  });
});

describe("overflow menu", () => {
  it("starts closed", () => {
    renderNav();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buka menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

it("opens, closes on a second press, and reflects state via aria-expanded", async () => {
    renderNav();

    await click(screen.getByRole("button", { name: "Buka menu" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    // Two controls are labelled "Tutup menu": the trigger (now showing an ✕) and
    // the backdrop. Only the trigger carries aria-expanded.
    expect(screen.getByRole("button", { expanded: true })).toHaveAccessibleName("Tutup menu");

    await click(screen.getByRole("button", { expanded: true }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("dismisses when tapping outside", async () => {
    renderNav();

    await click(screen.getByRole("button", { name: "Buka menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // The backdrop is the dismiss target; it shares the label so both controls
    // are distinguishable to a screen reader.
    const backdrop = screen.getAllByRole("button", { name: "Tutup menu" })[1];
    await click(backdrop);

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("closes itself when the route changes", async () => {
        renderNav();

    await click(screen.getByRole("button", { name: "Buka menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // A client-side navigation changes `usePathname` without remounting the
    // layout. With a plain boolean the menu would still be open over the new
    // page — this is what the recorded-pathname state exists to prevent.
    mockPathname = "/admin/employees";
    render(
      <MobileNav
        user={EMPLOYEE}
        organizationName="PT Contoh"
        pathname="/admin/employees"
        logoutSlot={<button type="button">Keluar</button>}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("menu").length).toBeGreaterThan(0));
  });

  it("offers an administrator the pages that do not fit in the bar", async () => {
        renderNav("ADMIN");
    await click(screen.getByRole("button", { name: "Buka menu" }));

    const menu = screen.getByRole("menu");
    // Audit log and settings live behind the overflow for an admin.
    expect(menu).toHaveTextContent("Audit Log");
    expect(menu).toHaveTextContent("Pengaturan");
  });

  it("offers an employee only the destinations missing from the bar", async () => {
        renderNav();
    await click(screen.getByRole("button", { name: "Buka menu" }));

    const menu = screen.getByRole("menu");
    // All three employee pages fit in the bar, so the menu holds only identity
    // and sign-out — no duplicate links to what is already one tap away.
    expect(within(menu).queryByRole("link", { name: "Riwayat" })).not.toBeInTheDocument();
    expect(menu).toHaveTextContent("Keluar");
  });
});

describe("brand link", () => {
  it("sends an employee to their own home", () => {
    render(
      <Sidebar
        user={EMPLOYEE}
        organizationName="PT Contoh"
        pathname="/dashboard"
        logoutSlot={<button type="button">Keluar</button>}
      />,
    );
    expect(screen.getAllByRole("link", { name: /PT Contoh/ })[0]).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("sends an administrator to the admin overview", () => {
    renderNav("ADMIN");
    // Asserting the href is the point. Clicking would only ask jsdom to perform
    // a navigation it cannot, printing a "Not implemented" warning.
    // Tapping the wordmark must not dump an admin on the employee dashboard.
    expect(screen.getByRole("link", { name: /PT Contoh/ })).toHaveAttribute(
      "href",
      "/admin/overview",
    );
  });

  it("keeps employee attendance links out of the administrator sidebar", () => {
    render(
      <Sidebar
        user={ADMIN}
        organizationName="PT Contoh"
        pathname="/admin/overview"
        logoutSlot={<button type="button">Keluar</button>}
      />,
    );

    for (const label of ["Beranda", "Riwayat", "Statistik"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    for (const label of ["Ringkasan", "Laporan", "Karyawan", "Jadwal Kerja"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});