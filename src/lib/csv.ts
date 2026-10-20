/**
 * CSV serialisation following RFC 4180.
 *
 * A UTF-8 BOM is prepended so Excel on an Indonesian or Windows locale does not
 * render accented characters as mojibake when the file is double-clicked.
 */

export const CSV_BOM = "\uFEFF";

/** Quotes a value only when it needs it, and escapes embedded quotes. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  // A leading =, +, - or @ makes Excel treat the cell as a formula, which is a
  // real injection vector for any user-supplied name.
  const needsGuard = /^[=+\-@\t\r]/.test(text);
  const safe = needsGuard ? `'${text}` : text;

  if (/[",\n\r;]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Builds a complete CSV document (BOM included) from a column spec. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  // `;` is not used as a separator because escaping already covers it, and the
  // comma separator is what `text/csv` consumers expect.
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(","),
  );
  return CSV_BOM + [header, ...lines].join("\r\n") + "\r\n";
}

/** A filesystem-safe filename fragment for the `Content-Disposition` header. */
export function csvFilename(base: string, extensionDate: string): string {
  const safeBase = base.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-");
  return `${safeBase || "laporan"}-${extensionDate}.csv`;
}