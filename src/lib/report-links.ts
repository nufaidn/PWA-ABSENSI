/** URL helpers shared by the report list, the employee detail page and the PDF route. */

function rangeParams(fromKey: string, toKey: string): string {
  return new URLSearchParams({ from: fromKey, to: toKey }).toString();
}

/** Download URL for one employee's PDF report. */
export function employeeReportApiHref(userId: string, fromKey: string, toKey: string): string {
  return `/api/attendance/report/${encodeURIComponent(userId)}?${rangeParams(fromKey, toKey)}`;
}

/** In-app detail page for one employee over the active range. */
export function employeeReportDetailHref(userId: string, fromKey: string, toKey: string): string {
  return `/admin/reports/${encodeURIComponent(userId)}?${rangeParams(fromKey, toKey)}`;
}

/** Back to the organisation-wide report, keeping the date range. */
export function reportListHref(fromKey: string, toKey: string): string {
  return `/admin/reports?${rangeParams(fromKey, toKey)}`;
}
