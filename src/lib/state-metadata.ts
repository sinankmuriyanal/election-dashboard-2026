import type { StateMetadata, StateSlug } from "@/types";

export const STATE_METADATA: StateMetadata[] = [
  {
    slug: "puducherry",
    name: "Puducherry",
    nameLocal: "புதுச்சேரி",
    totalSeats: 30,
    majorityMark: 16,
    capitalCity: "Puducherry",
    countingDate: "2026-05-08",
  },
  {
    slug: "west_bengal",
    name: "West Bengal",
    nameLocal: "পশ্চিমবঙ্গ",
    totalSeats: 294,
    majorityMark: 148,
    capitalCity: "Kolkata",
    countingDate: "2026-05-08",
  },
  {
    slug: "assam",
    name: "Assam",
    nameLocal: "অসম",
    totalSeats: 126,
    majorityMark: 64,
    capitalCity: "Dispur",
    countingDate: "2026-05-08",
  },
  {
    slug: "kerala",
    name: "Kerala",
    nameLocal: "കേരളം",
    totalSeats: 140,
    majorityMark: 71,
    capitalCity: "Thiruvananthapuram",
    countingDate: "2026-05-08",
  },
  {
    slug: "tamil_nadu",
    name: "Tamil Nadu",
    nameLocal: "தமிழ்நாடு",
    totalSeats: 234,
    majorityMark: 118,
    capitalCity: "Chennai",
    countingDate: "2026-05-08",
  },
];

export const STATE_SLUGS: StateSlug[] = [
  "puducherry",
  "west_bengal",
  "assam",
  "kerala",
  "tamil_nadu",
];

export const STATE_NAME_MAP: Record<StateSlug, string> = {
  puducherry: "Puducherry",
  west_bengal: "West Bengal",
  assam: "Assam",
  kerala: "Kerala",
  tamil_nadu: "Tamil Nadu",
};

export function getStateMetadata(slug: StateSlug): StateMetadata {
  const meta = STATE_METADATA.find((s) => s.slug === slug);
  if (!meta) throw new Error(`Unknown state slug: ${slug}`);
  return meta;
}

export function slugToName(slug: StateSlug): string {
  return STATE_NAME_MAP[slug];
}

export function nameToSlug(name: string): StateSlug | null {
  const entry = Object.entries(STATE_NAME_MAP).find(
    ([, v]) => v.toLowerCase() === name.toLowerCase()
  );
  return entry ? (entry[0] as StateSlug) : null;
}
