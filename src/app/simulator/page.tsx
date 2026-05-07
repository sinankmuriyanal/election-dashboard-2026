"use client";

import { useEffect, useState, useCallback } from "react";
import type { ConstituencyResult, SimGroup, SimulationResult, SimParty } from "@/types";
import { runSimulation, derivePartyList, getDefaultGroups } from "@/lib/simulator";
import { getPartyColor } from "@/lib/party-colors";
import { PartyPicker } from "@/components/simulator/PartyPicker";
import { SimulatorResultsGrid } from "@/components/simulator/SimulatorResultsGrid";
import { FlippedSeatsList } from "@/components/simulator/FlippedSeatsList";

export default function SimulatorPage() {
  const [constituencies, setConstituencies] = useState<ConstituencyResult[]>([]);
  const [groups, setGroups] = useState<SimGroup[]>([]);
  const [parties, setParties] = useState<SimParty[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"results" | "flipped">("results");

  // Load all constituency data on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const slugs = ["bihar", "west_bengal", "assam", "kerala", "tamil_nadu"];
        const arrays = await Promise.all(
          slugs.map((s) =>
            fetch(`/data/${s}/results.json`, { cache: "force-cache" })
              .then((r) => r.json())
              .catch(() => [])
          )
        );
        const all: ConstituencyResult[] = arrays.flat();
        setConstituencies(all);

        const partyList = derivePartyList(all);
        const partyMeta: SimParty[] = partyList.map((p) => ({
          partyShort: p.partyShort,
          party: p.party,
          alliance: p.alliance,
          originalSeats: p.seats,
          totalVotes: p.totalVotes,
          color: getPartyColor(p.partyShort),
        }));
        setParties(partyMeta);

        const defaultGroups = getDefaultGroups(all);
        setGroups(defaultGroups);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Auto-run simulation when groups change
  const runSim = useCallback(() => {
    if (constituencies.length === 0 || groups.length === 0) return;
    const sim = runSimulation(constituencies, groups);
    setResult(sim);
  }, [constituencies, groups]);

  useEffect(() => {
    if (!loading) runSim();
  }, [groups, loading, runSim]);

  const flippedSeats = result?.constituencyResults.filter((r) => r.flipped) ?? [];

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
            Alliance Simulator
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Merge parties into alliances and see how seat counts change across all 5 states
          </p>
        </div>
        {result && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-400">
            {result.totalFlipped} seats would flip
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
            <p className="text-sm">Loading election data…</p>
          </div>
        </div>
      ) : constituencies.length === 0 ? (
        <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-8 text-center">
          <p className="text-slate-400">
            No constituency data found. Run the Python scraper first.
          </p>
          <pre className="mt-3 rounded bg-dashboard-bg p-3 text-left text-xs text-slate-400">
            cd scripts{"\n"}
            pip install -r requirements.txt{"\n"}
            python scrape_eci.py
          </pre>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Left: Party picker */}
          <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">
              Configure Alliances
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Groups auto-update results. Unassigned parties keep their original result.
            </p>
            <PartyPicker
              parties={parties}
              groups={groups}
              onGroupsChange={setGroups}
            />
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {(["results", "flipped"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-dashboard-surface text-slate-100"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab === "results"
                    ? "Seat Results"
                    : `Flipped Seats (${flippedSeats.length})`}
                </button>
              ))}
            </div>

            {result && activeTab === "results" && (
              <SimulatorResultsGrid result={result} />
            )}

            {result && activeTab === "flipped" && (
              <FlippedSeatsList flipped={flippedSeats} />
            )}

            {!result && !loading && (
              <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-8 text-center text-sm text-slate-500">
                Add groups and assign parties to see simulated results.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
