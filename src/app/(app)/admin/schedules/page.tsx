import type { Metadata } from "next";
import { CalendarDays, ClipboardList, Info, Star, Users } from "lucide-react";
import { requireRole } from "@/lib/dal/auth";
import { getAllSchedules } from "@/lib/dal/settings";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { AdminFact, AdminHeader } from "@/components/admin/admin-header";
import { ScheduleList } from "@/components/admin/schedule-manager";

export const metadata: Metadata = {
  title: "Jadwal Kerja",
};

/** Work schedule management. ADMIN and above. */
export default async function SchedulesPage() {
  await requireRole("ADMIN");
  const schedules = await getAllSchedules();

  const defaultSchedule = schedules.find((schedule) => schedule.isOrganizationDefault) ?? null;
  const assignedTotal = schedules.reduce((total, schedule) => total + schedule._count.users, 0);
  const activeCount = schedules.filter((schedule) => schedule.isActive).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <AdminHeader
        icon={ClipboardList}
        eyebrow="Manajemen"
        title="Jadwal Kerja"
        description="Jam mulai, hari kerja, toleransi keterlambatan, dan waktu istirahat yang berlaku untuk setiap karyawan."
        meta={
          <>
            <AdminFact icon={ClipboardList} label="Jadwal" value={schedules.length} tone="primary" />
            <AdminFact icon={CalendarDays} label="Aktif" value={activeCount} tone="success" />
            <AdminFact icon={Users} label="Karyawan tertaut" value={assignedTotal} />
            <AdminFact
              icon={Star}
              label="Default"
              value={defaultSchedule?.name ?? "Belum diatur"}
              tone={defaultSchedule ? "primary" : "warning"}
            />
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-accent/60 px-4 py-3.5 text-[12.5px] leading-relaxed text-accent-foreground sm:px-5">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Menit keterlambatan dihitung sejak jam mulai. Karyawan yang datang sebelum{" "}
            <strong>jam mulai + toleransi</strong> tetap dihitung hadir. Nilai keterlambatan
            disimpan pada saat check-in sehingga mengubah jadwal di kemudian hari tidak mengubah
            riwayat. Karyawan hanya bisa absen pada <strong>hari kerja</strong> yang dipilih pada
            jadwalnya.
          </p>
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
              description: schedule.description ?? "",
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
