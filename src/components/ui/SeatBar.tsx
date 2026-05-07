"use client";

import { cn } from "@/lib/utils";

export interface SeatBarSegment {
  label: string;
  seats: number;
  color: string;
  groupId?: string;
}

interface SeatBarProps {
  segments: SeatBarSegment[];
  totalSeats: number;
  majorityMark?: number;
  height?: "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
}

export function SeatBar({
  segments,
  totalSeats,
  majorityMark,
  height = "md",
  showLabels = false,
  className,
}: SeatBarProps) {
  const heightClass = {
    sm: "h-2",
    md: "h-4",
    lg: "h-6",
  }[height];

  const reported = segments.reduce((s, seg) => s + seg.seats, 0);
  const unreported = totalSeats - reported;

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn("relative flex w-full overflow-hidden rounded-full", heightClass)}
        style={{ backgroundColor: "#1E293B" }}
      >
        {segments.map((seg) => {
          if (seg.seats === 0) return null;
          const width = (seg.seats / totalSeats) * 100;
          return (
            <div
              key={seg.groupId ?? seg.label}
              className="h-full transition-all duration-500"
              style={{ width: `${width}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${seg.seats} seats`}
            />
          );
        })}
        {unreported > 0 && (
          <div
            className="h-full"
            style={{ width: `${(unreported / totalSeats) * 100}%`, backgroundColor: "#1E293B" }}
          />
        )}

        {/* Majority line */}
        {majorityMark && (
          <div
            className="absolute top-0 h-full w-px bg-white/70"
            style={{ left: `${(majorityMark / totalSeats) * 100}%` }}
            title={`Majority: ${majorityMark} seats`}
          />
        )}
      </div>

      {showLabels && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {segments.map((seg) => (
            <span key={seg.label} className="flex items-center gap-1 text-xs text-slate-400">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              {seg.label}:{" "}
              <span className="font-semibold text-slate-200">{seg.seats}</span>
            </span>
          ))}
          {majorityMark && (
            <span className="text-xs text-slate-500">
              Majority: {majorityMark}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
