import { formatDate } from "@/lib/format";

interface LastUpdatedProps {
  isoDate: string;
}

export function LastUpdated({ isoDate }: LastUpdatedProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashboard-border bg-dashboard-surface px-2.5 py-1 text-xs text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Data as of {formatDate(isoDate)}
    </span>
  );
}
