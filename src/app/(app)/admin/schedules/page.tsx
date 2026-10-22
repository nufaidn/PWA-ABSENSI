import type { Metadata } from "next";
import { requireRole } from "@/lib/dal/auth";
import { getAllSchedules } from "@/lib/dal/settings";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { ScheduleList } from "@/components/admin/schedule-manager";

export const metadata: Metadata = {
  title: "Jadwal Kerja",
};

/** Work schedule management. ADMIN and above. */
export default async function SchedulesPage() {
  await requireRole("ADMIN");
  const schedules = await getAllSchedules();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Jadwal Kerja
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Jam mulai, hari kerja, toleransi keterlambatan, dan waktu istirahat yang berlaku untuk
          setiap karyawan.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-accent/60 px-4 py-3.5 text-[12.5px] leading-relaxed text-accent-foreground sm:px-5">
          Menit keterlambatan dihitung sejak jam mulai. karyawan yang datang sebelum{" "}
          <strong>jam mulai + toleransi</strong> tetap dihitung hadir. Nilai keterlambatan
          disimpan pada saat check-in sehingga mengubah jadwal di kemudian hari tidak mengubah
          riwayat. Karyawan hanya bisa absen pada <strong>hari kerja</strong> yang dipilih pada
          jadwalnya.
        </div>

        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle>Daftar Jadwal</SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Karyawan tanpa jadwal khusus memakai jadwal default organisasi.
            </SurfaceDescription>
          </SurfaceHeader>

          <ScheduleList
            schedules={schedules.map((schedule) => ({
              id: schedule.id,
              name: schedule.name,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              lateToleranceMinutes: schedule.lateToleranceMinutes,
              breakMinutes: schedule.breakMinutes,
              workingDays: schedule.workingDays,
              isActive: schedule.isActive,
              isOrganizationDefault: schedule.isOrganizationDefault,
              assignedCount: schedule._count.users,
            }))}
          />
        </Surface>
      </div>
    </div>
  );
}
