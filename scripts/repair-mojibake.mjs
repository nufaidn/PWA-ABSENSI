import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";

/**
 * One-off repair for mojibake introduced by decoding UTF-8 as Windows-1252.
 *
 * The corrupted sequences and what they decode to:
 *   Â·  -> ·    (U+00C2 U+00B7   = UTF-8 C2 B7)
 *   Â±  -> ±    (U+00C2 U+00B1   = UTF-8 C2 B1)
 *   â€¦  -> …    (U+00E2 U+20AC U+00A6 = UTF-8 E2 80 A6)
 *   â€”  -> —    (U+00E2 U+20AC U+201D = UTF-8 E2 80 94)
 *   â€“  -> –    (U+00E2 U+20AC U+201C = UTF-8 E2 80 93)
 *
 * Runs as `node scripts/repair-mojibake.mjs` and is a no-op once clean.
 */

const FIXES = [
  ["Â·", "·"],
  ["Â±", "±"],
  ["â€¦", "…"],
  ["â€”", "—"],
  ["â€“", "–"],
];

const files = globSync("src/**/*.{ts,tsx}");
let touched = 0;
let replacements = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let next = original;
  for (const [bad, good] of FIXES) {
    const count = next.split(bad).length - 1;
    if (count > 0) {
      next = next.split(bad).join(good);
      replacements += count;
    }
  }
  if (next !== original) {
    writeFileSync(file, next, "utf8");
    touched += 1;
    console.log(`fixed ${file}`);
  }
}

console.log(`\n${replacements} replacement(s) across ${touched} file(s).`);