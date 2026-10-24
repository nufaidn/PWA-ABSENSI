import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildEmployeeReportPdf, employeeReportFilename } from "@/lib/reports-pdf";
import { finaliseSummary, emptySummary } from "@/lib/attendance/summary";
import type { ReportRow } from "@/lib/dal/reports";

function row(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: "absen-1",
    workDate: "2026-10-13",
    dateLabel: "13 Okt 2026",
    userId: "user-1",
    userName: "Budi Santoso",
    email: "budi@example.com",
    employeeCode: "EMP-001",
    department: "Operasional",
    status: "PRESENT",
    checkInAt: new Date("2026-10-13T00:00:00Z"),
    checkOutAt: new Date("2026-10-13T09:00:00Z"),
    checkInTime: "07:00",
    checkOutTime: "16:00",
    lateMinutes: 0,
    workedMinutes: 480,
    outsideRadius: false,
    distanceMeters: 12,
    ...overrides,
  };
}

function input(rows: ReportRow[]) {
  const summary = emptySummary();
  summary.present = rows.filter((item) => item.status === "PRESENT").length;
  summary.late = rows.filter((item) => item.status === "LATE").length;
  summary.totalWorkedMinutes = rows.reduce((sum, item) => sum + item.workedMinutes, 0);
  finaliseSummary(summary);

  return {
    organizationName: "PT Contoh Sejahtera",
    employee: {
      name: "Budi Santoso",
      email: "budi@example.com",
      employeeCode: "EMP-001",
      department: "Operasional",
    },
    range: { fromKey: "2026-10-01", toKey: "2026-10-31", days: 31 },
    summary,
    averageWorkedMinutes: 480,
    rows,
    generatedAt: new Date("2026-10-24T07:30:00Z"),
    timezone: "Asia/Jakarta",
  };
}

describe("buildEmployeeReportPdf", () => {
  it("menghasilkan berkas PDF yang valid", async () => {
    const bytes = await buildEmployeeReportPdf(input([row()]));

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe("Laporan absensi Budi Santoso");
    expect(document.getAuthor()).toBe("PT Contoh Sejahtera");
  });

  it("memecah tabel ke halaman baru saat baris banyak", async () => {
    const rows = Array.from({ length: 60 }, (_, index) =>
      row({ id: `absen-${index}`, workDate: `2026-10-${String((index % 28) + 1).padStart(2, "0")}` }),
    );

    const bytes = await buildEmployeeReportPdf(input(rows));
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  it("tetap menghasilkan berkas saat periode tidak punya catatan", async () => {
    const bytes = await buildEmployeeReportPdf(input([]));
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBe(1);
  });
});

describe("employeeReportFilename", () => {
  it("memakai nama karyawan dan rentang tanggal", () => {
    expect(employeeReportFilename("Budi Santoso", "2026-10-01", "2026-10-31")).toBe(
      "absensi-budi-santoso-2026-10-01-sampai-2026-10-31.pdf",
    );
  });

  it("membersihkan karakter yang tidak aman untuk nama berkas", () => {
    expect(employeeReportFilename("../../etc/passwd", "2026-10-01", "2026-10-31")).toBe(
      "absensi-etc-passwd-2026-10-01-sampai-2026-10-31.pdf",
    );
  });

  it("memberi nama cadangan saat nama kosong", () => {
    expect(employeeReportFilename("///", "2026-10-01", "2026-10-31")).toBe(
      "absensi-karyawan-2026-10-01-sampai-2026-10-31.pdf",
    );
  });
});
