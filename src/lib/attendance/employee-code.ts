import type { Role } from "@/lib/domain";

/**
 * Employee code format.
 *
 * Codes are the identifier employees sign in with, so they are generated rather
 * than typed: a hand-typed code is either duplicated or skipped, and a duplicate
 * is caught by the `(userId, workDate)`-style unique constraint at the worst
 * possible moment. The prefix carries meaning — `EMP-001` and `INT-001` are the
 * same person from two different employment tracks.
 *
 * Pure functions, no I/O, so the format is unit-testable and the allocation
 * strategy lives separately in `lib/dal/employees.ts`.
 */

/** Roles that sign in through the employee form and therefore carry a code. */
export const CODED_PREFIXES = {
  EMPLOYEE: "EMP",
  INTERN: "INT",
} as const satisfies Record<string, string>;

export type CodedPrefix = (typeof CODED_PREFIXES)[keyof typeof CODED_PREFIXES];

/**
 * Number of digits after the dash. Three supports 999 per track, which is more
 * than enough for the organizations this app targets and keeps the column narrow
 * enough to scan in the employee list.
 */
export const CODE_DIGITS = 3;

export const EMPLOYEE_CODE_PATTERN = /^(EMP|INT)-\d{3}$/;

/**
 * The code prefix for a role, or null when the role does not use employee codes.
 * Admins sign in with an email address and are deliberately left uncoded.
 */
export function codePrefixForRole(role: Role): CodedPrefix | null {
  // `in` narrows nothing useful here — a Role is a plain string union and any
  // member is a valid key. Look the value up and treat a miss as "no code".
  const prefix = (CODED_PREFIXES as Record<string, CodedPrefix>)[role];
  return prefix ?? null;
}

/** Builds `EMP-001` from a prefix and a sequence number. */
export function formatEmployeeCode(prefix: CodedPrefix, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(CODE_DIGITS, "0")}`;
}

/** True for a well-formed code of a known prefix. */
export function isValidEmployeeCode(value: string): boolean {
  return EMPLOYEE_CODE_PATTERN.test(value);
}

export interface ParsedEmployeeCode {
  prefix: CodedPrefix;
  sequence: number;
}

/** Splits `EMP-042` into its parts, or null when the value is not a valid code. */
export function parseEmployeeCode(value: string): ParsedEmployeeCode | null {
  if (!isValidEmployeeCode(value)) return null;
  const [prefix, digits] = value.split("-");
  return { prefix: prefix as CodedPrefix, sequence: Number(digits) };
}

/**
 * Highest sequence already in use for a prefix, from a list of existing codes.
 *
 * Unparseable codes are ignored rather than throwing: an organisation may have
 * legacy codes from before this format existed, and they must not break
 * allocation for everyone else. Zero means no code for that prefix exists yet.
 */
export function highestSequence(codes: readonly string[], prefix: CodedPrefix): number {
  let highest = 0;
  for (const code of codes) {
    const parsed = parseEmployeeCode(code);
    if (parsed && parsed.prefix === prefix && parsed.sequence > highest) {
      highest = parsed.sequence;
    }
  }
  return highest;
}

/**
 * The sequence to try next for a prefix.
 *
 * Starts at `highest + 1` and skips values already taken. Gaps *below* the
 * highest are deliberately not refilled: reusing `EMP-013` after that employee
 * left would make an old code belong to someone new, which is far more
 * confusing in an audit trail than a permanently skipped number. The skip only
 * matters when `highest` is momentarily out of step with reality, which the
 * allocation lock already prevents.
 */
export function nextSequence(taken: ReadonlySet<number>, highest: number): number {
  let candidate = highest + 1;
  while (taken.has(candidate)) candidate += 1;
  return candidate;
}