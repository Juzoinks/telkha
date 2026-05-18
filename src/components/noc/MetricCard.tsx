import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "down" | "degraded" | "operational";
  hint?: string;
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-foreground",
  down: "text-status-down",
  degraded: "text-status-degraded",
  operational: "text-status-operational",
};

export function MetricCard({ label, value, icon: Icon, tone = "default", hint }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("h-4 w-4", TONE[tone])} />
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tabular-nums", TONE[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
