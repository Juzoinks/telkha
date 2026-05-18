import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Clock } from "lucide-react";
import { useMemo } from "react";
import { RequireRole } from "@/components/noc/Guards";
import { useTickets, useReports, useSchools } from "@/lib/noc/queries";
import { slaDeadline } from "@/lib/noc/sla";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — NOC Platform" }] }),
  component: () => (
    <RequireRole allow={["admin", "technician"]}>
      <AnalyticsPage />
    </RequireRole>
  ),
});

function AnalyticsPage() {
  const { data: tickets = [] } = useTickets();
  const { data: reports = [] } = useReports();
  const { data: schools = [] } = useSchools();

  const stats = useMemo(() => {
    const resolved = tickets.filter((t) => t.status === "resolved");
    const mttrMs = resolved.length
      ? resolved.reduce((acc, t) => {
          const end = t.closed_at ? new Date(t.closed_at).getTime() : new Date(t.updated_at).getTime();
          return acc + (end - new Date(t.created_at).getTime());
        }, 0) / resolved.length
      : 0;
    const mttrH = mttrMs / 3_600_000;

    const slaOK = resolved.filter((t) => {
      const due = slaDeadline(t);
      const end = t.closed_at ? new Date(t.closed_at) : new Date(t.updated_at);
      return due ? end <= due : true;
    }).length;
    const slaPct = resolved.length ? Math.round((slaOK / resolved.length) * 100) : 100;

    const counts = new Map<string, number>();
    tickets.forEach((t) => t.school_ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, n]) => ({ school: schoolMap.get(id)?.name ?? id.slice(0, 8), count: n }));

    const causeDist = tickets.reduce<Record<string, number>>((acc, t) => {
      acc[t.root_cause] = (acc[t.root_cause] ?? 0) + 1;
      return acc;
    }, {});

    return { mttrH, slaPct, top, causeDist, resolvedCount: resolved.length };
  }, [tickets, schools]);

  const exportCsv = () => {
    const rows = [
      ["ticket_number", "priority", "root_cause", "status", "created_at", "closed_at"],
      ...tickets.map((t) => [t.ticket_number, t.priority, t.root_cause, t.status, t.created_at, t.closed_at ?? ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxCount = Math.max(1, ...stats.top.map((t) => t.count));
  const causeMax = Math.max(1, ...Object.values(stats.causeDist));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            MTTR, SLA compliance, root cause distribution, and most-affected schools.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent"
        >
          Export tickets CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="MTTR" value={`${stats.mttrH.toFixed(1)}h`} icon={Clock} />
        <Stat label="SLA Compliance" value={`${stats.slaPct}%`} icon={TrendingUp} />
        <Stat label="Resolved Tickets" value={stats.resolvedCount} icon={BarChart3} />
        <Stat label="Total Reports" value={reports.length} icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top 10 Affected Schools
          </h2>
          {stats.top.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
          <div className="space-y-2">
            {stats.top.map((t) => (
              <div key={t.school}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="truncate">{t.school}</span>
                  <span className="tabular-nums text-muted-foreground">{t.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Root Cause Distribution
          </h2>
          <div className="space-y-2">
            {Object.entries(stats.causeDist).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{k.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-muted-foreground">{v}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-status-degraded" style={{ width: `${(v / causeMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}