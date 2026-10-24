"use client";

import * as React from "react";
import { useActionState, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Stethoscope,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createLeaveRequestAction,
  getLeaveUploadSignatureAction,
} from "@/app/actions/leave";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import {
  LEAVE_TYPE_DESCRIPTION,
  LEAVE_TYPE_LABEL,
  LEAVE_TYPE_OPTIONS,
} from "@/lib/leave";
import type { LeaveType } from "@/lib/domain";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED_NOTE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const TYPE_ICON: Record<LeaveType, React.ComponentType<{ className?: string }>> = {
  CUTI: CalendarDays,
  IZIN: FileText,
  SAKIT: Stethoscope,
};

type UploadPhase = "idle" | "uploading" | "ready" | "error";

export function LeaveRequestForm({
  todayKey,
  cloudinaryReady,
}: {
  todayKey: string;
  cloudinaryReady: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createLeaveRequestAction,
    INITIAL_ACTION_STATE,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);

  const [type, setType] = useState<LeaveType>("CUTI");
  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [reason, setReason] = useState("");

  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [doctorNoteUrl, setDoctorNoteUrl] = useState("");
  const [doctorNotePublicId, setDoctorNotePublicId] = useState("");

  const isSakit = type === "SAKIT";
  const isIzin = type === "IZIN";
  const uploading = uploadPhase === "uploading";

  /**
   * Reset is a user event rather than an effect: clearing seven pieces of state
   * from a success effect would cause a second render pass and is flagged by
   * the React hooks lint rules. Keeping the submitted values visible also lets
   * the employee compare the receipt with what they sent.
   */
  function resetForm() {
    formRef.current?.reset();
    setType("CUTI");
    setStartDate(todayKey);
    setEndDate(todayKey);
    setReason("");
    clearFile();
  }

  async function uploadDoctorNote(file: File) {
    if (!ALLOWED_NOTE_TYPES.has(file.type)) {
      setUploadPhase("error");
      setUploadError("Surat dokter harus berupa JPG, PNG, WEBP, HEIC, atau PDF.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadPhase("error");
      setUploadError("Ukuran surat dokter maksimal 8 MB.");
      return;
    }

    const sequence = ++uploadSequence.current;
    setUploadPhase("uploading");
    setUploadError(null);
    setFileName(file.name);

    try {
      const signature = await getLeaveUploadSignatureAction();
      if (!signature.ok) throw new Error(signature.error);
      if (uploadSequence.current !== sequence) return;

      const body = new FormData();
      body.append("file", file);
      body.append("api_key", signature.upload.apiKey);
      body.append("timestamp", String(signature.upload.timestamp));
      body.append("signature", signature.upload.signature);
      body.append("folder", signature.upload.folder);
      body.append("allowed_formats", signature.upload.allowedFormats);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.upload.cloudName}/auto/upload`,
        { method: "POST", body },
      );
      const payload = (await response.json().catch(() => null)) as
        | { secure_url?: unknown; public_id?: unknown; error?: { message?: unknown } }
        | null;

      if (!response.ok || typeof payload?.secure_url !== "string") {
        const message =
          typeof payload?.error?.message === "string"
            ? payload.error.message
            : "Cloudinary menolak unggahan.";
        throw new Error(message);
      }
      if (uploadSequence.current !== sequence) return;

      setDoctorNoteUrl(payload.secure_url);
      setDoctorNotePublicId(
        typeof payload.public_id === "string" ? payload.public_id : "",
      );
      setUploadPhase("ready");
    } catch (error) {
      if (uploadSequence.current !== sequence) return;
      setDoctorNoteUrl("");
      setDoctorNotePublicId("");
      setUploadPhase("error");
      setUploadError(
        error instanceof Error ? error.message : "Gagal mengunggah surat dokter.",
      );
    }
  }

  function clearFile() {
    uploadSequence.current += 1;
    setUploadPhase("idle");
    setUploadError(null);
    setFileName(null);
    setDoctorNoteUrl("");
    setDoctorNotePublicId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const submitBlocked = isSakit && uploadPhase !== "ready";

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5 px-5 py-5 sm:px-6">
      <div>
        <Label className="mb-2">Jenis pengajuan</Label>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Jenis pengajuan">
          {LEAVE_TYPE_OPTIONS.map((option) => {
            const Icon = TYPE_ICON[option];
            const active = type === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(option)}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  active
                    ? "border-primary/40 bg-accent text-foreground ring-1 ring-primary/20"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", active && "text-primary")} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {LEAVE_TYPE_LABEL[option]}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug">
                    {LEAVE_TYPE_DESCRIPTION[option]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-start">Tanggal mulai</Label>
          <Input
            id="leave-start"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => {
              const next = event.target.value;
              setStartDate(next);
              if (endDate < next) setEndDate(next);
            }}
            className="min-h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-end">Tanggal selesai</Label>
          <Input
            id="leave-end"
            name="endDate"
            type="date"
            required
            min={startDate}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="min-h-10"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="leave-reason">
          {isIzin ? "Alasan izin" : "Keterangan"}
          {isIzin ? <span className="text-destructive">*</span> : null}
        </Label>
        <Textarea
          id="leave-reason"
          name="reason"
          required={isIzin}
          minLength={isIzin ? 10 : undefined}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            isIzin
              ? "Jelaskan alasan izin (minimal 10 karakter)."
              : "Opsional — misalnya acara keluarga atau keterangan tambahan."
          }
          rows={3}
        />
        {state.fieldErrors?.reason ? (
          <p className="text-[12px] text-destructive">{state.fieldErrors.reason}</p>
        ) : null}
      </div>

      {isSakit ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Surat dokter</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Wajib diunggah. Format JPG, PNG, WEBP, atau PDF, maksimal 8 MB.
              </p>
            </div>
            {uploadPhase === "ready" ? (
              <button
                type="button"
                onClick={clearFile}
                className="text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Ganti file
              </button>
            ) : null}
          </div>

          {!cloudinaryReady ? (
            <p className="mt-3 flex items-start gap-2 text-[12.5px] text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Unggahan surat dokter belum dikonfigurasi di server. Hubungi admin.
            </p>
          ) : (
            <>
              <label
                htmlFor="doctor-note"
                className={cn(
                  "mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3.5 py-3 text-[12.5px] transition-colors",
                  uploadPhase === "error"
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {uploading ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : uploadPhase === "ready" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-[oklch(0.42_0.11_76)]" />
                ) : (
                  <Upload className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {uploading
                      ? "Mengunggah surat dokter…"
                      : uploadPhase === "ready"
                        ? fileName
                        : "Pilih file surat dokter"}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {uploadPhase === "ready"
                      ? "File tersimpan dan siap dikirim."
                      : "Ketuk untuk memilih file dari perangkat."}
                  </span>
                </span>
              </label>
              <input
                ref={fileInputRef}
                id="doctor-note"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadDoctorNote(file);
                }}
              />
            </>
          )}

          {uploadError ? (
            <p role="alert" className="mt-2 flex items-start gap-2 text-[12px] text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {uploadError}
            </p>
          ) : null}

          {isSakit ? (
            <>
              <input type="hidden" name="doctorNoteUrl" value={doctorNoteUrl} />
              <input type="hidden" name="doctorNotePublicId" value={doctorNotePublicId} />
            </>
          ) : null}

          {state.fieldErrors?.doctorNoteUrl ? (
            <p className="mt-2 text-[12px] text-destructive">
              {state.fieldErrors.doctorNoteUrl}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      {state.fieldErrors && !state.error ? (
        <ul className="space-y-1 rounded-lg bg-destructive/10 px-3.5 py-3 text-[12.5px] text-destructive">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      ) : null}

      {state.ok && state.message ? (
        <div className="flex flex-col gap-2 rounded-lg bg-[oklch(0.97_0.02_163)] px-3.5 py-3 sm:flex-row sm:items-start sm:justify-between">
          <p role="status" className="flex items-start gap-2 text-[13px] text-[oklch(0.34_0.08_163)]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {state.message}
          </p>
          <button
            type="button"
            onClick={resetForm}
            className="shrink-0 text-left text-[12px] font-medium text-[oklch(0.34_0.08_163)] underline-offset-2 hover:underline"
          >
            Isi pengajuan baru
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Pengajuan langsung tercatat sebagai izin/cuti pada hari kerja. Tidak ada proses
          persetujuan.
        </p>
        <Button
          type="submit"
          size="lg"
          className="min-h-10 shrink-0 px-4"
          disabled={pending || uploading || submitBlocked}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {pending ? "Menyimpan…" : "Ajukan sekarang"}
        </Button>
      </div>
    </form>
  );
}
