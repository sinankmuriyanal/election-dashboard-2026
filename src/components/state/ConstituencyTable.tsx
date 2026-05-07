"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { ConstituencyResult } from "@/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { PartyBadge } from "@/components/ui/PartyBadge";
import { AllianceBadge } from "@/components/ui/AllianceBadge";
import { getAllianceColor } from "@/lib/party-colors";
import { formatVotes, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "name" | "party" | "margin" | "votes" | "number";
type SortDir = "asc" | "desc";

interface ConstituencyTableProps {
  constituencies: ConstituencyResult[];
  stateSlug: string;
}

export function ConstituencyTable({
  constituencies,
  stateSlug,
}: ConstituencyTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [allianceFilter, setAllianceFilter] = useState<string>("all");

  const alliances = useMemo(() => {
    const set = new Set<string>();
    for (const c of constituencies) {
      set.add(c.winner.alliance ?? "Others");
    }
    return ["all", ...Array.from(set).sort()];
  }, [constituencies]);

  const filtered = useMemo(() => {
    let list = constituencies;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.winner.name.toLowerCase().includes(q) ||
          c.winner.party.toLowerCase().includes(q) ||
          c.winner.partyShort.toLowerCase().includes(q)
      );
    }

    if (allianceFilter !== "all") {
      list = list.filter(
        (c) => (c.winner.alliance ?? "Others") === allianceFilter
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "number":
          cmp = a.assemblyNumber - b.assemblyNumber;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "party":
          cmp = a.winner.partyShort.localeCompare(b.winner.partyShort);
          break;
        case "margin":
          cmp = a.margin - b.margin;
          break;
        case "votes":
          cmp = a.winner.votes - b.winner.votes;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [constituencies, search, allianceFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="ml-1 text-slate-600">↕</span>;
    return (
      <span className="ml-1 text-slate-400">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search constituency, candidate, party…"
          className="w-full sm:w-72"
        />
        <div className="flex flex-wrap gap-1.5">
          {alliances.map((a) => (
            <button
              key={a}
              onClick={() => setAllianceFilter(a)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                allianceFilter === a
                  ? "border-slate-400 bg-slate-400/20 text-slate-200"
                  : "border-dashboard-border text-slate-500 hover:border-slate-500 hover:text-slate-300"
              )}
              style={
                allianceFilter === a && a !== "all"
                  ? {
                      borderColor: getAllianceColor(a) + "88",
                      backgroundColor: getAllianceColor(a) + "22",
                      color: getAllianceColor(a),
                    }
                  : {}
              }
            >
              {a === "all" ? "All" : a}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500">
          {filtered.length} of {constituencies.length} seats
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-dashboard-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashboard-border bg-dashboard-surface/60">
              <th
                className="cursor-pointer px-3 py-3 text-left text-xs font-medium text-slate-400 hover:text-slate-200"
                onClick={() => toggleSort("number")}
              >
                # <SortIcon k="number" />
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-left text-xs font-medium text-slate-400 hover:text-slate-200"
                onClick={() => toggleSort("name")}
              >
                Constituency <SortIcon k="name" />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-400">
                Winner
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-left text-xs font-medium text-slate-400 hover:text-slate-200"
                onClick={() => toggleSort("party")}
              >
                Party <SortIcon k="party" />
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-medium text-slate-400 sm:table-cell">
                Alliance
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-right text-xs font-medium text-slate-400 hover:text-slate-200"
                onClick={() => toggleSort("margin")}
              >
                Margin <SortIcon k="margin" />
              </th>
              <th
                className="hidden cursor-pointer px-3 py-3 text-right text-xs font-medium text-slate-400 hover:text-slate-200 md:table-cell"
                onClick={() => toggleSort("votes")}
              >
                Votes <SortIcon k="votes" />
              </th>
              <th className="hidden px-3 py-3 text-center text-xs font-medium text-slate-400 sm:table-cell">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const color = getAllianceColor(c.winner.alliance);
              return (
                <tr
                  key={c.id}
                  className="border-b border-dashboard-border/50 transition-colors hover:bg-dashboard-surface/50"
                  style={{ borderLeftColor: color }}
                >
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {c.assemblyNumber}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/${stateSlug}/${c.id}`}
                      className="font-medium text-slate-200 hover:text-white hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.district && (
                      <p className="text-xs text-slate-500">{c.district}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-slate-300">{c.winner.name}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <PartyBadge partyShort={c.winner.partyShort} />
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <AllianceBadge alliance={c.winner.alliance} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-xs font-semibold text-slate-200">
                      {formatVotes(c.margin)}
                    </span>
                    <p className="text-xs text-slate-500">
                      {formatPct(c.marginPct)}
                    </p>
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono text-xs text-slate-400 md:table-cell">
                    {formatVotes(c.winner.votes)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-center sm:table-cell">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        c.status === "won"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      )}
                    >
                      {c.status === "won" ? "Won" : "Leading"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            {constituencies.length === 0
              ? "No results data yet — run the scraper first."
              : "No constituencies match your search."}
          </div>
        )}
      </div>
    </div>
  );
}
