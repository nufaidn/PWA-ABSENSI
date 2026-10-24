import { beforeEach, describe, expect, it } from "vitest";
import {
  baseFixture,
  currentUser,
  db,
  seedAdmin,
  signInAs,
} from "./setup";
import { COLLECTIONS, firestore, toLeaveRequest } from "@/lib/db";
import {
  createLeaveRequest,
  getAllLeaveRequests,
  getOwnLeaveRequests,
  type CreateLeaveRequestInput,
} from "@/lib/dal/leave";
import { checkIn } from "@/lib/dal/attendance";
import { ForbiddenError } from "@/lib/dal/auth";

/**
 * Integration tests for cuti / izin / sakit.
 *
 * The product rule is deceptively small: submitting a request must mark every
 * working day as LEAVE, never overwrite a real check-in, and never double-book a
 * day. Those are exactly the guarantees that depend on Firestore, so they are
 * tested against the emulator rather than mocked.
 */

function request(
  overrides: Partial<CreateLeaveRequestInput> = {},
): CreateLeaveRequestInput {
  return {
    type: "CUTI",
    startDate: "2026-10-12", // Monday
    endDate: "2026-10-14", // Wednesday
    reason: "Acara keluarga",
    doctorNoteUrl: null,
    doctorNotePublicId: null,
    ...overrides,
  };
}

/** A real instant for a wall-clock time on 2026-10-13 (Tuesday) in WIB. */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, 13, h - 7, m, 0));
}

async function leaveDocs() {
  const snapshot = await firestore.collection(COLLECTIONS.leaveRequests).get();
  return snapshot.docs.map((doc) => toLeaveRequest(doc.id, doc.data()));
}

beforeEach(async () => {
  currentUser.role = "EMPLOYEE";
  await baseFixture();
});

describe("createLeaveRequest", () => {
  it("marks each working day in the range as LEAVE", async () => {
    const created = await createLeaveRequest(request());

    expect(created.recordedDays).toBe(3);
    expect(created.skippedDays).toBe(0);

    const snapshot = await firestore
      .collection(COLLECTIONS.attendance)
      .where("userId", "==", currentUser.id)
      .get();
    expect(snapshot.size).toBe(3);
    for (const doc of snapshot.docs) {
      expect(doc.data().status).toBe("LEAVE");
      expect(doc.data().checkInAt).toBeNull();
    }

    const own = await getOwnLeaveRequests();
    expect(own).toHaveLength(1);
    expect(own[0]?.type).toBe("CUTI");
    expect(own[0]?.reason).toBe("Acara keluarga");
  });

  it("rejects a range that contains no working day", async () => {
    await expect(
      createLeaveRequest(
        request({ startDate: "2026-10-17", endDate: "2026-10-18" }),
      ),
    ).rejects.toMatchObject({ code: "NO_WORKING_DAY" });

    expect(await leaveDocs()).toHaveLength(0);
  });

  it("refuses to double-book a day that is already leave", async () => {
    await createLeaveRequest(request());

    await expect(
      createLeaveRequest(
        request({ startDate: "2026-10-14", endDate: "2026-10-15" }),
      ),
    ).rejects.toMatchObject({ code: "OVERLAP" });

    // The transaction rolled the second request back: no orphan request doc.
    expect(await leaveDocs()).toHaveLength(1);
  });

  it("keeps a real check-in and skips that day", async () => {
    await checkIn({ now: at("08:55") });

    const created = await createLeaveRequest(request());

    expect(created.recordedDays).toBe(2);
    expect(created.skippedDays).toBe(1);

    const row = await db.attendance.findUnique({
      where: {
        userId_workDate: { userId: currentUser.id, workDate: "2026-10-13" },
      },
    });
    expect(row?.status).toBe("PRESENT");
    expect(row?.checkInAt?.toISOString()).toBe(at("08:55").toISOString());
  });

  it("rejects an administrator", async () => {
    await seedAdmin();

    await expect(createLeaveRequest(request())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("getAllLeaveRequests", () => {
  it("filters by type and search, and requires an admin", async () => {
    await createLeaveRequest(request());
    await createLeaveRequest(
      request({
        type: "SAKIT",
        startDate: "2026-10-19",
        endDate: "2026-10-19",
        reason: "Demam",
        doctorNoteUrl:
          "https://res.cloudinary.com/demo/image/upload/v1/attendance/leave/user/note.jpg",
      }),
    );

    const admin = await seedAdmin();
    signInAs(admin);

    expect(await getAllLeaveRequests()).toHaveLength(2);
    expect(await getAllLeaveRequests({ type: "CUTI" })).toHaveLength(1);
    expect(await getAllLeaveRequests({ type: "SAKIT" })).toHaveLength(1);
    expect(await getAllLeaveRequests({ search: "acara" })).toHaveLength(1);
    expect(await getAllLeaveRequests({ search: "tidak-ada" })).toHaveLength(0);

    // The employee-scoped list must not leak another user's requests, and an
    // admin has no own leave list by design.
    signInAs({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: "ADMIN",
    });
    expect(await getOwnLeaveRequests()).toHaveLength(0);
  });
});
