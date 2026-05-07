import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getConstituency, getStateConstituencies } from "@/lib/data";
import { STATE_SLUGS, slugToName } from "@/lib/state-metadata";
import type { StateSlug } from "@/types";
import { CandidateVoteBar } from "@/components/constituency/CandidateVoteBar";
import { PartyBadge } from "@/components/ui/PartyBadge";
import { AllianceBadge } from "@/components/ui/AllianceBadge";
import { formatVotesFull, formatPct, formatVotes } from "@/lib/format";
import { getAllianceColor } from "@/lib/party-colors";

interface Props {
  params: { state: string; constituency: string };
}

// Generate static params only for state pages — constituencies are ISR on-demand
export async function generateStaticParams() {
  return STATE_SLUGS.map((slug) => ({ state: slug, constituency: "_placeholder" }));
}

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.state as StateSlug;
  const c = await getConstituency(slug, params.constituency).catch(() => null);
  if (!c) return {};
  return {
    title: `${c.name} — ${slugToName(slug)} Election Results 2026`,
    description: `${c.winner.name} (${c.winner.partyShort}) won ${c.name} by ${formatVotes(c.margin)} votes.`,
  };
}

export default async function ConstituencyPage({ params }: Props) {
  const slug = params.state as StateSlug;
  if (!STATE_SLUGS.includes(slug)) notFound();

  const [c, allConstituencies] = await Promise.all([
    getConstituency(slug, params.constituency),
    getStateConstituencies(slug),
  ]);
  if (!c) notFound();

  const sortedAll = [...allConstituencies].sort(
    (a, b) => a.assemblyNumber - b.assemblyNumber
  );
  const idx = sortedAll.findIndex((x) => x.id === c.id);
  const prev = idx > 0 ? sortedAll[idx - 1] : null;
  const next = idx < sortedAll.length - 1 ? sortedAll[idx + 1] : null;

  const winnerColor = getAllianceColor(c.winner.alliance);

  return (
    <div className="animate-fade-in mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-300">Overview</Link>
        <span>/</span>
        <Link href={`/${slug}`} className="hover:text-slate-300">{slugToName(slug)}</Link>
        <span>/</span>
        <span className="text-slate-300">{c.name}</span>
      </nav>

      {/* Header */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: winnerColor + "44", backgroundColor: winnerColor + "0A" }}
      >
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
          <span>AC #{c.assemblyNumber}</span>
          {c.district && <span>· {c.district}</span>}
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
              c.status === "won"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {c.status === "won" ? "Result Declared" : "Leading"}
          </span>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-slate-100">{c.name}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold text-slate-100">{c.winner.name}</span>
          <PartyBadge partyShort={c.winner.partyShort} size="md" />
          <AllianceBadge alliance={c.winner.alliance} size="md" />
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Winner Votes", value: formatVotesFull(c.winner.votes) },
          { label: "Vote Share", value: formatPct(c.winner.votePct) },
          { label: "Margin", value: formatVotesFull(c.margin) },
          { label: "Margin%", value: formatPct(c.marginPct) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-dashboard-border bg-dashboard-surface p-3 text-center"
          >
            <p className="text-lg font-bold text-slate-100">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Vote bars */}
      <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-300">
          All Candidates — {c.totalVotes.toLocaleString("en-IN")} total valid votes
        </h2>
        <CandidateVoteBar
          candidates={c.candidates}
          totalVotes={c.totalVotes}
        />
      </div>

      {/* Detailed table */}
      <div className="rounded-xl border border-dashboard-border bg-dashboard-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Detailed Results</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashboard-border text-xs text-slate-500">
                <th className="pb-2 text-left font-medium">Rank</th>
                <th className="pb-2 text-left font-medium">Candidate</th>
                <th className="pb-2 text-left font-medium">Party</th>
                <th className="pb-2 text-right font-medium">Votes</th>
                <th className="pb-2 text-right font-medium">Vote%</th>
              </tr>
            </thead>
            <tbody>
              {[...c.candidates]
                .sort((a, b) => b.votes - a.votes)
                .map((cand, i) => (
                  <tr
                    key={cand.name}
                    className={`border-b border-dashboard-border/30 ${
                      cand.isWinner ? "bg-dashboard-surface-2/40" : ""
                    }`}
                  >
                    <td className="py-2 text-xs text-slate-500">{i + 1}</td>
                    <td className="py-2">
                      <span
                        className={
                          cand.isWinner
                            ? "font-semibold text-slate-100"
                            : "text-slate-400"
                        }
                      >
                        {cand.isWinner && "★ "}
                        {cand.name}
                      </span>
                    </td>
                    <td className="py-2">
                      <PartyBadge partyShort={cand.partyShort} />
                    </td>
                    <td className="py-2 text-right font-mono text-slate-200">
                      {formatVotesFull(cand.votes)}
                    </td>
                    <td className="py-2 text-right text-slate-400">
                      {formatPct(cand.votePct)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prev/Next navigation */}
      <div className="flex items-center justify-between gap-4">
        {prev ? (
          <Link
            href={`/${slug}/${prev.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-dashboard-border bg-dashboard-surface px-3 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            ← AC #{prev.assemblyNumber} {prev.name}
          </Link>
        ) : (
          <div />
        )}
        {next && (
          <Link
            href={`/${slug}/${next.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-dashboard-border bg-dashboard-surface px-3 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            AC #{next.assemblyNumber} {next.name} →
          </Link>
        )}
      </div>
    </div>
  );
}
