import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getEffectiveSchedule } from "@/lib/dal/settings";
import { ROLE_LABEL } from "@/lib/attendance/time";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { Chip, Monogram } from "@/components/layout/badges";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

export const metadata: Metadata = {
  title: "Profil",
};

/** Self-service profile and password management. */
export default async function ProfilePage() {
  const user = await requireUser();
  const schedule = await getEffectiveSchedule(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Profil Saya
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Informasi akun dan pengaturan keamanan Anda.
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:gap-6">
        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle>Informasi Akun</SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Data ini dikelola oleh admin. Hubungi admin bila perlu diperbarui.
            </SurfaceDescription>
          </SurfaceHeader>

          <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-start sm:px-6">
            <Monogram name={user.name} size="lg" />

            <dl className="grid flex-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Nama
                </dt>
                <dd className="mt-0.5 text-[13.5px] font-medium">{user.name}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-0.5 flex items-center gap-1.5 truncate text-[13.5px]">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                  {user.email}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Role
                </dt>
                <dd className="mt-1">
                  <Chip>{ROLE_LABEL[user.role]}</Chip>
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Departemen
                </dt>
                <dd className="mt-0.5 text-[13.5px]">{user.department ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Kode karyawan
                </dt>
                <dd className="tabular mt-0.5 text-[13.5px]">{user.employeeCode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Telepon
                </dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-[13.5px]">
                  <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                  {user.phone ?? "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  Jadwal kerja
                </dt>
                <dd className="tabular mt-0.5 text-[13.5px]">
                  {schedule.name} · {schedule.startTime}–{schedule.endTime} · toleransi{" "}
                  {schedule.lateToleranceMinutes} menit
                  {schedule.isDefault ? " (default organisasi)" : ""}
                </dd>
              </div>
            </dl>
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle>Keamanan</SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Password baru akan langsung menggantikan password lama pada login berikutnya.
            </SurfaceDescription>
          </SurfaceHeader>
          <ChangePasswordForm />
        </Surface>
      </div>
    </div>
  );
}