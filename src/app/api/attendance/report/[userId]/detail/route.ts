import { NextResponse, type NextRequest } from "next/server";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  assertRole,
} from "@/lib/dal/auth";
import { getEmployeeReport } from "@/lib/dal/reports";
import type { EmployeeReportDetail } from "@/lib/report-types";

/**
 * JSON detail for one employee, used by the report dialog.
 *
 * Kept separate from the PDF route so the browser can open the detail without
 * navigating away from a filtered report list. `assertRole` is repeated here
 * because `proxy.ts` does not gate Route Handlers on role.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await assertRole("ADMIN");
    const { userId } = await context.params;
    const params = request.nextUrl.searchParams;

    const report = await getEmployeeReport(userId, {
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
    });

    const payload: EmployeeReportDetail = {
      employee: report.employee,
      range: report.range,
      summary: report.summary,
      averageWorkedMinutes: report.averageWorkedMinutes,
      rows: report.rows.map((row) => ({
        id: row.id,
        dateLabel: row.dateLabel,
        status: row.status,
        checkInTime: row.checkInTime,
        checkOutTime: row.checkOutTime,
        lateMinutes: row.lateMinutes,
        workedMinutes: row.workedMinutes,
        outsideRadius: row.outsideRadius,
        distanceMeters: row.distanceMeters,
      })),
    };

    return NextResponse.json(payload, {
      headers: {
        // Attendance detail is personal data and must not be cached.
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[reports/detail] failed", error);
    return NextResponse.json(
      { error: "Gagal memuat detail absensi." },
      { status: 500 },
    );
  }
}
