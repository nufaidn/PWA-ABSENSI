"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff, Hash, Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
      {pending ? "Memproses…" : "Masuk"}
    </Button>
  );
}

/**
 * Employee sign-in.
 *
 * The primary field is the employee code from joining paperwork; email still
 * works as a fallback, which the hint says out loud rather than leaving someone
 * stuck at a field they filled in correctly.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});
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
        <Label htmlFor="identifier">ID Karyawan</Label>
        <div className="relative">
          <Hash
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="identifier"
            name="identifier"
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            required
            placeholder="EMP-001"
            aria-invalid={Boolean(state.fieldErrors?.identifier)}
            aria-describedby={
              state.fieldErrors?.identifier ? "identifier-error" : "identifier-hint"
            }
            className="min-h-11 pl-9 uppercase"
          />
        </div>
        {state.fieldErrors?.identifier ? (
          <p id="identifier-error" className="text-[12.5px] text-destructive">
            {state.fieldErrors.identifier}
          </p>
        ) : (
          <p id="identifier-hint" className="text-[12px] leading-snug text-muted-foreground">
            Gunakan ID Karyawan Anda. Email terdaftar juga bisa dipakai.
          </p>
        )}
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
    </form>
  );
}