import type {
  ConstituencyResult,
  SimConstituencyResult,
  SimGroup,
  SimStateTally,
  SimulationResult,
  StateSlug,
} from "@/types";
import { getAllianceColor, getPartyColor } from "@/lib/party-colors";
import { STATE_METADATA } from "@/lib/state-metadata";

export function runSimulation(
  constituencies: ConstituencyResult[],
  groups: SimGroup[]
): SimulationResult {
  // Step 1: Build party → groupId lookup
  const partyGroupMap = new Map<string, string>();
  for (const group of groups) {
    for (const partyShort of group.parties) {
      partyGroupMap.set(partyShort, group.id);
    }
  }

  const groupById = new Map(groups.map((g) => [g.id, g]));

  // Helper: get or create an implicit single-party group label/color
  function getImplicitGroup(partyShort: string): {
    id: string;
    label: string;
    color: string;
  } {
    return {
      id: `__party__${partyShort}`,
      label: partyShort,
      color: getPartyColor(partyShort),
    };
  }

  function resolveGroup(partyShort: string): {
    id: string;
    label: string;
    color: string;
  } {
    const groupId = partyGroupMap.get(partyShort);
    if (groupId) {
      const g = groupById.get(groupId)!;
      return { id: g.id, label: g.label, color: g.color };
    }
    return getImplicitGroup(partyShort);
  }

  // Step 2: Compute simulated result per constituency
  const constituencyResults: SimConstituencyResult[] = [];

  for (const c of constituencies) {
    // Group votes: use candidate name as key for IND to avoid merging independents
    const groupVotes = new Map<string, number>();

    for (const candidate of c.candidates) {
      const effectiveParty =
        candidate.partyShort === "IND"
          ? `IND:${candidate.name}`
          : candidate.partyShort;

      const groupId =
        candidate.partyShort === "IND"
          ? `__ind__${candidate.name}`
          : (partyGroupMap.get(candidate.partyShort) ??
            `__party__${candidate.partyShort}`);

      groupVotes.set(groupId, (groupVotes.get(groupId) ?? 0) + candidate.votes);
      void effectiveParty; // used for key derivation above
    }

    // Find winning group
    let winGroupId = "";
    let winVotes = -1;
    let secondVotes = -1;

    for (const [gid, votes] of groupVotes) {
      if (votes > winVotes) {
        secondVotes = winVotes;
        winVotes = votes;
        winGroupId = gid;
      } else if (votes > secondVotes) {
        secondVotes = votes;
      }
    }

    // Resolve winning group metadata
    let winLabel = "";
    let winColor = "";

    if (winGroupId.startsWith("__party__")) {
      const ps = winGroupId.replace("__party__", "");
      winLabel = ps;
      winColor = getPartyColor(ps);
    } else if (winGroupId.startsWith("__ind__")) {
      winLabel = "IND";
      winColor = getPartyColor("IND");
    } else {
      const g = groupById.get(winGroupId)!;
      winLabel = g.label;
      winColor = g.color;
    }

    // Determine original winner's group
    const origGroupId =
      partyGroupMap.get(c.winner.partyShort) ??
      `__party__${c.winner.partyShort}`;

    const flipped = origGroupId !== winGroupId;

    constituencyResults.push({
      constituencyId: c.id,
      constituencyName: c.name,
      state: c.state,
      district: c.district,
      originalWinnerParty: c.winner.partyShort,
      originalWinnerAlliance: c.winner.alliance,
      simulatedWinnerGroupId: winGroupId,
      simulatedWinnerLabel: winLabel,
      simulatedWinnerColor: winColor,
      topGroupVotes: winVotes,
      runnerUpGroupVotes: secondVotes,
      simulatedMargin: winVotes - secondVotes,
      flipped,
    });
  }

  // Step 3: Aggregate per state
  const stateMap = new Map<StateSlug, SimStateTally>();

  for (const meta of STATE_METADATA) {
    stateMap.set(meta.slug, {
      state: meta.slug,
      stateName: meta.name,
      totalSeats: meta.totalSeats,
      majorityMark: meta.majorityMark,
      groupTallies: [],
    });
  }

  // Count seats per group per state
  const stateSeatMap = new Map<StateSlug, Map<string, number>>();
  const stateGroupMeta = new Map<StateSlug, Map<string, { label: string; color: string }>>();

  for (const r of constituencyResults) {
    if (!stateSeatMap.has(r.state)) stateSeatMap.set(r.state, new Map());
    if (!stateGroupMeta.has(r.state)) stateGroupMeta.set(r.state, new Map());

    const seatMap = stateSeatMap.get(r.state)!;
    const metaMap = stateGroupMeta.get(r.state)!;

    seatMap.set(r.simulatedWinnerGroupId, (seatMap.get(r.simulatedWinnerGroupId) ?? 0) + 1);
    metaMap.set(r.simulatedWinnerGroupId, {
      label: r.simulatedWinnerLabel,
      color: r.simulatedWinnerColor,
    });
  }

  const stateTallies: SimStateTally[] = [];

  for (const [stateSlug, seatMap] of stateSeatMap) {
    const tally = stateMap.get(stateSlug)!;
    const metaMap = stateGroupMeta.get(stateSlug)!;

    const groupTallies = Array.from(seatMap.entries())
      .map(([groupId, seats]) => ({
        groupId,
        label: metaMap.get(groupId)?.label ?? groupId,
        seats,
        color: metaMap.get(groupId)?.color ?? "#94A3B8",
      }))
      .sort((a, b) => b.seats - a.seats);

    stateTallies.push({ ...tally, groupTallies });
  }

  const totalFlipped = constituencyResults.filter((r) => r.flipped).length;

  return {
    groups,
    stateTallies,
    constituencyResults,
    totalFlipped,
  };
}

// Derive all distinct parties across constituencies, with seat counts
export function derivePartyList(constituencies: ConstituencyResult[]) {
  const partyMap = new Map<
    string,
    { party: string; partyShort: string; alliance: string | null; seats: number; totalVotes: number }
  >();

  for (const c of constituencies) {
    for (const cand of c.candidates) {
      if (!partyMap.has(cand.partyShort)) {
        partyMap.set(cand.partyShort, {
          party: cand.party,
          partyShort: cand.partyShort,
          alliance: cand.alliance,
          seats: 0,
          totalVotes: 0,
        });
      }
      const entry = partyMap.get(cand.partyShort)!;
      entry.totalVotes += cand.votes;
      if (cand.isWinner) entry.seats++;
    }
  }

  return Array.from(partyMap.values())
    .filter((p) => p.partyShort !== "IND" && p.partyShort !== "NOTA")
    .sort((a, b) => b.seats - a.seats || b.totalVotes - a.totalVotes);
}

// Default preset groups that make political sense
export function getDefaultGroups(
  constituencies: ConstituencyResult[]
): SimGroup[] {
  const parties = derivePartyList(constituencies);
  const allianceGroupMap = new Map<string, SimGroup>();
  const ALLIANCE_COLORS_MAP: Record<string, string> = {
    NDA: "#FF6B35",
    INDIA: "#19AAED",
    LDF: "#DC2626",
    UDF: "#16A34A",
    "AIADMK-Alliance": "#7C3AED",
    "AGP-Alliance": "#D97706",
  };

  for (const p of parties) {
    const key = p.alliance ?? "Others";
    if (!allianceGroupMap.has(key)) {
      allianceGroupMap.set(key, {
        id: `group-${key}`,
        label: key === "Others" ? "Others / IND" : key,
        parties: [],
        color: ALLIANCE_COLORS_MAP[key] ?? getAllianceColor(key),
      });
    }
    allianceGroupMap.get(key)!.parties.push(p.partyShort);
  }

  return Array.from(allianceGroupMap.values());
}
