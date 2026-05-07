import Link from "next/link";
import type { StateSummary } from "@/types";
import { SeatBar, type SeatBarSegment } from "@/components/ui/SeatBar";
import { getAllianceColor } from "@/lib/party-colors";
import { formatVotes, formatPct } from "@/lib/format";
import { STATE_METADATA } from "@/lib/state-metadata";

interface StateCardProps {
  summary: StateSummary;
}

export function StateCard({ summary }: StateCardProps) {
  const meta = STATE_METADATA.find((m) => m.slug === summary.state);

  const segments: SeatBarSegment[] = summary.allianceTallies
    .slice(0, 5)
    .map((a) => ({
      label: a.alliance,
      seats: a.seats,
      color: getAllianceColor(a.alliance),
    }));

  const totalReported = summary.seatsReported;
  const isComplete = totalReported >= summary.totalSeats;
  const leader = summary.allianceTallies[0];

  return (
    <Link
      href={`/${summary.state}`}
      className="group block rounded-xl border border-dashboard-border bg-dashboard-surface p-5 transition-all hover:border-slate-500 hover:bg-dashboard-surface-2"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100 group-hover:text-white">
            {summary.stateName}
          </h2>
          <p className="text-xs text-slate-500">
            {meta?.nameLocal} • {summary.totalSeats} seats
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isComplete
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {isComplete
            ? "Results Declared"
            : `${totalReported}/${summary.totalSeats} reported`}
        </span>
      </div>

      <SeatBar
        segments={segments}
        totalSeats={summary.totalSeats}
        majorityMark={summary.majorityMark}
        height="md"
        className="mb-3"
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Majority:{" "}
          <span className="text-slate-300">{summary.majorityMark}</span>
        </span>
        {leader && (
          <span>
            Leading:{" "}
            <span
              className="font-semibold"
              style={{ color: getAllianceColor(leader.alliance) }}
            >
              {leader.alliance} {leader.seats}
            </span>
          </span>
        )}
      </div>

      {summary.allianceTallies.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dashboard-border pt-3">
          {summary.allianceTallies.slice(0, 4).map((a) => (
            <div key={a.alliance} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: getAllianceColor(a.alliance) }}
                />
                {a.alliance}
              </span>
              <span className="text-xs font-semibold text-slate-200">
                {a.seats}
                <span className="ml-1 text-slate-500">
                  ({formatPct(a.votePct, 0)})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.allianceTallies.length === 0 && (
        <div className="mt-3 rounded-lg border border-dashboard-border bg-dashboard-bg/50 px-3 py-4 text-center text-xs text-slate-500">
          Results pending — run scraper to populate data
        </div>
      )}
    </Link>
  );
}
