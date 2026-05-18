import { Clock, Loader2, Play, Power } from "lucide-react";
import { useRuijieScheduler, type ScheduleInterval } from "@/lib/integrations/useRuijieScheduler";
import { Button } from "@/components/ui/button";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const OPTIONS: ScheduleInterval[] = [5, 15, 30, 60];

export function RuijieSchedulerPanel() {
  const { intervalMin, enabled, lastRun, running, runNow, setInterval, setEnabled } = useRuijieScheduler();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Ruijie auto-sync</span>

      <select
        value={intervalMin}
        onChange={(e) => setInterval(Number(e.target.value) as ScheduleInterval)}
        className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
        aria-label="Sync interval"
      >
        {OPTIONS.map((m) => (
          <option key={m} value={m}>every {m} min</option>
        ))}
      </select>

      <Button
        size="sm"
        variant={enabled ? "default" : "outline"}
        onClick={() => setEnabled(!enabled)}
        className="h-6 px-2 text-xs"
      >
        <Power className="mr-1 h-3 w-3" />
        {enabled ? "On" : "Off"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => runNow("full")}
        disabled={running}
        className="h-6 px-2 text-xs"
      >
        {running ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
        Sync now
      </Button>

      <span className="text-muted-foreground">
        Last sync: <span className="text-foreground">{timeAgo(lastRun)}</span>
      </span>
    </div>
  );
}