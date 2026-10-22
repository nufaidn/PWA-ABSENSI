import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDatabase,
  seedSchedule,
  seedSettings,
  seedUser,
} from "./setup";
import { deleteSchedule } from "@/lib/dal/employees";
import { COLLECTIONS, SETTINGS_DOC_ID, firestore } from "@/lib/db";

/**
 * Deleting a work schedule.
 *
 * Refusing to delete a schedule that employees are still on left the
 * administrator stuck: the schedule they wanted to replace could not be removed
 * without reassigning every employee by hand first. Deletion now moves those
 * employees back to the organization default, and a deleted default is
 * replaced by another active schedule so nobody silently falls back to the
 * hardcoded hours.
 */

beforeEach(async () => {
  await resetDatabase();
});

describe("deleteSchedule", () => {
  it("moves employees to the default instead of refusing the deletion", async () => {
    const schedule = await seedSchedule({ isDefault: true });
    const replacement = await seedSchedule({ isDefault: false });
    await seedSettings({ defaultScheduleId: schedule.id });
    const user = await seedUser({ scheduleId: schedule.id });

    const result = await deleteSchedule(schedule.id);

    expect(result.movedUsers).toBe(1);

    const userSnapshot = await firestore.collection(COLLECTIONS.users).doc(user.id).get();
    expect(userSnapshot.data()?.scheduleId).toBeNull();

    // The deleted schedule was the default, so another active one takes over.
    const replacementSnapshot = await firestore
      .collection(COLLECTIONS.schedules)
      .doc(replacement.id)
      .get();
    expect(replacementSnapshot.data()?.isOrganizationDefault).toBe(true);

    const settings = await firestore
      .collection(COLLECTIONS.settings)
      .doc(SETTINGS_DOC_ID)
      .get();
    expect(settings.data()?.defaultScheduleId).toBe(replacement.id);
  });

  it("keeps the organization default when another schedule is deleted", async () => {
    const schedule = await seedSchedule({ isDefault: true });
    const other = await seedSchedule({ isDefault: false });
    await seedSettings({ defaultScheduleId: schedule.id });

    const result = await deleteSchedule(other.id);

    expect(result.movedUsers).toBe(0);
    expect(result.newDefaultName).toBeNull();

    const settings = await firestore
      .collection(COLLECTIONS.settings)
      .doc(SETTINGS_DOC_ID)
      .get();
    expect(settings.data()?.defaultScheduleId).toBe(schedule.id);
  });

  it("keeps the attendance history of the employees it moves", async () => {
    const schedule = await seedSchedule({ isDefault: true });
    await seedSettings({ defaultScheduleId: schedule.id });
    const user = await seedUser({ scheduleId: schedule.id });

    await firestore.collection(COLLECTIONS.attendance).doc(`${user.id}_2026-10-13`).set({
      userId: user.id,
      workDate: "2026-10-13",
      status: "PRESENT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await deleteSchedule(schedule.id);

    const history = await firestore
      .collection(COLLECTIONS.attendance)
      .doc(`${user.id}_2026-10-13`)
      .get();
    expect(history.exists).toBe(true);
  });
});
