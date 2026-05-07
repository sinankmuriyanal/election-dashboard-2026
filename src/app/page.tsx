import type { Metadata } from "next";
import { getAllStateSummaries, getIndexData } from "@/lib/data";
import { StateCard } from "@/components/overview/StateCard";
import { NationalSummaryBar } from "@/components/overview/NationalSummaryBar";
import { LastUpdated } from "@/components/ui/LastUpdated";

export const metadata: Metadata = {
  title: "India Elections 2026 — Live Results Dashboard",
};

export default async function OverviewPage() {
  const [summaries, indexData] = await Promise.all([
    getAllStateSummaries(),
    getIndexData(),
  ]);

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
            Assembly Elections 2026
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Bihar · West Bengal · Assam · Kerala · Tamil Nadu
          </p>
        </div>
        <LastUpdated isoDate={indexData.lastUpdated} />
      </div>

      {/* National aggregate */}
      <NationalSummaryBar summaries={summaries} />

      {/* State grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map((s) => (
          <StateCard key={s.state} summary={s} />
        ))}
      </div>

      {/* Notes */}
      <p className="mt-8 text-center text-xs text-slate-600">
        All data sourced from the Election Commission of India •{" "}
        <a
          href="https://results.eci.gov.in/ResultAcGenMay2026/index.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-400"
        >
          View official ECI results
        </a>
      </p>
    </div>
  );
}
