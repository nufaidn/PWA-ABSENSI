import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/dal/auth";
import { getEmployees } from "@/lib/dal/employees";
import { getActiveSchedules } from "@/lib/dal/settings";
import type { Role } from "@/lib/attendance/time";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { EmployeeRoster } from "@/components/admin/employee-roster";

export const metadata: Metadata = {
  title: "Karyawan",
};

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/** Employee management. ADMIN only. */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = (await searchParams) ?? {};

  const roleParam = readParam(params.role);
  const allowed: Role[] = ["EMPLOYEE", "INTERN", "ADMIN"];
  const role = (allowed.includes(roleParam as Role) ? roleParam : "ALL") as Role | "ALL";
  const activeParam = readParam(params.active);
  const active = (
    ["ALL", "active", "inactive"].includes(activeParam ?? "") ? activeParam : "ALL"
  ) as "ALL" | "active" | "inactive";

  const [employees, schedules] = await Promise.all([
    getEmployees({ search: readParam(params.search), role, active }),
    getActiveSchedules(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Kelola Karyawan
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          {employees.length} karyawan terdaftar. Menonaktifkan akun langsung mengejar sesi yang
          sedang berjalan.
        </p>
      </header>

      <Surface className="overflow-hidden">
        <SurfaceHeader>
          <SurfaceTitle>Daftar Karyawan</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            Gunakan saklar untuk mengaktifkan atau menonaktifkan akun tanpa menghapus riwayatnya.
          </SurfaceDescription>
        </SurfaceHeader>

        <Suspense fallback={<p className="px-6 py-10 text-center text-[13px] text-muted-foreground">Memuat daftar karyawan…</p>}>
          <EmployeeRoster
            employees={employees.map((employee) => ({
              id: employee.id,
              name: employee.name,
              email: employee.email,
              employeeCode: employee.employeeCode,
              role: employee.role,
              department: employee.department,
              phone: employee.phone,
              scheduleId: employee.schedule?.id ?? null,
              isActive: employee.isActive,
              createdAt: employee.createdAt.toISOString(),
              scheduleName: employee.schedule?.name ?? null,
            }))}
            schedules={schedules.map((schedule) => ({
              id: schedule.id,
              name: schedule.name,
              workingDays: schedule.workingDays,
            }))}
            currentUserId={user.id}
          />
        </Suspense>
      </Surface>
    </div>
  );
}