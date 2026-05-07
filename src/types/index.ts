// ── Core enums ────────────────────────────────────────────────────────────────

export type StateSlug =
  | "bihar"
  | "west_bengal"
  | "assam"
  | "kerala"
  | "tamil_nadu";

export type ResultStatus = "won" | "leading" | "result_awaited";

// ── Candidate (inside a constituency result) ──────────────────────────────────

export interface CandidateResult {
  name: string;
  party: string;
  partyShort: string;
  alliance: string | null;
  votes: number;
  votePct: number;
  isWinner: boolean;
}

// ── Single constituency result ────────────────────────────────────────────────

export interface ConstituencyResult {
  id: string;
  assemblyNumber: number;
  name: string;
  state: StateSlug;
  district: string;
  winner: CandidateResult;
  runnerUp: CandidateResult;
  margin: number;
  marginPct: number;
  totalVotes: number;
  turnout: number | null;
  status: ResultStatus;
  candidates: CandidateResult[];
}

// ── State-level aggregated data ───────────────────────────────────────────────

export interface PartyTally {
  party: string;
  partyShort: string;
  alliance: string | null;
  seats: number;
  totalVotes: number;
  votePct: number;
  color: string;
}

export interface AllianceTally {
  alliance: string;
  seats: number;
  totalVotes: number;
  votePct: number;
  color: string;
  parties: PartyTally[];
}

export interface StateSummary {
  state: StateSlug;
  stateName: string;
  totalSeats: number;
  seatsReported: number;
  seatsLeading: number;
  seatsWon: number;
  majorityMark: number;
  lastUpdated: string;
  allianceTallies: AllianceTally[];
  partyTallies: PartyTally[];
}

// ── Full state data ───────────────────────────────────────────────────────────

export interface StateData {
  summary: StateSummary;
  constituencies: ConstituencyResult[];
}

// ── Static metadata ───────────────────────────────────────────────────────────

export interface StateMetadata {
  slug: StateSlug;
  name: string;
  nameLocal: string;
  totalSeats: number;
  majorityMark: number;
  capitalCity: string;
  countingDate: string;
}

// ── Alliance Simulator ────────────────────────────────────────────────────────

export interface SimParty {
  partyShort: string;
  party: string;
  alliance: string | null;
  originalSeats: number;
  totalVotes: number;
  color: string;
}

export interface SimGroup {
  id: string;
  label: string;
  parties: string[];
  color: string;
}

export interface SimConstituencyResult {
  constituencyId: string;
  constituencyName: string;
  state: StateSlug;
  district: string;
  originalWinnerParty: string;
  originalWinnerAlliance: string | null;
  simulatedWinnerGroupId: string;
  simulatedWinnerLabel: string;
  simulatedWinnerColor: string;
  topGroupVotes: number;
  runnerUpGroupVotes: number;
  simulatedMargin: number;
  flipped: boolean;
}

export interface SimStateTally {
  state: StateSlug;
  stateName: string;
  totalSeats: number;
  majorityMark: number;
  groupTallies: {
    groupId: string;
    label: string;
    seats: number;
    color: string;
  }[];
}

export interface SimulationResult {
  groups: SimGroup[];
  stateTallies: SimStateTally[];
  constituencyResults: SimConstituencyResult[];
  totalFlipped: number;
}

// ── Index data ────────────────────────────────────────────────────────────────

export interface IndexData {
  states: StateMetadata[];
  lastUpdated: string;
  electionName: string;
  electionYear: number;
}
