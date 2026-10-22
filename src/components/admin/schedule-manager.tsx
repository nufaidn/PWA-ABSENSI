"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createScheduleAction,
  updateScheduleAction,
  deleteScheduleAction,
} from "@/app/actions/admin-settings";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { Chip } from "@/components/layout/badges";
import { cn } from "@/lib/utils";
import { describeWorkingDays } from "@/lib/attendance/time";

/**
 * Work schedule management.
 *
 * Work hours, late tolerance and the working days themselves live here rather
 * than in the global settings screen because each schedule is independently
 * assignable to employees; the settings screen only chooses which schedule is
 * the organization default.
 */

export interface ScheduleFormValues {
  id: string;
  name: string;
  /** Free-form note shown to employees, e.g. "Khusus Sabtu jam kerja 08:00-14:00". */
  description: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  breakMinutes: number;
  /** Days the schedule applies to, `0 = Minggu` … `6 = Sabtu`. */
  workingDays: number[];
  isActive: boolean;
  isOrganizationDefault: boolean;
  assignedCount: number;
}

const EMPTY: ScheduleFormValues = {
  id: "",
  name: "",
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

/**
 * Day chips, Monday first.
 *
 * The stored index follows `Date.prototype.getUTCDay()` (0 = Minggu), but an
 * admin reads a week from Monday, so the display order differs from the stored
 * order.
 */
const DAY_CHOICES = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 0, label: "Minggu" },
] as const;

const WEEKDAYS_PRESET = [1, 2, 3, 4, 5];
const EVERY_DAY_PRESET = [1, 2, 3, 4, 5, 6, 0];

/**
 * The days a schedule applies to.
 *
 * Selection lives in React state and is submitted as one hidden input per
 * selected day, so the server receives exactly the days the admin ticked. A
 * day that is not selected is not submitted at all — an empty selection is
 * rejected by the schema instead of silently becoming Monday–Friday.
 */
function WorkingDaysField({
  workingDays,
  onChange,
}: {
  workingDays: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (day: number) => {
    onChange(
      workingDays.includes(day)
        ? workingDays.filter((value) => value !== day)
        : [...workingDays, day].sort((a, b) => a - b),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Hari kerja</Label>
      <div className="flex flex-wrap gap-1.5">
        {DAY_CHOICES.map((day) => {
          const selected = workingDays.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => toggle(day.value)}
              aria-pressed={selected}
              className={cn(
                "h-9 rounded-lg border px-3 text-[12.5px] font-medium transition-colors",
                "focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-2",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      {workingDays.map((day) => (
        <input key={day} type="hidden" name="workingDays" value={day} />
      ))}

      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
        <span>Pilih cepat:</span>
        <button
          type="button"
          onClick={() => onChange([...WEEKDAYS_PRESET])}
          className="rounded-md px-1.5 py-0.5 underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Sen–Jum
        </button>
        <button
          type="button"
          onClick={() => onChange([...EVERY_DAY_PRESET])}
          className="rounded-md px-1.5 py-0.5 underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Semua hari
        </button>
      </div>

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        Karyawan dengan jadwal ini hanya bisa absen pada hari yang dipilih. Jadwal tanpa hari
        kerja tidak dapat disimpan.
      </p>
    </div>
  );
}

function ScheduleFields({ values }: { values: ScheduleFormValues }) {
  const [workingDays, setWorkingDays] = React.useState<number[]>(values.workingDays);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="schedule-name">Nama jadwal</Label>
        <Input
          id="schedule-name"
          name="name"
          required
          defaultValue={values.name}
          placeholder="Jam Kerja Reguler"
          className="min-h-10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="schedule-description">Catatan (opsional)</Label>
        <Textarea
          id="schedule-description"
          name="description"
          rows={2}
          maxLength={240}
          defaultValue={values.description}
          placeholder="Khusus hari Sabtu, jam kerja 08:00–14:00."
          className="min-h-16 text-[13.5px]"
        />
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Catatan ikut ditampilkan ke karyawan di beranda mereka. Catatan hanya dokumentasi — jam
          kerja yang dihitung tetap memakai jam di atas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-start">Jam mulai</Label>
          <Input
            id="schedule-start"
            name="startTime"
            type="time"
            required
            defaultValue={values.startTime}
            className="min-h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-end">Jam selesai</Label>
          <Input
            id="schedule-end"
            name="endTime"
            type="time"
            required
            defaultValue={values.endTime}
            className="min-h-10"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-tolerance">Toleransi keterlambatan (menit)</Label>
          <Input
            id="schedule-tolerance"
            name="lateToleranceMinutes"
            type="number"
            min={0}
            max={240}
            required
            defaultValue={values.lateToleranceMinutes}
            className="min-h-10"
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Check-in sebelum batas ini dihitung hadir, bukan terlambat.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-break">Istirahat (menit)</Label>
          <Input
            id="schedule-break"
            name="breakMinutes"
            type="number"
            min={0}
            max={480}
            required
            defaultValue={values.breakMinutes}
            className="min-h-10"
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Durasi yang tercatat dihitung dari check-in sampai check-out tanpa
            pemotongan, jadi nilai ini tidak dipakai untuk mengurangi durasi.
          </p>
        </div>
      </div>

      <WorkingDaysField workingDays={workingDays} onChange={setWorkingDays} />

      <div className="flex flex-col gap-2.5 rounded-lg border border-border px-3.5 py-3">
        <label className="flex items-center gap-2.5 text-[13px]">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={values.isActive}
            className="size-4 rounded border-input accent-[oklch(0.552_0.213_262.4)]"
          />
          Aktif — dapat dipilih untuk karyawan
        </label>
        <label className="flex items-center gap-2.5 text-[13px]">
          <input
            type="checkbox"
            name="makeDefault"
            value="true"
            defaultChecked={values.isOrganizationDefault}
            className="size-4 rounded border-input accent-[oklch(0.552_0.213_262.4)]"
          />
          Jadikan jadwal default organisasi
        </label>
      </div>
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="flex items-start gap-2 text-[13px] text-[oklch(0.34_0.08_163)]">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: ScheduleFormValues;
}) {
  const isEdit = Boolean(schedule?.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateScheduleAction : createScheduleAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      const timer = setTimeout(() => onOpenChange(false), 700);
      return () => clearTimeout(timer);
    }
  }, [state.ok, onOpenChange]);

  const values = schedule ?? EMPTY;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah jadwal kerja" : "Tambah jadwal kerja"}</DialogTitle>
          <DialogDescription>
            Jadwal menentukan jam mulai, batas keterlambatan, dan durasi kerja yang dihitung.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {schedule?.id ? <input type="hidden" name="id" value={schedule.id} /> : null}
          <ScheduleFields key={values.id || "new"} values={values} />

          {state.fieldErrors ? (
            <ul className="space-y-1 rounded-lg bg-destructive/10 px-3.5 py-3 text-[12.5px] text-destructive">
              {Object.entries(state.fieldErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}

          <Feedback state={state} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {pending ? "Menyimpan…" : isEdit ? "Simpan perubahan" : "Tambah jadwal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteScheduleDialog({
  open,
  onOpenChange,
  schedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: ScheduleFormValues;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteScheduleAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      const timer = setTimeout(() => onOpenChange(false), 700);
      return () => clearTimeout(timer);
    }
  }, [state.ok, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus jadwal</DialogTitle>
          <DialogDescription>
            Jadwal <strong>{schedule?.name}</strong> akan dihapus permanen.
          </DialogDescription>
        </DialogHeader>

        {schedule && (schedule.assignedCount > 0 || schedule.isOrganizationDefault) ? (
          <ul className="space-y-1.5 rounded-lg bg-muted px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {schedule.assignedCount > 0 ? (
              <li>
                <strong className="font-medium text-foreground">
                  {schedule.assignedCount} karyawan
                </strong>{" "}
                memakai jadwal ini. Setelah dihapus, mereka kembali memakai jadwal default
                organisasi. Riwayat absensinya tidak ikut terhapus.
              </li>
            ) : null}
            {schedule.isOrganizationDefault ? (
              <li>
                Jadwal ini adalah <strong className="font-medium text-foreground">default</strong>{" "}
                organisasi. Jadwal aktif lain akan menjadi default, atau pilih default baru di
                Pengaturan.
              </li>
            ) : null}
          </ul>
        ) : null}

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={schedule?.id ?? ""} />
          <Feedback state={state} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              <Trash2 className="size-4" />
              {pending ? "Menghapus…" : "Hapus jadwal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Inline list of schedules with edit/delete affordances. */
export function ScheduleList({ schedules }: { schedules: ScheduleFormValues[] }) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ScheduleFormValues | null>(null);
  const [deleting, setDeleting] = React.useState<ScheduleFormValues | null>(null);

  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-border">
        {schedules.map((schedule) => (
          <li key={schedule.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-[13.5px] font-medium text-foreground">
                  {schedule.name}
                </p>
                {schedule.isOrganizationDefault ? (
                  <Chip className="border-primary/30 text-primary">
                    <Star className="mr-1 size-3" />
                    Default
                  </Chip>
                ) : null}
                {!schedule.isActive ? <Chip>Nonaktif</Chip> : null}
              </div>
              <p className="tabular mt-0.5 text-[12px] text-muted-foreground">
                {schedule.startTime}–{schedule.endTime} · toleransi {schedule.lateToleranceMinutes}{" "}
                menit · istirahat {schedule.breakMinutes} menit
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Hari kerja: {describeWorkingDays(schedule.workingDays)}
              </p>
              {schedule.description ? (
                <p className="mt-0.5 text-[12px] italic text-muted-foreground">
                  {schedule.description}
                </p>
              ) : null}
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {schedule.assignedCount} karyawan memakai jadwal ini
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Ubah jadwal ${schedule.name}`}
                onClick={() => setEditing(schedule)}
                className="size-9"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Hapus jadwal ${schedule.name}`}
                onClick={() => setDeleting(schedule)}
                title="Hapus jadwal"
                className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex justify-end border-t border-border px-5 py-3.5 sm:px-6">
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="size-4" />
          Tambah jadwal
        </Button>
      </div>

      <ScheduleDialog open={creating} onOpenChange={setCreating} />
      <ScheduleDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        schedule={editing ?? undefined}
      />
      <DeleteScheduleDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        schedule={deleting ?? undefined}
      />
    </div>
  );
}