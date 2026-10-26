import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CalendarDays,
  CalendarX2,
  Clock,
  UserCheck,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/dal/auth";
import { getAttendanceReport, getDepartments } from "@/lib/dal/reports";
import { AttendanceStatus } from "@/lib/domain";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { Pagination } from "@/components/attendance/pagination";
import { DepartmentSelect } from "@/components/admin/department-select";
import { EmployeeReportCards } from "@/components/admin/employee-report-cards";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
  EmptyState,
  Stat,
} from "@/components/layout/primitives";
import { LiveAttendanceIndicator } from "@/components/attendance/live-indicator";

export const metadata: Metadata = {
  title: "Laporan Absensi",
};

/** Cards are larger than table rows, so fewer fit on one screen. */
const EMPLOYEE_PAGE_SIZE = 12;

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

function readPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(readParam(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readStatus(value: string | string[] | undefined): AttendanceStatus | "ALL" {
  const raw = readParam(value) ?? "ALL";
  const allowed = Object.values(AttendanceStatus) as string[];
  return allowed.includes(raw) ? (raw as AttendanceStatus) : "ALL";
}

/**
 * Organization-wide attendance report, grouped per employee.
 *
 * `requireRole("ADMIN")` is the gate. The DAL repeats the same check, so this
 * page-level guard is UX rather than the security boundary.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const params = (await searchParams) ?? {};

  const from = readParam(params.from);
  const to = readParam(params.to);
  const search = readParam(params.search);
  const department = readParam(params.department);
  const status = readStatus(params.status);
  const page = readPage(params.page);

  const [report, departments] = await Promise.all([
    getAttendanceReport(
      { from: from ?? "", to: to ?? "", search, department, status },
      { page, pageSize: 25 },
    ),
    getDepartments(),
  ]);

  // Cards are paginated per employee, not per attendance row.
  const employeeTotal = report.perEmployee.length;
  const employeePageCount = Math.max(
    1,
    Math.ceil(employeeTotal / EMPLOYEE_PAGE_SIZE),
  );
  const employeePage = Math.min(page, employeePageCount);
  const employees = report.perEmployee.slice(
    (employeePage - 1) * EMPLOYEE_PAGE_SIZE,
    employeePage * EMPLOYEE_PAGE_SIZE,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Laporan Absensi
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          {report.range.fromKey} sampai {report.range.toKey} · {report.range.days} hari ·{" "}
          {employeeTotal} karyawan · {report.total} catatan
          {department ? ` · departemen ${department}` : ""}
        </p>
        <LiveAttendanceIndicator enabled />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Hadir"
          value={report.summary.present}
          hint="tepat waktu"
          icon={UserCheck}
          tone="success"
        />
        <Stat
          label="Terlambat"
          value={report.summary.late}
          hint="melewati toleransi"
          icon={Clock}
          tone="warning"
        />
        <Stat
          label="Alpa"
          value={report.summary.absent}
          hint="tidak tercatat"
          icon={CalendarX2}
          tone="danger"
        />
        <Stat
          label="Izin / Sakit / Cuti"
          value={report.summary.leave}
          hint="tidak masuk resmi"
          icon={CalendarDays}
          tone="info"
        />
      </div>

      <div className="mt-4 sm:mt-5">
        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle>Laporan Absensi Karyawan</SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Pilih karyawan lewat ikon mata — lihat jam masuk, jam keluar,
              durasi kerja, dan keterangan harian pada periode ini.
            </SurfaceDescription>
          </SurfaceHeader>

          <div className="border-b border-border p-4 sm:p-5">
            <Suspense fallback={null}>
              <AttendanceFilters
                basePath="/admin/reports"
                showSearch
                embedded
                extra={
                  <DepartmentSelect
                    basePath="/admin/reports"
                    departments={departments}
                  />
                }
              />
            </Suspense>
          </div>

          {employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Tidak ada karyawan"
              description="Tidak ada karyawan yang cocok dengan filter aktif. Coba perlebar rentang tanggal, ubah status, atau hapus filter."
            />
          ) : (
            <>
              <EmployeeReportCards
                employees={employees}
                fromKey={report.range.fromKey}
                toKey={report.range.toKey}
              />

              <Pagination
                page={employeePage}
                pageCount={employeePageCount}
                total={employeeTotal}
                pageSize={EMPLOYEE_PAGE_SIZE}
                unit="karyawan"
                basePath="/admin/reports"
                searchParams={{
                  from: report.range.fromKey,
                  to: report.range.toKey,
                  search,
                  department,
                  status: status === "ALL" ? undefined : status,
                }}
              />
            </>
          )}
        </Surface>
      </div>
    </div>
  );
}
