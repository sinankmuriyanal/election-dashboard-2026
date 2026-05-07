import type { StateSummary } from "@/types";
import { getAllianceColor } from "@/lib/party-colors";
import { formatVotes, formatPct } from "@/lib/format";
import { PartyBadge } from "@/components/ui/PartyBadge";

interface AllianceSummaryGridProps {
  summary: StateSummary;
}

export function AllianceSummaryGrid({ summary }: AllianceSummaryGridProps) {
  if (summary.allianceTallies.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {summary.allianceTallies.map((a) => {
        const color = getAllianceColor(a.alliance);
        const hasMajority = a.seats >= summary.majorityMark;
        return (
          <div
            key={a.alliance}
            className="rounded-xl border bg-dashboard-surface p-4"
            style={{ borderColor: color + "55" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="font-semibold text-slate-200">{a.alliance}</span>
              </div>
              {hasMajority && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                  MAJORITY
                </span>
              )}
            </div>

            <p className="mb-1 text-3xl font-bold" style={{ color }}>
              {a.seats}
              <span className="ml-2 text-base font-normal text-slate-400">
                / {summary.totalSeats} seats
              </span>
            </p>

            <p className="mb-3 text-xs text-slate-500">
              {formatVotes(a.totalVotes)} votes · {formatPct(a.votePct)} share
            </p>

            {/* Top parties in this alliance */}
            <div className="flex flex-wrap gap-1.5">
              {a.parties.slice(0, 6).map((p) => (
                <div key={p.partyShort} className="flex items-center gap-1">
                  <PartyBadge partyShort={p.partyShort} size="sm" />
                  <span className="text-xs text-slate-400">{p.seats}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
