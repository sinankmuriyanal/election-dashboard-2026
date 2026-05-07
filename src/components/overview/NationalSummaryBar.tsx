import type { StateSummary } from "@/types";
import { SeatBar, type SeatBarSegment } from "@/components/ui/SeatBar";
import { getAllianceColor } from "@/lib/party-colors";

interface NationalSummaryBarProps {
  summaries: StateSummary[];
}

export function NationalSummaryBar({ summaries }: NationalSummaryBarProps) {
  const totalSeats = summaries.reduce((s, st) => s + st.totalSeats, 0);

  // Aggregate alliance seats across all states
  const allianceMap = new Map<string, number>();
  for (const s of summaries) {
    for (const t of s.allianceTallies) {
      allianceMap.set(t.alliance, (allianceMap.get(t.alliance) ?? 0) + t.seats);
    }
  }

  const segments: SeatBarSegment[] = Array.from(allianceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([alliance, seats]) => ({
      label: alliance,
      seats,
      color: getAllianceColor(alliance),
    }));

  const topAlliance = segments[0];

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-5">
        <p className="text-center text-sm text-slate-500">
          National aggregate will appear once results are loaded.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">
          All 5 States — {totalSeats} Total Seats
        </h2>
        {topAlliance && (
          <span className="text-sm text-slate-400">
            Leading:{" "}
            <span
              className="font-bold"
              style={{ color: getAllianceColor(topAlliance.label) }}
            >
              {topAlliance.label} — {topAlliance.seats} seats
            </span>
          </span>
        )}
      </div>

      <SeatBar
        segments={segments}
        totalSeats={totalSeats}
        height="lg"
        showLabels
        className="mb-1"
      />
    </div>
  );
}
