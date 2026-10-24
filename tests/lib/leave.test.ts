import { describe, expect, it } from "vitest";
import { leaveRequestSchema } from "@/lib/validation/schemas";
import { countLeaveDays, formatLeaveRange } from "@/lib/leave";

function parse(overrides: Record<string, unknown> = {}) {
  return leaveRequestSchema.safeParse({
    type: "CUTI",
    startDate: "2026-10-24",
    endDate: "2026-10-26",
    reason: "Acara keluarga",
    doctorNoteUrl: undefined,
    doctorNotePublicId: undefined,
    ...overrides,
  });
}

describe("leaveRequestSchema", () => {
  it("accepts a cuti request without an extra document", () => {
    const result = parse();
    expect(result.success).toBe(true);
  });

  it("requires a meaningful reason for izin", () => {
    const missing = parse({ type: "IZIN", reason: "" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.path).toEqual(["reason"]);
    }

    const tooShort = parse({ type: "IZIN", reason: "sakit" });
    expect(tooShort.success).toBe(false);

    const valid = parse({
      type: "IZIN",
      reason: "Mengurus dokumen kependudukan di kelurahan.",
    });
    expect(valid.success).toBe(true);
  });

  it("requires a Cloudinary URL for sakit", () => {
    const missing = parse({ type: "SAKIT" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.path).toEqual(["doctorNoteUrl"]);
    }

    const valid = parse({
      type: "SAKIT",
      doctorNoteUrl: "https://res.cloudinary.com/demo/image/upload/v1/note.jpg",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = parse({ startDate: "2026-10-26", endDate: "2026-10-24" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });

  it("caps one request at 31 calendar days", () => {
    // 2026-10-01 through 2026-10-31 is exactly 31 days.
    expect(parse({ startDate: "2026-10-01", endDate: "2026-10-31" }).success).toBe(true);
    expect(parse({ startDate: "2026-10-01", endDate: "2026-11-01" }).success).toBe(false);
  });

  it("normalises blank optional fields to null", () => {
    const result = parse({ reason: "   ", doctorNotePublicId: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBeNull();
      expect(result.data.doctorNotePublicId).toBeNull();
    }
  });
});

describe("leave presentation helpers", () => {
  it("counts inclusive calendar days", () => {
    expect(countLeaveDays("2026-10-24", "2026-10-24")).toBe(1);
    expect(countLeaveDays("2026-10-24", "2026-10-26")).toBe(3);
    expect(countLeaveDays("2026-10-26", "2026-10-24")).toBe(0);
  });

  it("formats a single day and a range", () => {
    expect(formatLeaveRange("2026-10-24", "2026-10-24")).toBe("24 Okt 2026");
    expect(formatLeaveRange("2026-10-24", "2026-10-26")).toBe(
      "24 Okt 2026 – 26 Okt 2026",
    );
  });
});
