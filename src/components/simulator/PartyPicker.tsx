"use client";

import { useState } from "react";
import type { SimGroup, SimParty } from "@/types";
import { getAllianceColor } from "@/lib/party-colors";
import { cn } from "@/lib/utils";

const GROUP_COLORS = [
  "#FF6B35", "#19AAED", "#DC2626", "#16A34A",
  "#7C3AED", "#D97706", "#EC4899", "#14B8A6",
];

interface PartyPickerProps {
  parties: SimParty[];
  groups: SimGroup[];
  onGroupsChange: (groups: SimGroup[]) => void;
}

export function PartyPicker({ parties, groups, onGroupsChange }: PartyPickerProps) {
  const [newGroupName, setNewGroupName] = useState("");

  const partyToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const p of g.parties) partyToGroup.set(p, g.id);
  }

  // Group parties by their current alliance for display
  const byAlliance = new Map<string, SimParty[]>();
  for (const p of parties) {
    const key = p.alliance ?? "Others";
    if (!byAlliance.has(key)) byAlliance.set(key, []);
    byAlliance.get(key)!.push(p);
  }

  function addGroup() {
    if (!newGroupName.trim()) return;
    const colorIdx = groups.length % GROUP_COLORS.length;
    const newGroup: SimGroup = {
      id: `group-${Date.now()}`,
      label: newGroupName.trim(),
      parties: [],
      color: GROUP_COLORS[colorIdx],
    };
    onGroupsChange([...groups, newGroup]);
    setNewGroupName("");
  }

  function removeGroup(groupId: string) {
    onGroupsChange(groups.filter((g) => g.id !== groupId));
  }

  function renameGroup(groupId: string, label: string) {
    onGroupsChange(groups.map((g) => (g.id === groupId ? { ...g, label } : g)));
  }

  function assignParty(partyShort: string, targetGroupId: string | null) {
    onGroupsChange(
      groups.map((g) => {
        const filtered = g.parties.filter((p) => p !== partyShort);
        if (g.id === targetGroupId) {
          return { ...g, parties: [...filtered, partyShort] };
        }
        return { ...g, parties: filtered };
      })
    );
  }

  return (
    <div className="space-y-4">
      {/* Groups */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Your Groups
        </h3>
        <div className="space-y-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-lg border p-3"
              style={{ borderColor: g.color + "55", backgroundColor: g.color + "0D" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: g.color }}
                />
                <input
                  type="text"
                  value={g.label}
                  onChange={(e) => renameGroup(g.id, e.target.value)}
                  className="flex-1 bg-transparent text-sm font-semibold text-slate-200 outline-none"
                />
                <button
                  onClick={() => removeGroup(g.id)}
                  className="text-xs text-slate-600 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.parties.length === 0 ? (
                  <span className="text-xs text-slate-600">No parties assigned</span>
                ) : (
                  g.parties.map((p) => (
                    <span
                      key={p}
                      className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold transition-opacity hover:opacity-70"
                      style={{
                        backgroundColor: g.color + "28",
                        color: g.color,
                        border: `1px solid ${g.color}55`,
                      }}
                      onClick={() => assignParty(p, null)}
                      title="Click to unassign"
                    >
                      {p} ×
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add group */}
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
            placeholder="New group name…"
            className="flex-1 rounded-lg border border-dashboard-border bg-dashboard-surface px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400"
          />
          <button
            onClick={addGroup}
            disabled={!newGroupName.trim()}
            className="rounded-lg border border-dashboard-border bg-dashboard-surface px-3 py-1.5 text-sm text-slate-300 hover:border-slate-400 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Party list */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Assign Parties
        </h3>
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {Array.from(byAlliance.entries()).map(([alliance, ps]) => (
            <div key={alliance}>
              <p
                className="mb-1.5 text-xs font-medium"
                style={{ color: getAllianceColor(alliance) }}
              >
                {alliance}
              </p>
              <div className="space-y-1">
                {ps.map((p) => {
                  const assignedGroupId = partyToGroup.get(p.partyShort);
                  const assignedGroup = groups.find((g) => g.id === assignedGroupId);
                  return (
                    <div
                      key={p.partyShort}
                      className="flex items-center justify-between rounded-lg border border-dashboard-border bg-dashboard-surface px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-300">
                          {p.partyShort}
                        </span>
                        <span className="text-xs text-slate-500">
                          {p.party}
                        </span>
                        {p.originalSeats > 0 && (
                          <span className="rounded bg-slate-700 px-1 py-0.5 text-[10px] text-slate-300">
                            {p.originalSeats} seats
                          </span>
                        )}
                      </div>
                      <select
                        value={assignedGroupId ?? ""}
                        onChange={(e) =>
                          assignParty(p.partyShort, e.target.value || null)
                        }
                        className="rounded border border-dashboard-border bg-dashboard-bg px-2 py-1 text-xs text-slate-300 outline-none"
                      >
                        <option value="">Unassigned</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
