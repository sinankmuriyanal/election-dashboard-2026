// Party and alliance color palette — used consistently across all charts and badges.

export const ALLIANCE_COLORS: Record<string, string> = {
  NDA: "#FF6B35",
  INDIA: "#19AAED",
  LDF: "#DC2626",
  UDF: "#16A34A",
  "AIADMK-Alliance": "#7C3AED",
  "AGP-Alliance": "#D97706",
  Others: "#94A3B8",
  IND: "#64748B",
};

export const PARTY_COLORS: Record<string, string> = {
  // National parties
  BJP: "#FF6B35",
  INC: "#19AAED",
  BSP: "#1E3A5F",
  AAAP: "#F59E0B",

  // Bihar
  "JD(U)": "#1B7B34",
  RJD: "#CC0000",
  HAM: "#7C3AED",
  VIP: "#0EA5E9",
  RLSP: "#F97316",
  AIMIM: "#065F46",
  CPI: "#B91C1C",
  "CPI(M-L)": "#991B1B",

  // West Bengal
  TMC: "#1D4ED8",
  "CPI(M)": "#DC2626",
  ISF: "#14532D",
  SUCI: "#7F1D1D",

  // Assam
  AGP: "#D97706",
  AIUDF: "#065F46",
  BPF: "#0F766E",
  UPPL: "#7C3AED",
  "CPI(M-L)(L)": "#991B1B",

  // Kerala
  "CPI(M)K": "#DC2626",
  CPIK: "#B91C1C",
  IUML: "#166534",
  KC: "#15803D",
  NCP: "#1D4ED8",
  JD: "#1B7B34",
  KEC: "#0369A1",

  // Tamil Nadu
  DMK: "#CC0000",
  AIADMK: "#7C3AED",
  PMK: "#D97706",
  VCK: "#1D4ED8",
  MDMK: "#0F766E",
  TVK: "#0EA5E9",
  PT: "#065F46",
  AMMK: "#7F1D1D",
  DMDK: "#92400E",
  MNM: "#1E3A5F",

  // Puducherry
  AINRC: "#0D9488",

  // Generic fallback
  IND: "#64748B",
  NOTA: "#374151",
};

const FALLBACK_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EF4444",
];

let fallbackIndex = 0;
const dynamicColors: Record<string, string> = {};

export function getPartyColor(partyShort: string): string {
  if (PARTY_COLORS[partyShort]) return PARTY_COLORS[partyShort];
  if (dynamicColors[partyShort]) return dynamicColors[partyShort];
  const color = FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
  fallbackIndex++;
  dynamicColors[partyShort] = color;
  return color;
}

export function getAllianceColor(alliance: string | null): string {
  if (!alliance) return ALLIANCE_COLORS["Others"];
  return ALLIANCE_COLORS[alliance] ?? ALLIANCE_COLORS["Others"];
}

export const ALLIANCE_DISPLAY_NAMES: Record<string, string> = {
  NDA: "NDA",
  INDIA: "INDIA Bloc",
  LDF: "LDF",
  UDF: "UDF",
  "AIADMK-Alliance": "AIADMK Alliance",
  "AGP-Alliance": "AGP Alliance",
  Others: "Others",
  IND: "Independent",
};

export function getAllianceDisplayName(alliance: string | null): string {
  if (!alliance) return "Others";
  return ALLIANCE_DISPLAY_NAMES[alliance] ?? alliance;
}
