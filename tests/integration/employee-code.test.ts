import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedAdmin } from "./setup";
import { allocateEmployeeCode, createEmployee } from "@/lib/dal/employees";
import { Role } from "@/generated/prisma/enums";

/**
 * Code allocation against a real database.
 *
 * Correctness depends on the advisory lock and the unique index, neither of
 * which exists in the pure module. Two administrators saving at the same moment
 * is the case that makes this interesting: without a lock held across the insert,
 * both compute the same number and one of them fails with an error nobody can
 * act on.
 */

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin();
});

afterAll(async () => {
  await db.$disconnect();
});

async function addUser(employeeCode: string | null, role: Role = Role.EMPLOYEE) {
  return db.user.create({
    data: {
      email: `${employeeCode ?? crypto.randomUUID()}@test.local`,
      passwordHash: "x",
      name: "Test",
      role,
      employeeCode,
    },
  });
}

describe("allocateEmployeeCode", () => {
  it("starts a track at 001", async () => {
    expect(await allocateEmployeeCode(Role.EMPLOYEE)).toBe("EMP-001");
  });

  it("continues after the highest existing code", async () => {
    await addUser("EMP-001");
    await addUser("EMP-002");
    expect(await allocateEmployeeCode(Role.EMPLOYEE)).toBe("EMP-003");
  });

  it("numbers each track independently", async () => {
    await addUser("EMP-001");
    await addUser("INT-001");
    await addUser("INT-002");

    expect(await allocateEmployeeCode(Role.EMPLOYEE)).toBe("EMP-002");
    expect(await allocateEmployeeCode(Role.INTERN)).toBe("INT-003");
  });

  it("returns null for a role that does not use codes", async () => {
    expect(await allocateEmployeeCode(Role.ADMIN)).toBeNull();
    expect(await allocateEmployeeCode(Role.SUPER_ADMIN)).toBeNull();
  });

  it("ignores legacy codes outside the format", async () => {
    // An organisation may have codes from before this scheme. They must not stop
    // allocation, and must not be read as sequence numbers.
    await addUser("LAMA-99");
    expect(await allocateEmployeeCode(Role.EMPLOYEE)).toBe("EMP-001");
  });

  it("does not reuse a number belonging to another track", async () => {
    await addUser("INT-005");
    expect(await allocateEmployeeCode(Role.EMPLOYEE)).toBe("EMP-001");
  });

  it("is a preview, not a reservation", async () => {
    // Two reads with nothing created between them legitimately agree — this only
    // looks. It is why `createEmployee` cannot depend on it.
    expect(await allocateEmployeeCode(Role.EMPLOYEE)).toBe("EMP-001");
    expect(await allocateEmployeeCode(Role.EMPLOYEE)).toBe("EMP-001");
  });
});

describe("createEmployee code assignment", () => {
  it("assigns the next free code when none is supplied", async () => {
    const created = await createEmployee({
      name: "Andi",
      email: "andi@test.local",
      password: "rahasia123",
      role: Role.EMPLOYEE,
    });
    expect(created.employeeCode).toBe("EMP-001");
  });

  it("keeps numbering after an existing employee", async () => {
    await addUser("EMP-001");
    const created = await createEmployee({
      name: "Budi",
      email: "budi@test.local",
      password: "rahasia123",
      role: Role.EMPLOYEE,
    });
    expect(created.employeeCode).toBe("EMP-002");
  });

  it("uses the intern prefix for an intern", async () => {
    const created = await createEmployee({
      name: "Putri",
      email: "putri@test.local",
      password: "rahasia123",
      role: Role.INTERN,
    });
    expect(created.employeeCode).toBe("INT-001");
  });

  it("gives an admin no code", async () => {
    const created = await createEmployee({
      name: "Admin",
      email: "admin2@test.local",
      password: "rahasia123",
      role: Role.ADMIN,
    });
    expect(created.employeeCode).toBeNull();
  });

  it("respects a code the admin typed", async () => {
    const created = await createEmployee({
      name: "Andi",
      email: "andi@test.local",
      password: "rahasia123",
      role: Role.EMPLOYEE,
      employeeCode: "EMP-042",
    });
    expect(created.employeeCode).toBe("EMP-042");
  });

  it("rejects a duplicate code rather than silently renumbering", async () => {
    await addUser("EMP-007");
    await expect(
      createEmployee({
        name: "Budi",
        email: "budi@test.local",
        password: "rahasia123",
        role: Role.EMPLOYEE,
        employeeCode: "EMP-007",
      }),
    ).rejects.toThrow(/kode karyawan sudah digunakan/i);
  });

  it("gives concurrent creates distinct codes", async () => {
    // The guarantee that matters. All four run at once; without the advisory lock
    // held across the insert they would all read EMP-001 and three would fail on
    // the unique index with a message the administrator cannot act on.
    const created = await Promise.all(
      ["a", "b", "c", "d"].map((tag) =>
        createEmployee({
          name: `Karyawan ${tag}`,
          email: `${tag}@test.local`,
          password: "rahasia123",
          role: Role.EMPLOYEE,
        }),
      ),
    );

    const codes = created.map((user) => user.employeeCode);
    expect(new Set(codes).size).toBe(4);
    expect(codes.sort()).toEqual(["EMP-001", "EMP-002", "EMP-003", "EMP-004"]);
  });

  it("does not let an intern allocation block an employee one", async () => {
    const [intern, employee] = await Promise.all([
      createEmployee({
        name: "Putri",
        email: "putri@test.local",
        password: "rahasia123",
        role: Role.INTERN,
      }),
      createEmployee({
        name: "Andi",
        email: "andi@test.local",
        password: "rahasia123",
        role: Role.EMPLOYEE,
      }),
    ]);

    expect(intern.employeeCode).toBe("INT-001");
    expect(employee.employeeCode).toBe("EMP-001");
  });
});