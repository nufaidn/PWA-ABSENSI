import { NextResponse, type NextRequest } from "next/server";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  assertRole,
} from "@/lib/dal/auth";
import { getEmployeeReport } from "@/lib/dal/reports";
import { getLocationPolicy } from "@/lib/dal/settings";
import { buildEmployeeReportPdf, employeeReportFilename } from "@/lib/reports-pdf";

/**
 * Per-employee attendance report as a downloadable PDF.
 *
 * The route handler re-checks the ADMIN role because `proxy.ts` does not gate
 * Route Handlers on role; without it an employee could fetch a colleague's
 * report by guessing a user id.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await assertRole("ADMIN");
    const { userId } = await context.params;
    const params = request.nextUrl.searchParams;
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";

    const [report, policy] = await Promise.all([
      getEmployeeReport(userId, { from, to }),
      getLocationPolicy(),
    ]);

    const pdf = await buildEmployeeReportPdf({
      organizationName: policy.organizationName,
      employee: report.employee,
      range: report.range,
      summary: report.summary,
      averageWorkedMinutes: report.averageWorkedMinutes,
      rows: report.rows,
      generatedAt: new Date(),
      timezone: policy.timezone,
    });

    const filename = employeeReportFilename(
      report.employee.name,
      report.range.fromKey,
      report.range.toKey,
    );

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Reports contain personal attendance data and must not be cached.
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
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
    console.error("[reports/pdf] failed", error);
    return NextResponse.json({ error: "Gagal membuat laporan PDF." }, { status: 500 });
  }
}
