"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/**
 * Work schedule management.
 *
 * Work hours and late tolerance live here rather than in the global settings
 * screen because each schedule is independently assignable to employees; the
 * settings screen only chooses which schedule is the organization default.
 */

export interface ScheduleFormValues {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  breakMinutes: number;
  isActive: boolean;
  isDefault: boolean;
  assignedCount: number;
}

const EMPTY: ScheduleFormValues = {
  id: "",
  name: "",
  startTime: "09:00",
  endTime: "18:00",
  lateToleranceMinutes: 10,
  breakMinutes: 60,
  isActive: true,
  isDefault: false,
  assignedCount: 0,
};

function ScheduleFields({ values }: { values: ScheduleFormValues }) {
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
            defaultChecked={values.isDefault}
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
          <ScheduleFields values={values} />

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
            {schedule && schedule.assignedCount > 0
              ? ` Jadwal ini masih dipakai ${schedule.assignedCount} karyawan sehingga penghapusan akan ditolak.`
              : ""}
          </DialogDescription>
        </DialogHeader>

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
                {schedule.isDefault ? (
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
                disabled={schedule.assignedCount > 0}
                title={
                  schedule.assignedCount > 0
                    ? "Lepas dari karyawan terlebih dahulu"
                    : "Hapus jadwal"
                }
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