"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ConstituencyResult } from "@/types";

interface WinMarginChartProps {
  constituencies: ConstituencyResult[];
}

const BUCKETS = [
  { label: "<2k", min: 0, max: 2000, color: "#DC2626" },
  { label: "2k–5k", min: 2000, max: 5000, color: "#F97316" },
  { label: "5k–15k", min: 5000, max: 15000, color: "#EAB308" },
  { label: "15k–30k", min: 15000, max: 30000, color: "#22C55E" },
  { label: "30k–50k", min: 30000, max: 50000, color: "#3B82F6" },
  { label: ">50k", min: 50000, max: Infinity, color: "#8B5CF6" },
];

export function WinMarginChart({ constituencies }: WinMarginChartProps) {
  const data = useMemo(() => {
    const counts = BUCKETS.map((b) => ({
      ...b,
      count: constituencies.filter(
        (c) => c.margin >= b.min && c.margin < b.max
      ).length,
    }));
    return counts;
  }, [constituencies]);

  if (constituencies.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-5">
      <h3 className="mb-1 text-sm font-semibold text-slate-300">
        Win Margin Distribution
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        Number of constituencies by winning margin
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={36}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1E293B",
              border: "1px solid #334155",
              borderRadius: "8px",
              fontSize: 12,
              color: "#E2E8F0",
            }}
            formatter={(value: number) => [
              `${value} constituencies`,
              "Count",
            ]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.color} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
