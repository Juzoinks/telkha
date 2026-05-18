import type { Status } from "@/lib/noc/types";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<Status, string> = {
  operational: "bg-status-operational shadow-[0_0_8px_var(--status-operational)]",
  degraded: "bg-status-degraded shadow-[0_0_8px_var(--status-degraded)]",
  down: "bg-status-down shadow-[0_0_10px_var(--status-down)] animate-pulse",
  unknown: "bg-status-unknown",
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", STATUS_CLASS[status], className)} />;
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <StatusDot status={status} />
      {status}
    </span>
  );
}
