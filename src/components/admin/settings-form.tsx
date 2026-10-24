"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettingsAction } from "@/app/actions/admin-settings";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";

/**
 * Organization settings form.
 *
 * Only ADMIN can reach this screen, and the Server Action enforces the same
 * requirement independently.
 */

export interface SettingsFormValues {
  organizationName: string;
  timezone: string;
  defaultScheduleId: string | null;
requireLocationValidation: boolean;
}

export function SettingsForm({
  values,
  schedules,
  activeFenceCount,
}: {
  values: SettingsFormValues;
  schedules: Array<{ id: string; name: string }>;
  activeFenceCount: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSettingsAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5 px-5 py-5 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="organizationName">Nama organisasi</Label>
          <Input
            id="organizationName"
            name="organizationName"
            required
            defaultValue={values.organizationName}
            className="min-h-10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Zona waktu</Label>
          <Input
            id="timezone"
            name="timezone"
            required
            defaultValue={values.timezone}
            placeholder="Asia/Jakarta"
            list="timezone-suggestions"
            className="min-h-10"
          />
          <datalist id="timezone-suggestions">
            <option value="Asia/Jakarta" />
            <option value="Asia/Makassar" />
            <option value="Asia/Jayapura" />
            <option value="Asia/Singapore" />
            <option value="UTC" />
          </datalist>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Menentukan definisi &ldquo;hari kerja&rdquo; dan seluruh tampilan waktu.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultScheduleId">Jadwal default organisasi</Label>
        <select
          id="defaultScheduleId"
          name="defaultScheduleId"
          defaultValue={values.defaultScheduleId ?? ""}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[13.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:border-ring sm:max-w-sm"
        >
          <option value="">Belum ditentukan — memakai fallback 09:00–18:00</option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>
              {schedule.name}
            </option>
          ))}
        </select>
        <p className="text-[11.5px] text-muted-foreground">
          Berlaku untuk karyawan tanpa jadwal khusus.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border px-4 py-4">
        <legend className="px-1 text-[12.5px] font-medium text-foreground">
          Kebijakan absensi
        </legend>

        <label className="flex items-start gap-3 text-[13px]">
          <input
            type="checkbox"
            name="requireLocationValidation"
            value="true"
            defaultChecked={values.requireLocationValidation}
            className="mt-0.5 size-4 rounded border-input accent-[oklch(0.552_0.213_262.4)]"
          />
          <span>
            <span className="block font-medium">Wajibkan validasi lokasi GPS</span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
              {activeFenceCount > 0
                ? `Check-in ditolak bila di luar ${activeFenceCount} lokasi aktif yang terdaftar.`
                : "Tidak ada lokasi aktif yang terdaftar — aktifkan lokasi terlebih dahulu."}
            </span>
</span>
        </label>
      </fieldset>

      {state.error ? (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      {state.fieldErrors ? (
        <ul className="space-y-1 rounded-lg bg-destructive/10 px-3.5 py-3 text-[12.5px] text-destructive">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      ) : null}

      {state.ok && state.message ? (
        <p role="status" className="flex items-start gap-2 text-[13px] text-[oklch(0.34_0.08_163)]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </div>
    </form>
  );
}