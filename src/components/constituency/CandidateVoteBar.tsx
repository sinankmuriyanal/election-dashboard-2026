"use client";

import type { CandidateResult } from "@/types";
import { getPartyColor } from "@/lib/party-colors";
import { PartyBadge } from "@/components/ui/PartyBadge";
import { AllianceBadge } from "@/components/ui/AllianceBadge";
import { formatVotesFull, formatPct } from "@/lib/format";

interface CandidateVoteBarProps {
  candidates: CandidateResult[];
  totalVotes: number;
}

export function CandidateVoteBar({
  candidates,
  totalVotes,
}: CandidateVoteBarProps) {
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const maxVotes = sorted[0]?.votes ?? 1;

  return (
    <div className="space-y-3">
      {sorted.map((c, i) => {
        const color = getPartyColor(c.partyShort);
        const barWidth = (c.votes / maxVotes) * 100;

        return (
          <div key={`${c.name}-${i}`} className="group">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {c.isWinner && (
                  <span className="shrink-0 text-xs text-amber-400">★</span>
                )}
                <span
                  className={`truncate text-sm ${
                    c.isWinner ? "font-semibold text-slate-100" : "text-slate-400"
                  }`}
                >
                  {c.name}
                </span>
                <PartyBadge partyShort={c.partyShort} />
                <span className="hidden sm:inline">
                  <AllianceBadge alliance={c.alliance} />
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-mono text-sm font-semibold text-slate-200">
                  {formatVotesFull(c.votes)}
                </span>
                <span className="ml-1.5 text-xs text-slate-500">
                  ({formatPct(c.votePct)})
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-dashboard-surface">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
