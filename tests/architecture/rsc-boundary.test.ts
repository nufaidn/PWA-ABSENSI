import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture guards for the Server/Client Component boundary.
 *
 * These are the failure modes that `next build` cannot catch on this app: every
 * page that renders an icon is a dynamic route, so the boundary is only crossed
 * at request time and a regression would ship undetected behind a green build.
 */

const SRC = join(process.cwd(), "src");

function read(relativePath: string): string {
  return readFileSync(join(SRC, relativePath), "utf8");
}

/** The `"use client"` directive, if the module declares one. */
function hasUseClient(source: string): boolean {
  return /^\s*["']use client["'];?/m.test(source);
}

describe("shared layout primitives", () => {
  const source = read(join("components", "layout", "primitives.tsx"));

  it("is not a Client Component", () => {
    // `Stat` and `EmptyState` take an `icon` component prop. If this file were
    // a Client Component, every page rendering `<Stat icon={UserCheck} />`
    // would pass a component across the RSC boundary and React would throw
    // "Only plain objects can be passed to Client Components from Server
    // Components" at request time — while the build stays green.
    expect(hasUseClient(source)).toBe(false);
  });

  it("accepts a component as the icon prop", () => {
    // The reason it must stay server-renderable.
    expect(source).toMatch(/icon\?:\s*React\.ComponentType/);
  });

  it("holds no state, so it has no reason to be a Client Component", () => {
    expect(source).not.toMatch(/useState|useEffect|useRef|useCallback|useMemo/);
  });
});

describe("server pages", () => {
  const pages = [
    join("app", "(app)", "admin", "overview", "page.tsx"),
    join("app", "(app)", "attendance", "page.tsx"),
    join("app", "(app)", "dashboard", "page.tsx"),
    join("app", "(app)", "statistics", "page.tsx"),
    join("app", "(app)", "admin", "reports", "page.tsx"),
  ];

  it("does not declare itself a Client Component", () => {
    for (const page of pages) {
      expect(hasUseClient(read(page))).toBe(false);
    }
  });

  it.each(pages.filter((page) => !page.endsWith("dashboard\\page.tsx")))(
    "%s passes an icon to a shared primitive",
    (page) => {
      // These are the call sites from the reported stack trace. If `Stat` ever
      // regains its "use client" directive, these regress to a runtime throw.
      expect(read(page)).toMatch(/icon=\{[A-Z]/);
    },
  );

  it("keeps the dashboard free of component props", () => {
    // The dashboard renders only `AttendanceCard`, which takes plain data. It
    // deliberately has no `icon={...}` call site any more, so it cannot trip the
    // boundary bug even if `Stat` changes.
    const dashboard = read(join("app", "(app)", "dashboard", "page.tsx"));
    expect(dashboard).not.toMatch(/icon=\{[A-Z]/);
    expect(dashboard).toContain("<AttendanceCard");
  });
});

describe("Client Components", () => {
  it("do not receive component props from Server Components", () => {
    // `StatusBadge` and `ProgressMeter` are Client Components rendered by every
    // page. They must stay on plain-data props only, since anything else cannot
    // cross the boundary.
    const badges = read(join("components", "layout", "badges.tsx"));
    expect(badges).not.toMatch(/React\.ComponentType|React\.ElementType/);
  });
});