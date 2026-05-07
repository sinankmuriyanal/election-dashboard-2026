import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStateData } from "@/lib/data";
import { STATE_SLUGS, slugToName } from "@/lib/state-metadata";
import type { StateSlug } from "@/types";
import { StateHeroBar } from "@/components/state/StateHeroBar";
import { AllianceSummaryGrid } from "@/components/state/AllianceSummaryGrid";
import { ConstituencyTable } from "@/components/state/ConstituencyTable";
import { WinMarginChart } from "@/components/state/WinMarginChart";

interface Props {
  params: { state: string };
}

export async function generateStaticParams() {
  return STATE_SLUGS.map((slug) => ({ state: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.state as StateSlug;
  if (!STATE_SLUGS.includes(slug)) return {};
  const name = slugToName(slug);
  return {
    title: `${name} Election Results 2026`,
    description: `Constituency-wise results, party tallies, and alliance breakdown for ${name} Assembly Elections 2026.`,
  };
}

export default async function StatePage({ params }: Props) {
  const slug = params.state as StateSlug;
  if (!STATE_SLUGS.includes(slug)) notFound();

  const { summary, constituencies } = await getStateData(slug);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-300">
          Overview
        </Link>
        <span>/</span>
        <span className="text-slate-300">{summary.stateName}</span>
      </nav>

      {/* Hero */}
      <StateHeroBar summary={summary} />

      {/* Alliance grid */}
      {summary.allianceTallies.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Alliance Breakdown
          </h2>
          <AllianceSummaryGrid summary={summary} />
        </section>
      )}

      {/* Charts row */}
      {constituencies.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <WinMarginChart constituencies={constituencies} />

          {/* Party tally table */}
          <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">
              Party-wise Seats
            </h3>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-dashboard-surface">
                  <tr className="border-b border-dashboard-border">
                    <th className="pb-2 text-left font-medium text-slate-500">Party</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Seats</th>
                    <th className="pb-2 text-right font-medium text-slate-500">Vote%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.partyTallies.map((p) => (
                    <tr key={p.partyShort} className="border-b border-dashboard-border/30">
                      <td className="py-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-sm"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-slate-300">{p.party}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-mono font-semibold text-slate-200">
                        {p.seats}
                      </td>
                      <td className="py-1.5 text-right text-slate-400">
                        {p.votePct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Constituency table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          All Constituencies
        </h2>
        <ConstituencyTable
          constituencies={constituencies}
          stateSlug={slug}
        />
      </section>
    </div>
  );
}
