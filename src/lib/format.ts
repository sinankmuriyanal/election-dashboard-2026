// Number and text formatting utilities for election data

export function formatVotes(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

export function formatVotesFull(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatMargin(margin: number): string {
  return `${margin >= 0 ? "+" : ""}${formatVotes(margin)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function slugToDisplay(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function displayToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
