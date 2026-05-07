"use client";

import { getAllianceColor, getAllianceDisplayName } from "@/lib/party-colors";
import { cn } from "@/lib/utils";

interface AllianceBadgeProps {
  alliance: string | null;
  className?: string;
  size?: "sm" | "md";
}

export function AllianceBadge({
  alliance,
  className,
  size = "sm",
}: AllianceBadgeProps) {
  const label = getAllianceDisplayName(alliance);
  const color = getAllianceColor(alliance);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}
