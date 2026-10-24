import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { STATUS_DESCRIPTOR, formatDateKey, formatDuration } from "@/lib/attendance/time";
import type { AttendanceSummary } from "@/lib/attendance/summary";
import type { ReportRow, ResolvedReportRange } from "@/lib/dal/reports";

/**
 * PDF report for a single employee.
 *
 * Kept in a plain module (no `server-only`, no React) so the document can be
 * unit tested without booting Next.js. The route handler owns authorization and
 * the response headers.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_LINE_Y = 54;
const BOTTOM_LIMIT = 74;
const ROW_HEIGHT = 21;
const SUMMARY_BOX_GAP = 8;

const COLOR = {
  ink: rgb(0.11, 0.13, 0.16),
  muted: rgb(0.42, 0.46, 0.51),
  faint: rgb(0.63, 0.66, 0.7),
  line: rgb(0.88, 0.9, 0.92),
  soft: rgb(0.965, 0.97, 0.975),
  brand: rgb(0.1, 0.36, 0.32),
  white: rgb(1, 1, 1),
};

const COLUMNS = [
  { header: "Tanggal", x: 12, width: 80 },
  { header: "Status", x: 96, width: 74 },
  { header: "Masuk", x: 176, width: 46 },
  { header: "Keluar", x: 226, width: 46 },
  { header: "Telat", x: 278, width: 44 },
  { header: "Durasi", x: 328, width: 60 },
  { header: "Keterangan", x: 396, width: CONTENT_WIDTH - 396 - 12 },
] as const;

export interface EmployeeReportPdfInput {
  organizationName: string;
  employee: {
    name: string;
    email: string;
    employeeCode: string | null;
    department: string | null;
  };
  range: ResolvedReportRange;
  summary: AttendanceSummary;
  averageWorkedMinutes: number;
  rows: ReportRow[];
  generatedAt: Date;
  timezone: string;
}

/** Draws text after replacing glyphs the built-in Helvetica cannot encode. */
function text(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00B7/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
}

/** Shortens `value` to fit `maxWidth`, appending an ellipsis when needed. */
function fit(font: PDFFont, value: string, size: number, maxWidth: number): string {
  const safe = text(value);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let result = safe;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

function drawRight(
  page: PDFPage,
  value: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color = COLOR.muted,
): void {
  const safe = text(value);
  page.drawText(safe, {
    x: xRight - font.widthOfTextAtSize(safe, size),
    y,
    size,
    font,
    color,
  });
}

function drawFooter(page: PDFPage, font: PDFFont, pageNumber: number, pageCount: number): void {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_LINE_Y },
    end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_LINE_Y },
    thickness: 0.5,
    color: COLOR.line,
  });
  page.drawText("Dibuat otomatis oleh sistem absensi", {
    x: MARGIN,
    y: 38,
    size: 7.5,
    font,
    color: COLOR.faint,
  });
  drawRight(page, `Halaman ${pageNumber} dari ${pageCount}`, PAGE_WIDTH - MARGIN, 38, 7.5, font, COLOR.faint);
}

function drawPageHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  input: EmployeeReportPdfInput,
): void {
  page.drawText(text(input.organizationName.toUpperCase()), {
    x: MARGIN,
    y: 800,
    size: 8.5,
    font: fonts.bold,
    color: COLOR.brand,
  });
  page.drawText("Laporan Absensi Karyawan", {
    x: MARGIN,
    y: 778,
    size: 19,
    font: fonts.bold,
    color: COLOR.ink,
  });
  page.drawText(
    `Periode ${formatDateKey(input.range.fromKey)} - ${formatDateKey(input.range.toKey)} (${input.range.days} hari)`,
    {
      x: MARGIN,
      y: 760,
      size: 9.5,
      font: fonts.regular,
      color: COLOR.muted,
    },
  );
  page.drawLine({
    start: { x: MARGIN, y: 748 },
    end: { x: PAGE_WIDTH - MARGIN, y: 748 },
    thickness: 0.75,
    color: COLOR.line,
  });
}

function drawContinuationHeader(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  input: EmployeeReportPdfInput,
): number {
  page.drawText(fit(fonts.bold, input.employee.name, 10, CONTENT_WIDTH - 170), {
    x: MARGIN,
    y: 800,
    size: 10,
    font: fonts.bold,
    color: COLOR.ink,
  });
  drawRight(
    page,
    `Periode ${formatDateKey(input.range.fromKey)} - ${formatDateKey(input.range.toKey)}`,
    PAGE_WIDTH - MARGIN,
    800,
    8.5,
    fonts.regular,
  );
  page.drawLine({
    start: { x: MARGIN, y: 788 },
    end: { x: PAGE_WIDTH - MARGIN, y: 788 },
    thickness: 0.5,
    color: COLOR.line,
  });
  return 776;
}

function drawEmployeeCard(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  input: EmployeeReportPdfInput,
  top: number,
): number {
  const height = 64;
  page.drawRectangle({
    x: MARGIN,
    y: top - height,
    width: CONTENT_WIDTH,
    height,
    color: COLOR.soft,
    borderColor: COLOR.line,
    borderWidth: 0.5,
  });

  const left = MARGIN + 14;
  page.drawText(fit(fonts.bold, input.employee.name, 13, CONTENT_WIDTH - 220), {
    x: left,
    y: top - 22,
    size: 13,
    font: fonts.bold,
    color: COLOR.ink,
  });
  page.drawText(fit(fonts.regular, input.employee.email, 9, CONTENT_WIDTH - 220), {
    x: left,
    y: top - 37,
    size: 9,
    font: fonts.regular,
    color: COLOR.muted,
  });

  const meta = [
    input.employee.employeeCode ? `ID ${input.employee.employeeCode}` : null,
    input.employee.department ?? "Tanpa departemen",
  ]
    .filter(Boolean)
    .join("  ·  ");
  page.drawText(fit(fonts.regular, meta, 8.5, CONTENT_WIDTH - 220), {
    x: left,
    y: top - 51,
    size: 8.5,
    font: fonts.regular,
    color: COLOR.muted,
  });

  const printed = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: input.timezone,
  }).format(input.generatedAt);
  drawRight(page, "Dicetak", PAGE_WIDTH - MARGIN - 14, top - 20, 7.5, fonts.regular, COLOR.faint);
  drawRight(page, printed, PAGE_WIDTH - MARGIN - 14, top - 32, 8.5, fonts.regular, COLOR.muted);

  return top - height;
}

function drawSummary(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  input: EmployeeReportPdfInput,
  top: number,
): number {
  const boxes = [
    { label: "Hadir", value: String(input.summary.present) },
    { label: "Terlambat", value: String(input.summary.late) },
    { label: "Alpa", value: String(input.summary.absent) },
    { label: "Izin / Cuti", value: String(input.summary.leave) },
  ];
  const boxWidth = (CONTENT_WIDTH - SUMMARY_BOX_GAP * (boxes.length - 1)) / boxes.length;
  const boxHeight = 46;

  boxes.forEach((box, index) => {
    const x = MARGIN + index * (boxWidth + SUMMARY_BOX_GAP);
    page.drawRectangle({
      x,
      y: top - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: COLOR.white,
      borderColor: COLOR.line,
      borderWidth: 0.5,
    });
    page.drawText(text(box.label.toUpperCase()), {
      x: x + 10,
      y: top - 15,
      size: 7.5,
      font: fonts.bold,
      color: COLOR.faint,
    });
    page.drawText(text(box.value), {
      x: x + 10,
      y: top - 35,
      size: 16,
      font: fonts.bold,
      color: COLOR.ink,
    });
  });

  const summaryLine = [
    `Kehadiran ${input.summary.attendanceRate}%`,
    `Ketepatan ${input.summary.punctualityRate}%`,
    `Total durasi ${formatDuration(input.summary.totalWorkedMinutes)}`,
    `Rata-rata ${formatDuration(input.averageWorkedMinutes)}/hari`,
  ].join("  ·  ");
  page.drawText(text(summaryLine), {
    x: MARGIN,
    y: top - boxHeight - 16,
    size: 8.5,
    font: fonts.regular,
    color: COLOR.muted,
  });

  return top - boxHeight - 28;
}

function drawTableHeader(
  page: PDFPage,
  font: PDFFont,
  top: number,
): number {
  page.drawRectangle({
    x: MARGIN,
    y: top - 22,
    width: CONTENT_WIDTH,
    height: 22,
    color: COLOR.soft,
  });
  for (const column of COLUMNS) {
    page.drawText(text(column.header.toUpperCase()), {
      x: MARGIN + column.x,
      y: top - 14.5,
      size: 7.5,
      font,
      color: COLOR.muted,
    });
  }
  page.drawLine({
    start: { x: MARGIN, y: top - 22 },
    end: { x: PAGE_WIDTH - MARGIN, y: top - 22 },
    thickness: 0.5,
    color: COLOR.line,
  });
  return top - 22;
}

function drawRow(page: PDFPage, font: PDFFont, row: ReportRow, top: number, shaded: boolean): number {
  if (shaded) {
    page.drawRectangle({
      x: MARGIN,
      y: top - ROW_HEIGHT,
      width: CONTENT_WIDTH,
      height: ROW_HEIGHT,
      color: COLOR.soft,
    });
  }

  const values = [
    formatDateKey(row.workDate),
    STATUS_DESCRIPTOR[row.status].label,
    row.checkInTime,
    row.checkOutTime,
    row.lateMinutes > 0 ? `${row.lateMinutes} mnt` : "-",
    formatDuration(row.workedMinutes),
    row.outsideRadius ? "Di luar radius" : "-",
  ];

  const baseline = top - 14;
  COLUMNS.forEach((column, index) => {
    page.drawText(fit(font, values[index], 8.2, column.width), {
      x: MARGIN + column.x,
      y: baseline,
      size: 8.2,
      font,
      color: COLOR.ink,
    });
  });
  page.drawLine({
    start: { x: MARGIN, y: top - ROW_HEIGHT },
    end: { x: PAGE_WIDTH - MARGIN, y: top - ROW_HEIGHT },
    thickness: 0.35,
    color: COLOR.line,
  });
  return top - ROW_HEIGHT;
}

export async function buildEmployeeReportPdf(input: EmployeeReportPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  doc.setTitle(`Laporan absensi ${input.employee.name}`);
  doc.setAuthor(input.organizationName);
  doc.setSubject(
    `Laporan absensi ${input.employee.name} periode ${input.range.fromKey} sampai ${input.range.toKey}`,
  );
  doc.setCreator("Universal Attendance");
  doc.setProducer("Universal Attendance");
  doc.setCreationDate(input.generatedAt);
  doc.setModificationDate(input.generatedAt);

  const pages: PDFPage[] = [];
  const first = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(first);
  drawPageHeader(first, fonts, input);
  let y = drawEmployeeCard(first, fonts, input, 736);
  y = drawSummary(first, fonts, input, y - 16);
  y = drawTableHeader(first, bold, y - 10);

  if (input.rows.length === 0) {
    first.drawText("Belum ada catatan absensi pada periode ini.", {
      x: MARGIN + 12,
      y: y - 24,
      size: 9,
      font: regular,
      color: COLOR.muted,
    });
  } else {
    input.rows.forEach((row, index) => {
      if (y - ROW_HEIGHT < BOTTOM_LIMIT) {
        const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pages.push(page);
        const headerBottom = drawContinuationHeader(page, fonts, input);
        y = drawTableHeader(page, bold, headerBottom);
      }
      y = drawRow(pages[pages.length - 1], regular, row, y, index % 2 === 1);
    });
  }

  pages.forEach((page, index) => {
    drawFooter(page, regular, index + 1, pages.length);
  });

  return doc.save();
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function employeeReportFilename(name: string, fromKey: string, toKey: string): string {
  const slug = slugify(name) || "karyawan";
  return `absensi-${slug}-${fromKey}-sampai-${toKey}.pdf`;
}
