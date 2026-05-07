"use client";

import { getPartyColor } from "@/lib/party-colors";
import { cn } from "@/lib/utils";

interface PartyBadgeProps {
  partyShort: string;
  className?: string;
  size?: "sm" | "md";
}

export function PartyBadge({
  partyShort,
  className,
  size = "sm",
}: PartyBadgeProps) {
  const color = getPartyColor(partyShort);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-mono font-semibold",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className
      )}
      style={{ backgroundColor: color + "28", color, border: `1px solid ${color}55` }}
    >
      {partyShort}
    </span>
  );
}
