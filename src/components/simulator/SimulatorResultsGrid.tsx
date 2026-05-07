"use client";

import type { SimulationResult } from "@/types";
import { SeatBar, type SeatBarSegment } from "@/components/ui/SeatBar";
import { cn } from "@/lib/utils";

interface SimulatorResultsGridProps {
  result: SimulationResult;
}

export function SimulatorResultsGrid({ result }: SimulatorResultsGridProps) {
  // Combined aggregate across all states
  const totalSeats = result.stateTallies.reduce((s, t) => s + t.totalSeats, 0);
  const combinedGroupMap = new Map<string, { groupId: string; label: string; color: string; seats: number }>();

  for (const t of result.stateTallies) {
    for (const g of t.groupTallies) {
      const existing = combinedGroupMap.get(g.groupId);
      if (existing) {
        existing.seats += g.seats;
      } else {
        combinedGroupMap.set(g.groupId, { ...g });
      }
    }
  }

  const combinedGroups = Array.from(combinedGroupMap.values()).sort(
    (a, b) => b.seats - a.seats
  );

  const segments: SeatBarSegment[] = combinedGroups.map((g) => ({
    label: g.label,
    seats: g.seats,
    color: g.color,
  }));

  return (
    <div className="space-y-4">
      {/* National aggregate */}
      <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">
            Simulated — All 5 States ({totalSeats} seats)
          </h3>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-400">
            {result.totalFlipped} seats flipped
          </span>
        </div>
        <SeatBar
          segments={segments}
          totalSeats={totalSeats}
          height="lg"
          showLabels
        />
      </div>

      {/* Per-state breakdown */}
      <div className="overflow-x-auto rounded-xl border border-dashboard-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashboard-border bg-dashboard-surface/60">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">
                State
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-slate-400">
                Total
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-slate-400">
                Majority
              </th>
              {combinedGroups.map((g) => (
                <th
                  key={g.groupId}
                  className="px-3 py-3 text-right text-xs font-medium"
                  style={{ color: g.color }}
                >
                  {g.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.stateTallies.map((t) => {
              const seatsForGroup = (gid: string) =>
                t.groupTallies.find((g) => g.groupId === gid)?.seats ?? 0;
              const winner = t.groupTallies[0];
              return (
                <tr
                  key={t.state}
                  className="border-b border-dashboard-border/50 hover:bg-dashboard-surface/30"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-200">{t.stateName}</span>
                    {winner && winner.seats >= t.majorityMark && (
                      <span
                        className="ml-2 text-[10px] font-semibold"
                        style={{ color: winner.color }}
                      >
                        {winner.label} MAJORITY
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-400">
                    {t.totalSeats}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-400">
                    {t.majorityMark}
                  </td>
                  {combinedGroups.map((g) => {
                    const seats = seatsForGroup(g.groupId);
                    const hasMaj = seats >= t.majorityMark;
                    return (
                      <td
                        key={g.groupId}
                        className={cn(
                          "px-3 py-3 text-right font-mono font-semibold",
                          hasMaj ? "text-slate-100" : "text-slate-400"
                        )}
                        style={hasMaj ? { color: g.color } : {}}
                      >
                        {seats}
                        {hasMaj && " ✓"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
