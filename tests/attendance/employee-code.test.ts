import { describe, expect, it } from "vitest";
import {
  CODE_DIGITS,
  codePrefixForRole,
  formatEmployeeCode,
  highestSequence,
  isValidEmployeeCode,
  nextSequence,
  parseEmployeeCode,
} from "@/lib/attendance/employee-code";

/**
 * The employee code is the identifier employees sign in with, so its format is
 * part of the authentication surface. These lock down the shape and, just as
 * importantly, the cases that must be *rejected* — a permissive parser here
 * would let a malformed code through to the login form.
 */

describe("codePrefixForRole", () => {
  it("gives employees and interns distinct prefixes", () => {
    expect(codePrefixForRole("EMPLOYEE")).toBe("EMP");
    expect(codePrefixForRole("INTERN")).toBe("INT");
  });

  it("leaves admin roles uncoded", () => {
    // Admins sign in with an email address; issuing a code would imply it is
    // an identifier when it is not.
    expect(codePrefixForRole("ADMIN")).toBeNull();
  });
});

describe("formatEmployeeCode", () => {
  it("zero-pads to a fixed width", () => {
    expect(formatEmployeeCode("EMP", 1)).toBe("EMP-001");
    expect(formatEmployeeCode("INT", 42)).toBe("INT-042");
    expect(formatEmployeeCode("EMP", 999)).toBe("EMP-999");
  });

  it("keeps three digits", () => {
    expect(CODE_DIGITS).toBe(3);
  });
});

describe("isValidEmployeeCode", () => {
  it("accepts well-formed codes", () => {
    expect(isValidEmployeeCode("EMP-001")).toBe(true);
    expect(isValidEmployeeCode("INT-123")).toBe(true);
  });

  it("rejects the wrong prefix, width or shape", () => {
    expect(isValidEmployeeCode("MAG-001")).toBe(false);
    expect(isValidEmployeeCode("EMP-01")).toBe(false);
    expect(isValidEmployeeCode("EMP-0001")).toBe(false);
    expect(isValidEmployeeCode("EMP001")).toBe(false);
    expect(isValidEmployeeCode("EMP-")).toBe(false);
    expect(isValidEmployeeCode("emp-001")).toBe(false);
    expect(isValidEmployeeCode("")).toBe(false);
  });
});

describe("parseEmployeeCode", () => {
  it("splits a valid code into prefix and sequence", () => {
    expect(parseEmployeeCode("EMP-007")).toEqual({ prefix: "EMP", sequence: 7 });
  });

  it("returns null rather than a partial result for invalid input", () => {
    expect(parseEmployeeCode("MAG-001")).toBeNull();
    expect(parseEmployeeCode("EMP-1")).toBeNull();
  });
});

describe("highestSequence", () => {
  it("finds the largest code in use for a prefix", () => {
    expect(highestSequence(["EMP-001", "EMP-012", "EMP-003"], "EMP")).toBe(12);
  });

  it("ignores codes from the other track", () => {
    // The whole reason for a prefix: EMP and INT number independently.
    expect(highestSequence(["INT-099"], "EMP")).toBe(0);
    expect(highestSequence(["EMP-005", "INT-099"], "INT")).toBe(99);
  });

  it("ignores unparseable codes instead of throwing", () => {
    // Legacy codes from before this format existed must not break allocation
    // for everyone else.
    expect(highestSequence(["LAMA-1", "EMP-004", ""], "EMP")).toBe(4);
    expect(highestSequence(["LAMA-1"], "EMP")).toBe(0);
  });

  it("returns zero when nothing is allocated yet", () => {
    expect(highestSequence([], "EMP")).toBe(0);
  });
});

describe("nextSequence", () => {
  it("continues from the highest", () => {
    expect(nextSequence(new Set(), 12)).toBe(13);
  });

  it("skips a value that is already taken", () => {
    // `nextSequence` never returns a number that `taken` already contains.
    expect(nextSequence(new Set([1, 2, 3]), 2)).toBe(4);
    expect(nextSequence(new Set([2, 3]), 3)).toBe(4);
    expect(nextSequence(new Set(), 0)).toBe(1);
  });

  it("does not refill a gap below the highest", () => {
    // Deliberate: handing EMP-013 to a new person after that employee left
    // would make an old code belong to someone new, which is much harder to
    // follow in an audit trail than a permanently skipped number.
    expect(nextSequence(new Set([1, 3]), 3)).toBe(4);
  });
});