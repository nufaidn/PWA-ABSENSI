import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards against horizontal overflow on small screens.
 *
 * Reported as "the page is cut off on the right". The cause was structural rather
 * than a styling slip: `MobileNav` was a sibling of the content column inside a
 * plain `flex` *row*, so its top bar consumed part of the viewport width and left
 * every page rendered in what remained. Nothing in the type checker or the build
 * can see that — the DOM is valid, it is just laid out sideways.
 *
 * These assertions read the shell's own source rather than re-deriving the layout
 * from class names, so the check stays honest about *structure*: the mobile
 * navigation must be a child of the content column, and the shell must stack on
 * mobile.
 */

const APP_SHELL = readFileSync(
  join(process.cwd(), "src", "components", "layout", "app-shell.tsx"),
  "utf8",
);

describe("app shell layout", () => {
  it("stacks on mobile and only becomes a row on wide screens", () => {
    // `flex-col` below `lg` is what keeps the top bar above the content instead
    // of beside it.
    expect(APP_SHELL).toMatch(/flex min-h-dvh flex-col[^"]*lg:flex-row/);
  });

  it("renders the mobile navigation inside the content column", () => {
    // The regression itself: `<MobileNav>` appearing after the column's closing
    // tag places it in the outer flex row.
    const column = APP_SHELL.indexOf("flex min-w-0 flex-1 flex-col");
    const nav = APP_SHELL.indexOf("<MobileNav");
    expect(column).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(column);

    // …and before that column is closed.
    const closeAfterColumn = APP_SHELL.indexOf("</div>", column);
    expect(nav).toBeLessThan(closeAfterColumn);
  });

  it("keeps the desktop sidebar outside the content column", () => {
    const sidebar = APP_SHELL.indexOf("<Sidebar");
    const column = APP_SHELL.indexOf("flex min-w-0 flex-1 flex-col");
    expect(sidebar).toBeLessThan(column);
  });

  it("leaves room for the fixed bottom bar without clipping content", () => {
    // The column pads its bottom by the height of the tab bar plus the home
    // indicator, so the last card is never trapped underneath it.
    expect(APP_SHELL).toMatch(/pb-\[calc\(4\.25rem\+env\(safe-area-inset-bottom\)\)\]/);
  });
});

describe("bottom tab bar", () => {
  const NAV = readFileSync(
    join(process.cwd(), "src", "components", "layout", "navigation.tsx"),
    "utf8",
  );

  it("is fixed, so its position in the DOM cannot affect layout", () => {
    expect(NAV).toMatch(/aria-label="Navigasi utama"[\s\S]{0,220}fixed inset-x-0 bottom-0/);
  });

  it("sizes its columns from the item count", () => {
    // A hardcoded `grid-cols-5` left 40% of an employee's bar blank.
    expect(NAV).not.toMatch(/grid-cols-5/);
    expect(NAV).toMatch(/gridTemplateColumns: `repeat\(\$\{primary\.length\}/);
  });
});