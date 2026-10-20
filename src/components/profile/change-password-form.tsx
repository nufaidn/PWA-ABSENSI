"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/actions/auth";

const INITIAL: ChangePasswordState = {};

/**
 * Password change form.
 *
 * The current password is required even though the user is already
 * authenticated, so that a stolen session cannot lock the real owner out.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">Password saat ini</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="min-h-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">Password baru</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            className="min-h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Ulangi password baru</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="min-h-10"
          />
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        Minimal 8 karakter, mengandung huruf dan angka.
      </p>

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

      {state.ok ? (
        <p role="status" className="flex items-start gap-2 text-[13px] text-[oklch(0.34_0.08_163)]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          Password berhasil diubah.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {pending ? "Menyimpan…" : "Ubah password"}
        </Button>
      </div>
    </form>
  );
}