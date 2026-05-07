"use client";

import { useState, useMemo } from "react";
import type { SimConstituencyResult } from "@/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { getAllianceColor } from "@/lib/party-colors";
import { STATE_NAME_MAP } from "@/lib/state-metadata";
import type { StateSlug } from "@/types";
import { formatVotes } from "@/lib/format";

interface FlippedSeatsListProps {
  flipped: SimConstituencyResult[];
}

export function FlippedSeatsList({ flipped }: FlippedSeatsListProps) {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");

  const states = useMemo(() => {
    const set = new Set(flipped.map((f) => f.state));
    return Array.from(set);
  }, [flipped]);

  const filtered = useMemo(() => {
    let list = flipped;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.constituencyName.toLowerCase().includes(q) ||
          f.originalWinnerParty.toLowerCase().includes(q) ||
          f.simulatedWinnerLabel.toLowerCase().includes(q)
      );
    }
    if (stateFilter !== "all") {
      list = list.filter((f) => f.state === stateFilter);
    }
    return list;
  }, [flipped, search, stateFilter]);

  if (flipped.length === 0) {
    return (
      <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-6 text-center text-sm text-slate-500">
        No seats flipped under this configuration.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search flipped seats…"
          className="w-full sm:w-64"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStateFilter("all")}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              stateFilter === "all"
                ? "border-slate-400 bg-slate-400/20 text-slate-200"
                : "border-dashboard-border text-slate-500"
            }`}
          >
            All states
          </button>
          {states.map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                stateFilter === s
                  ? "border-slate-400 bg-slate-400/20 text-slate-200"
                  : "border-dashboard-border text-slate-500"
              }`}
            >
              {STATE_NAME_MAP[s as StateSlug]}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} seats</span>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-xl border border-dashboard-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 border-b border-dashboard-border bg-dashboard-surface">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-slate-400">Constituency</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-400">Was</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-400">Now</th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-400">New Margin</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr
                key={f.constituencyId}
                className="border-b border-dashboard-border/40 hover:bg-dashboard-surface/40"
              >
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-200">{f.constituencyName}</span>
                  <p className="text-slate-500">{STATE_NAME_MAP[f.state as StateSlug]}</p>
                </td>
                <td className="px-3 py-2">
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold"
                    style={{
                      backgroundColor: getAllianceColor(f.originalWinnerAlliance) + "22",
                      color: getAllianceColor(f.originalWinnerAlliance),
                      border: `1px solid ${getAllianceColor(f.originalWinnerAlliance)}44`,
                    }}
                  >
                    {f.originalWinnerParty}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: f.simulatedWinnerColor + "22",
                      color: f.simulatedWinnerColor,
                      border: `1px solid ${f.simulatedWinnerColor}44`,
                    }}
                  >
                    {f.simulatedWinnerLabel}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {formatVotes(f.simulatedMargin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
