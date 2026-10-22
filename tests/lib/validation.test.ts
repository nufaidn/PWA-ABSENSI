import { describe, expect, it } from "vitest";
import {
  adminLoginSchema,
  checkInSchema,
  createEmployeeSchema,
  fieldErrors,
  loginSchema,
  locationSchema,
  paginationSchema,
  parseBoolean,
  reportFilterSchema,
  scheduleSchema,
  settingsSchema,
} from "@/lib/validation/schemas";

describe("loginSchema", () => {
  it("accepts an employee code", () => {
    expect(loginSchema.safeParse({ identifier: "EMP-001", password: "rahasia123" }).success).toBe(true);
  });

  it("accepts an email, since the field is a fallback", () => {
    expect(loginSchema.safeParse({ identifier: "andi@example.com", password: "x" }).success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(loginSchema.parse({ identifier: "  EMP-001  ", password: "x" }).identifier).toBe(
      "EMP-001",
    );
  });

  it("does not require the shape of an email", () => {
    // An employee code is not an email; rejecting it here would make the field a
    // lie about what it accepts.
    expect(loginSchema.safeParse({ identifier: "0012/AB", password: "x" }).success).toBe(true);
  });

  it("rejects an empty identifier and an empty password", () => {
    expect(loginSchema.safeParse({ identifier: "   ", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "EMP-001", password: "" }).success).toBe(false);
  });

  it("rejects an over-long identifier", () => {
    expect(loginSchema.safeParse({ identifier: "x".repeat(200), password: "x" }).success).toBe(false);
  });
});

describe("adminLoginSchema", () => {
  it("has the same credential rules as the employee form", () => {
    expect(adminLoginSchema.safeParse({ identifier: "admin@gmail.com", password: "x" }).success).toBe(true);
    expect(adminLoginSchema.safeParse({ identifier: "", password: "x" }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ identifier: "admin@gmail.com", password: "" }).success).toBe(false);
  });
});

describe("createEmployeeSchema", () => {
  const valid = {
    name: "Andi",
    email: "andi@example.com",
    password: "rahasia123",
    employeeCode: "EMP-001",
  };

  it("defaults the role to EMPLOYEE", () => {
    expect(createEmployeeSchema.parse(valid).role).toBe("EMPLOYEE");
  });

  it("requires an employee code for an EMPLOYEE", () => {
    // The code is what employees sign in with, so an account without one would
    // have no way to reach the login form.
    const result = createEmployeeSchema.safeParse({ ...valid, employeeCode: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).employeeCode).toContain("wajib diisi");
    }
  });

  it("requires an employee code for an INTERN too", () => {
    // An intern signs in through the same employee form, so the same rule
    // applies. Getting this wrong would create an account that cannot log in.
    const result = createEmployeeSchema.safeParse({
      ...valid,
      employeeCode: "",
      role: "INTERN",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).employeeCode).toContain("wajib diisi");
    }
  });

  it("accepts the INTERN role with a code", () => {
    const result = createEmployeeSchema.parse({ ...valid, role: "INTERN" });
    expect(result.role).toBe("INTERN");
  });

  it("allows a missing code for an admin", () => {
    const result = createEmployeeSchema.safeParse({
      ...valid,
      employeeCode: "",
      role: "ADMIN",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.employeeCode).toBeNull();
  });

  it("turns blank optional fields into null rather than empty strings", () => {
    const result = createEmployeeSchema.parse({ ...valid, department: "" });
    expect(result.department).toBeNull();
  });

  it("still nulls a blank employee code when the role permits one", () => {
    const result = createEmployeeSchema.parse({ ...valid, employeeCode: "  ", role: "ADMIN" });
    expect(result.employeeCode).toBeNull();
  });

  it("enforces the name length bounds", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...valid, name: "x".repeat(81) }).success).toBe(false);
  });

  it("requires a password with both letters and digits", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, password: "abcdefgh" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...valid, password: "12345678" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...valid, password: "abcdefg1" }).success).toBe(true);
  });

  it("rejects an unknown role", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, role: "ROOT" }).success).toBe(false);
  });
});

describe("scheduleSchema", () => {
  const valid = {
    name: "Kantor",
    startTime: "09:00",
    endTime: "17:00",
    lateToleranceMinutes: 10,
    breakMinutes: 60,
    workingDays: [1, 2, 3, 4, 5],
  };

  it("coerces numeric fields from FormData strings", () => {
    const result = scheduleSchema.parse({ ...valid, lateToleranceMinutes: "15", breakMinutes: "45" });
    expect(result.lateToleranceMinutes).toBe(15);
    expect(result.breakMinutes).toBe(45);
  });

  it("defaults isActive and makeDefault", () => {
    const result = scheduleSchema.parse(valid);
    expect(result.isActive).toBe(true);
    expect(result.makeDefault).toBe(false);
  });

  it("coerces the working days coming from the form", () => {
    const result = scheduleSchema.parse({ ...valid, workingDays: ["1", "2", "6"] });
    expect(result.workingDays).toEqual([1, 2, 6]);
  });

  it("sorts and deduplicates the working days", () => {
    const result = scheduleSchema.parse({ ...valid, workingDays: [6, 1, 6, 3] });
    expect(result.workingDays).toEqual([1, 3, 6]);
  });

  it("rejects a schedule without a single working day", () => {
    const result = scheduleSchema.safeParse({ ...valid, workingDays: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["workingDays"]);
  });

  it("keeps the note and turns an empty one into null", () => {
    const result = scheduleSchema.parse({
      ...valid,
      description: "  Khusus hari Sabtu, jam kerja 08:00-14:00.  ",
    });
    expect(result.description).toBe("Khusus hari Sabtu, jam kerja 08:00-14:00.");
    expect(scheduleSchema.parse({ ...valid, description: "" }).description).toBeNull();
    expect(scheduleSchema.parse(valid).description).toBeNull();
  });

  it("rejects a note that is too long", () => {
    expect(scheduleSchema.safeParse({ ...valid, description: "x".repeat(241) }).success).toBe(false);
  });

  it("rejects a day outside the week", () => {
    expect(scheduleSchema.safeParse({ ...valid, workingDays: [1, 7] }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...valid, workingDays: [-1] }).success).toBe(false);
  });

  it("rejects identical start and end times", () => {
    const result = scheduleSchema.safeParse({ ...valid, endTime: "09:00" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["endTime"]);
  });

  it("rejects an end time before the start time", () => {
    expect(scheduleSchema.safeParse({ ...valid, endTime: "08:00" }).success).toBe(false);
  });

  it("rejects a malformed time string", () => {
    expect(scheduleSchema.safeParse({ ...valid, startTime: "9:00" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...valid, startTime: "24:00" }).success).toBe(false);
  });

  it("bounds the tolerance and break lengths", () => {
    expect(scheduleSchema.safeParse({ ...valid, lateToleranceMinutes: 241 }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...valid, breakMinutes: -1 }).success).toBe(false);
  });
});

describe("checkInSchema", () => {
  it("accepts a real coordinate pair", () => {
    expect(checkInSchema.safeParse({ latitude: -6.2, longitude: 106.8 }).success).toBe(true);
  });

  it("accepts null, meaning the employee declined to share location", () => {
    expect(checkInSchema.safeParse({ latitude: null, longitude: null }).success).toBe(true);
  });

  it("rejects out-of-range coordinates", () => {
    expect(checkInSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false);
    expect(checkInSchema.safeParse({ latitude: 0, longitude: 181 }).success).toBe(false);
  });

  it("rejects a missing coordinate entirely", () => {
    expect(checkInSchema.safeParse({}).success).toBe(false);
  });
});

describe("reportFilterSchema", () => {
  it("accepts a valid range and defaults status to ALL", () => {
    const result = reportFilterSchema.parse({ from: "2026-10-01", to: "2026-10-13" });
    expect(result.status).toBe("ALL");
    expect(result.department).toBeNull();
  });

  it("accepts the ALL sentinel alongside real statuses", () => {
    expect(reportFilterSchema.safeParse({ from: "2026-10-01", to: "2026-10-13", status: "ALL" }).success).toBe(true);
    expect(reportFilterSchema.safeParse({ from: "2026-10-01", to: "2026-10-13", status: "LATE" }).success).toBe(true);
    expect(reportFilterSchema.safeParse({ from: "2026-10-01", to: "2026-10-13", status: "NOPE" }).success).toBe(false);
  });

  it("rejects a malformed date key", () => {
    expect(reportFilterSchema.safeParse({ from: "01-10-2026", to: "2026-10-13" }).success).toBe(false);
    expect(reportFilterSchema.safeParse({ from: "2026-13-01", to: "2026-10-13" }).success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("coerces query strings and applies defaults", () => {
    const result = paginationSchema.parse({ page: "3", pageSize: "50" });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it("defaults to the first page of twenty", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("keeps the page size within bounds", () => {
    expect(paginationSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: "1" }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});

describe("locationSchema", () => {
  it("coerces coordinates and radius from strings", () => {
    const result = locationSchema.parse({
      name: "Kantor Pusat",
      latitude: "-6.2088",
      longitude: "106.8456",
      radiusMeters: "200",
    });
    expect(result.latitude).toBeCloseTo(-6.2088);
    expect(result.radiusMeters).toBe(200);
    expect(result.isActive).toBe(true);
  });

  it("enforces a minimum and maximum radius", () => {
    const base = { name: "Kantor", latitude: 0, longitude: 0 };
    expect(locationSchema.safeParse({ ...base, radiusMeters: 10 }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, radiusMeters: 20_000 }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  it("accepts a valid IANA timezone", () => {
    const result = settingsSchema.parse({ organizationName: "PT Contoh", timezone: "Asia/Jakarta" });
    expect(result.requireLocationValidation).toBe(false);
    expect(result.defaultScheduleId).toBeNull();
  });

  it("rejects an invalid timezone", () => {
    const result = settingsSchema.safeParse({ organizationName: "PT Contoh", timezone: "Jakarta" });
    expect(result.success).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("maps each failing field to its first message", () => {
    const result = createEmployeeSchema.safeParse({ name: "A", email: "bukan-email", password: "x" });
    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = fieldErrors(result.error);
    expect(errors.name).toContain("minimal 2 karakter");
    expect(errors.email).toContain("Format email");
    expect(errors.password).toBeDefined();
  });

  it("falls back to a form key for errors with no path", () => {
    const errors = fieldErrors({
      issues: [{ path: [], message: "Gagal." }],
    } as never);
    expect(errors.form).toBe("Gagal.");
  });
});

describe("parseBoolean", () => {
  it("accepts the truthy spellings a checkbox or FormData produces", () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("on")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
  });

  it("treats everything else as false, including the unchecked checkbox", () => {
    expect(parseBoolean(false)).toBe(false);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean(undefined)).toBe(false);
    expect(parseBoolean("")).toBe(false);
  });
});