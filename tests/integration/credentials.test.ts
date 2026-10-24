import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedSettings } from "./setup";
import {
  hashPassword,
  verifyAdminCredentials,
  verifyCredentials,
} from "@/lib/dal/employees";
import { Role } from "@/lib/domain";

/**
 * Credential verification, exercised against the real DAL and a real database.
 *
 * The employee code replaced the email as the employee-facing identifier, and
 * `/admin` gained its own sign-in path. Both rules are security-relevant: the
 * second one decides whether an ordinary employee can reach the admin area, so
 * it is asserted here rather than left to the UI.
 */

async function makeUser(overrides: {
  email: string;
  password: string;
  role: Role;
  employeeCode?: string | null;
  isActive?: boolean;
}) {
  return db.user.create({
    data: {
      email: overrides.email.toLowerCase(),
      passwordHash: await hashPassword(overrides.password),
      name: "Test User",
      role: overrides.role,
      employeeCode: overrides.employeeCode ?? null,
      isActive: overrides.isActive ?? true,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
  await seedSettings();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("employee sign-in", () => {
  it("resolves by employee code", async () => {
    await makeUser({
      email: "andi@company.test",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-001",
    });

    const user = await verifyCredentials("EMP-001", "rahasia123");
    expect(user?.email).toBe("andi@company.test");
  });

  it("resolves by email as a fallback", async () => {
    await makeUser({
      email: "andi@company.test",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-001",
    });

    const user = await verifyCredentials("andi@company.test", "rahasia123");
    expect(user?.email).toBe("andi@company.test");
  });

  it("normalises the email but not the code", async () => {
    await makeUser({
      email: "andi@company.test",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-001",
    });

    // Emails are case-insensitive; employee codes are not, because an
    // organisation may treat "emp-01" and "EMP-01" as different people.
    expect(await verifyCredentials("ANDI@Company.Test", "rahasia123")).not.toBeNull();
    expect(await verifyCredentials("EMP-001", "rahasia123")).not.toBeNull();
    expect(await verifyCredentials("emp-001", "rahasia123")).toBeNull();
  });

  it("trims surrounding whitespace on the identifier", async () => {
    await makeUser({
      email: "andi@company.test",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-001",
    });

    expect(await verifyCredentials("  EMP-001  ", "rahasia123")).not.toBeNull();
  });

  it("rejects a wrong password and an unknown identifier alike", async () => {
    await makeUser({
      email: "andi@company.test",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-001",
    });

    expect(await verifyCredentials("EMP-001", "salah")).toBeNull();
    expect(await verifyCredentials("EMP-999", "rahasia123")).toBeNull();
  });

  it("refuses a deactivated account", async () => {
    await makeUser({
      email: "andi@company.test",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-001",
      isActive: false,
    });

    expect(await verifyCredentials("EMP-001", "rahasia123")).toBeNull();
  });
});

describe("admin sign-in gate", () => {
  it("admits an admin", async () => {
    await makeUser({ email: "admin@company.test", password: "rahasia123", role: Role.ADMIN });

    expect(await verifyAdminCredentials("admin@company.test", "rahasia123")).not.toBeNull();
  });

  it("refuses an employee holding valid credentials", async () => {
    // The point of the separate form: correct credentials must still be
    // insufficient, otherwise anyone who obtains an employee's login reaches
    // the admin area.
    await makeUser({
      email: "andi@company.test",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-001",
    });

    expect(await verifyAdminCredentials("EMP-001", "rahasia123")).toBeNull();
    expect(await verifyAdminCredentials("andi@company.test", "rahasia123")).toBeNull();
  });

  it("refuses an intern holding valid credentials", async () => {
    // An intern shares EMPLOYEE's rank, so this is a distinct case worth
    // pinning: the admin gate must not be reached by role comparison alone.
    await makeUser({
      email: "magang@company.test",
      password: "rahasia123",
      role: Role.INTERN,
      employeeCode: "INT-001",
    });

    expect(await verifyCredentials("INT-001", "rahasia123")).not.toBeNull();
    expect(await verifyAdminCredentials("INT-001", "rahasia123")).toBeNull();
  });

  it("refuses an unknown identifier without throwing", async () => {
    // A bcrypt comparison against a dummy hash is what keeps the response time
    // of an unknown account equal to a wrong password; it must not throw.
    await expect(verifyAdminCredentials("tidak-ada", "apa-saja")).resolves.toBeNull();
  });
});