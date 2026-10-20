"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { adminLoginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
      {pending ? "Memproses…" : "Masuk sebagai Admin"}
    </Button>
  );
}

/**
 * Admin sign-in for `/admin`.
 *
 * Only accounts holding ADMIN or above get through. The failure message is
 * deliberately the same wording an employee gets on a wrong password — telling
 * someone "this account is not an administrator" would confirm their credentials
 * were correct, which is an account-enumeration oracle.
 */
export function AdminLoginForm({
  next,
  defaultEmail,
}: {
  next?: string;
  defaultEmail: string;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(adminLoginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[13px] leading-relaxed text-destructive ring-1 ring-inset ring-destructive/20"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier">Email Admin</Label>
        <Input
          id="identifier"
          name="identifier"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={defaultEmail}
          placeholder="admin@perusahaan.com"
          aria-invalid={Boolean(state.fieldErrors?.identifier)}
          aria-describedby={state.fieldErrors?.identifier ? "identifier-error" : undefined}
          className="min-h-11"
        />
        {state.fieldErrors?.identifier ? (
          <p id="identifier-error" className="text-[12.5px] text-destructive">
            {state.fieldErrors.identifier}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
            className="min-h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-[12.5px] text-destructive">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <SubmitButton />

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
        Halaman ini khusus administrator. Akun karyawan tidak dapat masuk di sini.
      </p>
    </form>
  );
}