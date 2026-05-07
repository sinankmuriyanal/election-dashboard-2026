import type { StateSummary } from "@/types";
import { SeatBar, type SeatBarSegment } from "@/components/ui/SeatBar";
import { getAllianceColor } from "@/lib/party-colors";
import { formatVotes, formatPct } from "@/lib/format";
import { LastUpdated } from "@/components/ui/LastUpdated";

interface StateHeroBarProps {
  summary: StateSummary;
}

export function StateHeroBar({ summary }: StateHeroBarProps) {
  const segments: SeatBarSegment[] = summary.allianceTallies.map((a) => ({
    label: a.alliance,
    seats: a.seats,
    color: getAllianceColor(a.alliance),
  }));

  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
            {summary.stateName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {summary.totalSeats} Assembly Seats · Majority: {summary.majorityMark}
          </p>
        </div>
        <LastUpdated isoDate={summary.lastUpdated} />
      </div>

      <SeatBar
        segments={segments}
        totalSeats={summary.totalSeats}
        majorityMark={summary.majorityMark}
        height="lg"
        className="mb-4"
      />

      {summary.allianceTallies.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.allianceTallies.slice(0, 4).map((a) => {
            const color = getAllianceColor(a.alliance);
            const hasMajority = a.seats >= summary.majorityMark;
            return (
              <div
                key={a.alliance}
                className="rounded-lg border bg-dashboard-bg/60 p-3"
                style={{ borderColor: color + "44" }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-semibold text-slate-300">
                    {a.alliance}
                  </span>
                  {hasMajority && (
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                      MAJORITY
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-2xl font-bold" style={{ color }}>
                  {a.seats}
                </p>
                <p className="text-xs text-slate-500">
                  {formatPct(a.votePct)} of votes •{" "}
                  {formatVotes(a.totalVotes)} votes
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500 py-4">
          Run the scraper to populate results.
        </p>
      )}
    </div>
  );
}
