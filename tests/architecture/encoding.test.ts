import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against mojibake reaching the UI.
 *
 * These strings were decoded as Windows-1252 and re-encoded as UTF-8 at some
 * point in the repo's history, so Indonesian labels rendered as literal
 * "Menyimpanâ€¦" and "Rentang 150â€“300 m". Every one of those sequences is
 * valid UTF-8 that *looks* like text, so neither the compiler nor the linter
 * complains — it only shows up in the browser.
 */
const SRC = join(process.cwd(), "src");

/** Codepoints that can only appear as a result of the double-decoding. */
const CORRUPTED = /[\u00C2\u00E2]\u20AC|[\u00C2\u00E2][\u0080-\u00BF]|\uFFFD/;

describe("source text encoding", () => {
  const files = globSync(join(SRC, "**/*.ts"), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isFile()
        ? globSync(join(entry.parentPath, entry.name))
        : globSync(join(entry.parentPath, entry.name, "**/*.ts")),
    );

  const sources = files
    .map((file) => ({ file: file.replace(`${process.cwd()}\\`, ""), text: readFileSync(file, "utf8") }))
    .concat(
      globSync(join(SRC, "**/*.tsx")).map((file) => ({
        file: file.replace(`${process.cwd()}\\`, ""),
        text: readFileSync(file, "utf8"),
      })),
    );

  it("finds source files to check", () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it.each(sources.map((s) => [s.file, s.text] as const))(
    "%s contains no mojibake",
    (_file, text) => {
      expect(text).not.toMatch(CORRUPTED);
    },
  );

  it("preserves the punctuation the repairs targeted", () => {
    const reports = readFileSync(
      join(SRC, "app", "(app)", "admin", "reports", "page.tsx"),
      "utf8",
    );
    // Middle dot separators and em-dash placeholders.
    expect(reports).toContain("·");
    expect(reports).toContain("—");
    expect(reports).not.toContain("Â·");
    expect(reports).not.toContain("â€”");
  });

  it("renders an ellipsis in admin dialogs rather than a broken sequence", () => {
    const dialogs = readFileSync(join(SRC, "components", "admin", "employee-dialogs.tsx"), "utf8");
    expect(dialogs).toContain("Menyimpan…");
    expect(dialogs).not.toContain("â€¦");
  });
});