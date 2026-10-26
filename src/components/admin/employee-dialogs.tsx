"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeWorkingDays } from "@/lib/attendance/time";
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
  createEmployeeAction,
  updateEmployeeAction,
  deleteEmployeeAction,
  previewEmployeeCodeAction,
  resetPasswordAction,
  setEmployeeActiveAction,
} from "@/app/actions/admin-employees";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import {
  ROLE_LABEL,
  ROLE_RANK,
  isSelfServiceRole,
  type Role,
} from "@/lib/attendance/time";
import { codePrefixForRole } from "@/lib/attendance/employee-code";

/**
 * Employee management dialogs.
 *
 * Every mutation goes through a Server Action that re-checks the actor's role
 * server-side; the role options shown here are only a convenience and are not
 * the authorization mechanism.
 */

export interface EmployeeFormValues {
  id?: string;
  name: string;
  email: string;
  employeeCode: string | null;
  role: Role;
  department: string | null;
  phone: string | null;
  scheduleId: string | null;
  isActive: boolean;
}

interface ScheduleOption {
  id: string;
  name: string;
  /** Days the schedule applies to, `0 = Minggu` … `6 = Sabtu`. */
  workingDays: number[];
}

const EMPTY: EmployeeFormValues = {
  name: "",
  email: "",
  employeeCode: null,
  role: "EMPLOYEE",
  department: null,
  phone: null,
  scheduleId: null,
  isActive: true,
};

/** Fields shared by the create and edit dialogs. */
function EmployeeFields({
  values,
  schedules,
  isEdit,
  code,
  onCodeChange,
  onRegenerateCode,
}: {
  values: EmployeeFormValues;
  schedules: ScheduleOption[];
  isEdit: boolean;
  code: string;
  onCodeChange: (next: string) => void;
  onRegenerateCode: (role: Role) => void;
}) {
const [role, setRole] = useState<Role>(values.role);
  const [scheduleId, setScheduleId] = useState<string>(values.scheduleId ?? "");

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Nama lengkap" defaultValue={values.name} required />
        <Field
          name="email"
          label="Email"
          type="email"
          defaultValue={values.email}
          required
          autoComplete="off"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="field-employeeCode">Kode karyawan</Label>
            {isEdit ? null : isSelfServiceRole(role) ? (
              <button
                type="button"
                onClick={() => onRegenerateCode(role)}
                className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3" />
                Buat ulang
              </button>
            ) : null}
          </div>
          <Input
            id="field-employeeCode"
            name="employeeCode"
            value={code}
            onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
            required={isSelfServiceRole(role)}
            readOnly={isEdit}
            placeholder={isSelfServiceRole(role) ? "EMP-001" : "Opsional"}
            autoComplete="off"
            spellCheck={false}
            className="min-h-10 tabular"
          />
          <p className="text-[11.5px] text-muted-foreground">
            {isSelfServiceRole(role)
              ? code
                ? `Otomatis ${codePrefixForRole(role)}-xxx. Bisa diubah bila perlu.`
                : "Membuat kode otomatis…"
              : "Admin masuk memakai email, jadi kode tidak dipakai."}
          </p>
        </div>
        <Field name="department" label="Departemen" defaultValue={values.department ?? ""} />
        </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="phone" label="Telepon" defaultValue={values.phone ?? ""} inputMode="tel" />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(event) => {
              const next = event.target.value as Role;
              setRole(next);
              // The prefix is tied to the role, so a code from the other track
              // would be wrong. Cleared rather than regenerated here so the
              // allocation happens once, in the dialog's own handler.
              if (!isSelfServiceRole(next)) onCodeChange("");
            }}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[13.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:border-ring"
          >
{(Object.keys(ROLE_RANK) as Role[]).map((option) => (
              <option key={option} value={option}>
                {ROLE_LABEL[option]}
              </option>
            ))}
          </select>
          <p className="text-[11.5px] text-muted-foreground">
            Role menentukan cakupan menu dan data yang dapat diakses.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scheduleId">Jadwal kerja</Label>
        <select
          id="scheduleId"
          name="scheduleId"
          value={scheduleId}
          onChange={(event) => setScheduleId(event.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[13.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:border-ring"
        >
          <option value="">Gunakan jadwal default organisasi</option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>
              {schedule.name} · {describeWorkingDays(schedule.workingDays)}
            </option>
          ))}
        </select>
      </div>

      {!isEdit ? (
        <Field
          name="password"
          label="Password awal"
          type="password"
          required
          autoComplete="new-password"
          hint="Minimal 8 karakter, mengandung huruf dan angka."
        />
      ) : null}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required,
  placeholder,
  inputMode,
  autoComplete,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  hint?: string;
}) {
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="min-h-10"
      />
      {hint ? <p className="text-[11.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ActionFeedback({ state }: { state: ActionState }) {
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

function SubmitLabel({ idle, pending }: { idle: string; pending: string }) {
  return (
    <>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? pending : idle}
    </>
  );
}

/** Create / edit dialog. */
export function EmployeeDialog({
  open,
  onOpenChange,
  schedules,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: ScheduleOption[];
  employee?: EmployeeFormValues;
}) {
  const isEdit = Boolean(employee?.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateEmployeeAction : createEmployeeAction,
    INITIAL_ACTION_STATE,
  );

  // Close on success so the roster refreshes behind the dialog.
  useEffect(() => {
    if (state.ok) {
      const timer = setTimeout(() => onOpenChange(false), 700);
      return () => clearTimeout(timer);
    }
  }, [state.ok, onOpenChange]);

  const values = employee ?? EMPTY;

  /**
   * Holds the generated code in the dialog rather than in `EmployeeFields`.
   *
   * Fetching it there would mean an effect that writes state on mount, which
   * React flags as a cascading render. Here it is driven by the dialog's
   * `onOpenChange`, a real event, so the allocation happens once per opening.
   */
  const [code, setCode] = useState<string>(employee?.employeeCode ?? "");

  // Update code state when employee changes (e.g., switching between edit dialogs)
  useEffect(() => {
    if (isEdit && employee?.employeeCode) {
      setCode(employee.employeeCode);
    }
  }, [employee?.employeeCode, isEdit]);

  const fetchCode = React.useCallback(async (forRole: Role) => {
    if (isEdit) return;
    const formData = new FormData();
    formData.set("role", forRole);
    setCode((await previewEmployeeCodeAction(formData)) ?? "");
  }, [isEdit]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next || isEdit) return;
    // Reopening should suggest the next free code, not the one just used.
    void fetchCode(values.role);
  };

  return (
<Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah karyawan" : "Tambah karyawan"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perubahan langsung berlaku pada sesi karyawan terkait."
              : "Karyawan baru menerima akun dengan password awal yang Anda tentukan."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {employee?.id ? <input type="hidden" name="id" value={employee.id} /> : null}
          <EmployeeFields
            values={values}
            schedules={schedules}
            isEdit={isEdit}
            code={code}
            onCodeChange={setCode}
            onRegenerateCode={(next) => void fetchCode(next)}
          />

          {state.fieldErrors ? (
            <ul className="space-y-1 rounded-lg bg-destructive/10 px-3.5 py-3 text-[12.5px] text-destructive">
              {Object.entries(state.fieldErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}

          <ActionFeedback state={state} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <SubmitLabel
                idle={isEdit ? "Simpan perubahan" : "Tambah karyawan"}
                pending="Menyimpan…"
              />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reset-password dialog. */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeFormValues;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPasswordAction,
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
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Password baru untuk {employee?.name ?? "karyawan ini"}. Password tersebut langsung
            berlaku.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={employee?.id ?? ""} />
          <Field
            name="newPassword"
            label="Password baru"
            type="password"
            required
            autoComplete="new-password"
            hint="Minimal 8 karakter, mengandung huruf dan angka."
          />

          {state.fieldErrors?.newPassword ? (
            <p className="text-[12.5px] text-destructive">{state.fieldErrors.newPassword}</p>
          ) : null}
          <ActionFeedback state={state} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <SubmitLabel idle="Reset password" pending="Memproses…" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Confirm-and-delete dialog. */
export function DeleteEmployeeDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeFormValues;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteEmployeeAction,
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
          <DialogTitle>Hapus karyawan</DialogTitle>
          <DialogDescription>
            Menghapus <strong>{employee?.name}</strong> juga menghapus seluruh riwayat absensinya.
            Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={employee?.id ?? ""} />
          <ActionFeedback state={state} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              <Trash2 className="size-4" />
              {pending ? "Menghapus…" : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Activate / deactivate toggle rendered inline in the roster row. */
export function ActiveToggle({
  employee,
  disabled,
}: {
  employee: EmployeeFormValues;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setEmployeeActiveAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="inline-flex items-center">
      <input type="hidden" name="id" value={employee.id ?? ""} />
      <input type="hidden" name="isActive" value={employee.isActive ? "false" : "true"} />
      <button
        type="submit"
        disabled={disabled || pending}
        title={employee.isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
        aria-label={employee.isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
          employee.isActive ? "bg-success" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            employee.isActive ? "translate-x-[22px]" : "translate-x-[3px]",
          )}
        />
      </button>
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}

/** Button that opens the create dialog. */
export function AddEmployeeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} className="gap-2">
      <Plus className="size-4" />
      Tambah karyawan
    </Button>
  );
}