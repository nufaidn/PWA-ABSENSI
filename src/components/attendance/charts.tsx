"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STATUS_DESCRIPTOR } from "@/lib/attendance/time";
import type { AttendanceStatus } from "@/lib/domain";

/**
 * Chart wrappers.
 *
 * Charts are Client Components because they need a measured DOM width. All
 * aggregation happens on the server, so the browser only paints attendance
 * figures that were already computed authoritatively.
 */

export interface TrendDatum {
  dateKey: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  other: number;
}

const AXIS_STYLE = { fontSize: 11, fill: "oklch(0.545 0.028 258)" } as const;

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid oklch(0.923 0.008 250)",
  fontSize: 12,
  boxShadow: "0 1px 3px oklch(0.208 0.028 264 / 0.08)",
} as const;

export function AttendanceTrendChart({ data }: { data: TrendDatum[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-[13px] text-muted-foreground">
        Tidak ada data pada rentang ini.
      </p>
    );
  }

  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(0.923 0.008 250)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip cursor={{ fill: "oklch(0.96 0.02 252)" }} contentStyle={TOOLTIP_STYLE} />
          {/* Stacked so a day's totals read as one column rather than three. */}
          <Bar dataKey="present" name="Hadir" stackId="day" fill="oklch(0.596 0.128 163.2)" />
          <Bar dataKey="late" name="Terlambat" stackId="day" fill="oklch(0.666 0.156 76.4)" />
          <Bar
            dataKey="absent"
            name="Alpa"
            stackId="day"
            fill="oklch(0.577 0.222 27.3)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DistributionDatum {
  status: AttendanceStatus;
  value: number;
}

const CHART_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "oklch(0.596 0.128 163.2)",
  LATE: "oklch(0.666 0.156 76.4)",
  ABSENT: "oklch(0.577 0.222 27.3)",
  INCOMPLETE: "oklch(0.62 0.13 234)",
  LEAVE: "oklch(0.72 0.03 258)",
  HOLIDAY: "oklch(0.86 0.01 258)",
};

export function StatusDistributionChart({ data }: { data: DistributionDatum[] }) {
  const visible = data.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-[13px] text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="status"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {visible.map((item) => (
                <Cell key={item.status} fill={CHART_COLORS[item.status]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, _name, item) => {
                const count = Number(value ?? 0);
                const status = (item?.payload as DistributionDatum | undefined)?.status;
                return [
                  `${count} hari · ${total > 0 ? Math.round((count / total) * 100) : 0}%`,
                  status ? STATUS_DESCRIPTOR[status].label : "",
                ];
              }}
              labelFormatter={() => ""}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="tabular text-xl font-semibold tracking-tight text-foreground">
              {total}
            </p>
            <p className="text-[11px] text-muted-foreground">catatan</p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {visible.map((item) => (
          <li key={item.status} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: CHART_COLORS[item.status] }}
                aria-hidden
              />
              {STATUS_DESCRIPTOR[item.status].label}
            </span>
            <span className="tabular text-[12.5px] font-medium text-foreground">
              {item.value}
              <span className="ml-1.5 text-muted-foreground">
                {Math.round((item.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ranked bars of average daily worked hours.
 *
 * Plain divs rather than a chart library: this is a single horizontal bar per
 * row, so a charting dependency would add weight for no benefit.
 */
export function WorkedHoursChart({
  data,
}: {
  data: Array<{ key: string; name: string; hours: number; label: string }>;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((item) => item.hours), 1);

  return (
    <ul className="space-y-3.5">
      {data.map((item) => (
        <li key={item.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px] text-foreground">{item.name}</span>
            <span className="tabular shrink-0 text-[12.5px] font-medium text-foreground">
              {item.label}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(3, (item.hours / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}