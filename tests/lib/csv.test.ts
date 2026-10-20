import { describe, expect, it } from "vitest";
import { CSV_BOM, csvFilename, escapeCsvValue, toCsv, type CsvColumn } from "@/lib/csv";
import { REPORT_COLUMNS, buildReportCsv, reportFilename } from "@/lib/reports-csv";
import type { ReportRow } from "@/lib/dal/reports";

function row(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: "att-1",
    workDate: "2026-10-13",
    dateLabel: "13 Okt 2026",
    userId: "user-1",
    userName: "Andi",
    email: "andi@example.com",
    employeeCode: "EMP-001",
    department: "Engineering",
    status: "PRESENT",
    checkInAt: new Date("2026-10-13T01:55:00Z"),
    checkOutAt: new Date("2026-10-13T10:05:00Z"),
    checkInTime: "08:55",
    checkOutTime: "17:05",
    lateMinutes: 0,
    workedMinutes: 430,
    outsideRadius: false,
    distanceMeters: 12,
    ...overrides,
  };
}

describe("escapeCsvValue", () => {
  it("returns an empty string for null and undefined", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("leaves plain values unquoted", () => {
    expect(escapeCsvValue("Andi")).toBe("Andi");
    expect(escapeCsvValue(430)).toBe("430");
    expect(escapeCsvValue(false)).toBe("false");
  });

  it("quotes values containing a comma, quote or newline", () => {
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("escapes semicolons, which some spreadsheet locales use as a separator", () => {
    expect(escapeCsvValue("a;b")).toBe('"a;b"');
  });

  it("neutralises spreadsheet formula injection", () => {
    // A name like this would otherwise execute as a formula when opened in Excel.
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(escapeCsvValue("-2")).toBe("'-2");
    expect(escapeCsvValue("@cmd")).toBe("'@cmd");
  });

  it("serialises dates as ISO strings", () => {
    expect(escapeCsvValue(new Date("2026-10-13T02:00:00Z"))).toBe("2026-10-13T02:00:00.000Z");
  });
});

interface Person {
  name: string;
  active: boolean;
}

describe("toCsv", () => {
  const columns: CsvColumn<Person>[] = [
    { header: "Nama", value: (r) => r.name },
    { header: "Status", value: (r) => (r.active ? "Aktif" : "Nonaktif") },
  ];

  it("emits a header row followed by data rows", () => {
    const csv = toCsv([{ name: "Andi", active: true }], columns);
    expect(csv).toBe(`${CSV_BOM}Nama,Status\r\nAndi,Aktif\r\n`);
  });

  it("emits only the header for an empty row set", () => {
    expect(toCsv([], columns)).toBe(`${CSV_BOM}Nama,Status\r\n`);
  });

  it("starts with a BOM so Excel reads UTF-8 correctly", () => {
    expect(toCsv([], columns).charCodeAt(0)).toBe(0xfeff);
  });

  it("uses CRLF line endings per RFC 4180", () => {
    const csv = toCsv([{ name: "Andi", active: true }], columns);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
  });

  it("quotes a header containing a comma or semicolon", () => {
    expect(toCsv([], [{ header: "Durasi Kerja, menit", value: () => 1 }]).split("\r\n")[0]).toBe(
      `${CSV_BOM}"Durasi Kerja, menit"`,
    );
  });
});

describe("csvFilename", () => {
  it("builds a safe filename with the given date", () => {
    expect(csvFilename("laporan absensi", "2026-10-13")).toBe("laporan-absensi-2026-10-13.csv");
  });

  it("strips characters that are unsafe in a header", () => {
    expect(csvFilename("../../etc/passwd", "2026-10-13")).toBe("etcpasswd-2026-10-13.csv");
  });

  it("falls back to a default when nothing survives sanitisation", () => {
    expect(csvFilename("///", "2026-10-13")).toBe("laporan-2026-10-13.csv");
  });
});

describe("buildReportCsv", () => {
  it("renders one line per report row with the status label", () => {
    const csv = buildReportCsv([row()]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(CSV_BOM + REPORT_COLUMNS.map((c) => c.header).join(","));
    expect(lines[1]).toContain("Hadir");
    expect(lines[1]).toContain("andi@example.com");
  });

  it("renders missing optional fields as empty cells", () => {
    const csv = buildReportCsv([
      row({ employeeCode: null, department: null, checkOutTime: "", distanceMeters: null }),
    ]);
    const cells = csv.split("\r\n")[1].split(",");
    // employeeCode, department, checkOutTime and distanceMeters are all empty.
    expect(cells.filter((cell) => cell === "")).toHaveLength(4);
  });

  it("flags a check-in made outside the fence radius", () => {
    expect(buildReportCsv([row({ outsideRadius: true })])).toContain("Ya");
    expect(buildReportCsv([row({ outsideRadius: false })])).toContain("Tidak");
  });

  it("quotes a name containing a comma", () => {
    expect(buildReportCsv([row({ userName: "Budi, S." })])).toContain('"Budi, S."');
  });
});

describe("reportFilename", () => {
  it("includes both ends of the range", () => {
    expect(reportFilename("2026-10-01", "2026-10-13")).toMatch(
      /^absensi-2026-10-01-sampai-2026-10-13-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});