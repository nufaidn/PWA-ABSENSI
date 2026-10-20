import { NextResponse, type NextRequest } from "next/server";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { getReportForExport, type ReportFilters } from "@/lib/dal/reports";
import { ForbiddenError, UnauthorizedError } from "@/lib/dal/auth";
import { buildReportCsv, reportFilename } from "@/lib/reports-csv";

/**
 * CSV export for attendance reports.
 *
 * Authorization is enforced here as well as in the DAL because a Route Handler
 * is an ordinary HTTP endpoint that `proxy.ts` does not gate on role. Without
 * this check, an employee could fetch the whole organisation's attendance by
 * requesting this URL directly.
 */

function readFilters(params: URLSearchParams): ReportFilters {
  const rawStatus = params.get("status") ?? "ALL";
  const allowed = Object.values(AttendanceStatus) as string[];

  return {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    search: params.get("search") || undefined,
    department: params.get("department") || undefined,
    status: (allowed.includes(rawStatus) ? rawStatus : "ALL") as AttendanceStatus | "ALL",
  };
}

export async function GET(request: NextRequest) {
  let csv: string;
  let filename: string;

  try {
    const filters = readFilters(request.nextUrl.searchParams);
    const { rows, range } = await getReportForExport(filters);
    csv = buildReportCsv(rows);
    filename = reportFilename(range.fromKey, range.toKey);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[reports/export] failed", error);
    return NextResponse.json({ error: "Gagal membuat laporan." }, { status: 500 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // An export contains every employee's attendance for the range; it must
      // never be stored by a browser, a proxy or the service worker.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}