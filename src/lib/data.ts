import type {
  ConstituencyResult,
  IndexData,
  StateData,
  StateSlug,
  StateSummary,
} from "@/types";
import { STATE_SLUGS } from "@/lib/state-metadata";

// Server side: read from filesystem (avoids absolute URL requirement in SSR)
// Client side: fetch from public URL
async function readDataFile<T>(relativePath: string): Promise<T> {
  if (typeof window === "undefined") {
    const fs = await import("fs/promises");
    const path = await import("path");
    const fullPath = path.join(process.cwd(), "public", "data", relativePath);
    const content = await fs.readFile(fullPath, "utf-8");
    // Strip UTF-8 BOM if present
    const cleaned = content.startsWith("﻿") ? content.slice(1) : content;
    return JSON.parse(cleaned) as T;
  } else {
    const res = await fetch(`/data/${relativePath}`, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed to fetch /data/${relativePath}: ${res.status}`);
    return res.json() as Promise<T>;
  }
}

export async function getIndexData(): Promise<IndexData> {
  return readDataFile<IndexData>("index.json");
}

export async function getStateSummary(slug: StateSlug): Promise<StateSummary> {
  return readDataFile<StateSummary>(`${slug}/summary.json`);
}

export async function getStateConstituencies(
  slug: StateSlug
): Promise<ConstituencyResult[]> {
  return readDataFile<ConstituencyResult[]>(`${slug}/results.json`);
}

export async function getStateData(slug: StateSlug): Promise<StateData> {
  const [summary, constituencies] = await Promise.all([
    getStateSummary(slug),
    getStateConstituencies(slug),
  ]);
  return { summary, constituencies };
}

export async function getAllStateSummaries(): Promise<StateSummary[]> {
  return Promise.all(STATE_SLUGS.map((slug) => getStateSummary(slug)));
}

export async function getAllConstituencies(): Promise<ConstituencyResult[]> {
  const arrays = await Promise.all(
    STATE_SLUGS.map((slug) => getStateConstituencies(slug))
  );
  return arrays.flat();
}

export async function getConstituency(
  slug: StateSlug,
  constituencyId: string
): Promise<ConstituencyResult | null> {
  const constituencies = await getStateConstituencies(slug);
  return constituencies.find((c) => c.id === constituencyId) ?? null;
}
