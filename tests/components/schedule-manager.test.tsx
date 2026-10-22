import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ScheduleDialog,
  ScheduleList,
  type ScheduleFormValues,
} from "@/components/admin/schedule-manager";

/**
 * The working days a schedule applies to.
 *
 * The chips are the only place where an admin says "this shift runs Monday to
 * Friday" or "…and also on Saturday". The selection has to reach the server as
 * one field per selected day, and a schedule without any day must never be
 * submitted as "no restriction" — the server rejects it, and an empty
 * selection would otherwise be indistinguishable from a missing field.
 */

vi.mock("@/app/actions/admin-settings", () => ({
  createScheduleAction: vi.fn(async () => ({ ok: true })),
  updateScheduleAction: vi.fn(async () => ({ ok: true })),
  deleteScheduleAction: vi.fn(async () => ({ ok: true })),
}));

const VALUES: ScheduleFormValues = {
  id: "",
  name: "Shift",
  description: "",
  startTime: "09:00",
  endTime: "18:00",
  lateToleranceMinutes: 10,
  breakMinutes: 60,
  workingDays: [1, 2, 3, 4, 5],
  isActive: true,
  isOrganizationDefault: false,
  assignedCount: 0,
};

function selectedDays(): string[] {
  const form = document.querySelector("form");
  if (!form) return [];
  return Array.from(form.querySelectorAll('input[name="workingDays"]')).map(
    (input) => (input as HTMLInputElement).value,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("schedule working days", () => {
  it("offers every day of the week, Monday first", () => {
    render(<ScheduleDialog open onOpenChange={() => {}} schedule={VALUES} />);

    const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
    for (const day of days) {
      expect(screen.getByRole("button", { name: day })).toBeTruthy();
    }

    // Monday–Friday are already selected, so they are the pressed ones.
    expect(screen.getByRole("button", { name: "Senin" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Sabtu" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("submits the days the schedule already has", () => {
    render(<ScheduleDialog open onOpenChange={() => {}} schedule={VALUES} />);

    expect(selectedDays().sort()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("adds and removes a day from the selection", () => {
    render(<ScheduleDialog open onOpenChange={() => {}} schedule={VALUES} />);

    fireEvent.click(screen.getByRole("button", { name: "Sabtu" }));
    expect(selectedDays().sort()).toEqual(["1", "2", "3", "4", "5", "6"]);

    fireEvent.click(screen.getByRole("button", { name: "Senin" }));
    expect(selectedDays().sort()).toEqual(["2", "3", "4", "5", "6"]);
  });

  it("fills the week with the quick presets", () => {
    render(<ScheduleDialog open onOpenChange={() => {}} schedule={VALUES} />);

    fireEvent.click(screen.getByRole("button", { name: "Semua hari" }));
    expect(selectedDays().sort()).toEqual(["0", "1", "2", "3", "4", "5", "6"]);

    fireEvent.click(screen.getByRole("button", { name: "Sen–Jum" }));
    expect(selectedDays().sort()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("carries the note into the form", () => {
    render(
      <ScheduleDialog
        open
        onOpenChange={() => {}}
        schedule={{ ...VALUES, description: "Khusus hari Sabtu, jam kerja 08:00-14:00." }}
      />,
    );

    const note = screen.getByLabelText("Catatan (opsional)") as HTMLTextAreaElement;
    expect(note.value).toBe("Khusus hari Sabtu, jam kerja 08:00-14:00.");
    expect(note.getAttribute("name")).toBe("description");
  });
});

describe("deleting a schedule", () => {
  it("keeps the delete button usable even while employees are on it", () => {
    render(
      <ScheduleList
        schedules={[{ ...VALUES, id: "schedule-1", assignedCount: 3, isOrganizationDefault: true }]}
      />,
    );

    const remove = screen.getByRole("button", { name: "Hapus jadwal Shift" });
    expect(remove.hasAttribute("disabled")).toBe(false);
  });

  it("explains what happens to the employees and to the default", () => {
    render(
      <ScheduleList
        schedules={[{ ...VALUES, id: "schedule-1", assignedCount: 3, isOrganizationDefault: true }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hapus jadwal Shift" }));

    expect(screen.getAllByText(/3 karyawan/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/default/).length).toBeGreaterThan(0);
  });
});
