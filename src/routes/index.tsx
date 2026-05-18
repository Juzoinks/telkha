import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { AlertTriangle, Cloud, School as SchoolIcon, TicketCheck, Activity, RefreshCw, Gauge, Zap } from "lucide-react";
import { MetricCard } from "@/components/noc/MetricCard";
import { StatusDot } from "@/components/noc/StatusDot";
import { RequireRole } from "@/components/noc/Guards";
const SchoolsMap = lazy(() =>
  import("@/components/noc/SchoolsMap").then((m) => ({ default: m.SchoolsMap })),
);
import { useSchools, useTickets, useCloud, useActivity } from "@/lib/noc/queries";
import { useQueryClient } from "@tanstack/react-query";
import type { RootCause } from "@/lib/noc/types";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    focusSchool: typeof search.focusSchool === "string" && /^[0-9a-f-]{10,40}$/i.test(search.focusSchool)
      ? search.focusSchool
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "NOC Dashboard — Real-time school network monitoring" },
      { name: "description", content: "Live overview of 600+ schools, devices, cloud health, and active incidents." },
    ],
  }),
  component: () => (
    <RequireRole allow={["admin", "technician"]}>
      <Dashboard />
    </RequireRole>
  ),
});

const ROOT_CAUSE_LABELS: Record<RootCause, string> = {
  CLOUD_OUTAGE: "Cloud Outage",
  SITE_NETWORK_DOWN: "Site Down",
  DEVICE_FAILURE: "Device Failure",
  ISP_OR_UPSTREAM: "ISP / Upstream",
  PERFORMANCE_DEGRADATION: "Performance",
  UNVERIFIED_USER_ISSUE: "Unverified",
};

function Dashboard() {
  const qc = useQueryClient();
  const { focusSchool } = Route.useSearch();
  const { data: schools = [] } = useSchools();
  const { data: cloud } = useCloud();
  const { data: tickets = [] } = useTickets();
  const { data: activity = [] } = useActivity();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const id = setInterval(() => {
      qc.invalidateQueries();
      setLastRefresh(new Date());
    }, 30_000);
    return () => clearInterval(id);
  }, [qc]);

  const totalSchools = schools.length;
  const downSchools = schools.filter((s) => s.status === "down").length;
  const degradedSchools = schools.filter((s) => s.status === "degraded").length;
  const onlineSchools = totalSchools - downSchools - degradedSchools;
  const uptimePct = totalSchools ? ((onlineSchools / totalSchools) * 100).toFixed(1) : "0.0";
  const openTickets = tickets.filter((t) => t.status !== "resolved").length;

  const causeDist = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.root_cause] = (acc[t.root_cause] || 0) + 1;
    return acc;
  }, {});
  const maxCause = Math.max(1, ...Object.values(causeDist));

  const sevCounts = {
    critical: tickets.filter((t) => t.priority === "critical" && t.status !== "resolved").length,
    high: tickets.filter((t) => t.priority === "high" && t.status !== "resolved").length,
    medium: tickets.filter((t) => t.priority === "medium" && t.status !== "resolved").length,
    low: tickets.filter((t) => t.priority === "low" && t.status !== "resolved").length,
  };

  const regions = Array.from(new Set(schools.map((s) => s.region))).sort();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live status across {totalSchools} schools</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          <span suppressHydrationWarning>Last refreshed {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Hero uptime stat */}
      <div className="rounded-lg border border-border bg-gradient-to-br from-card to-card/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Network Health</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-5xl font-bold tabular-nums text-status-operational">{uptimePct}%</span>
              <span className="text-sm text-muted-foreground">of schools online ({onlineSchools} / {totalSchools})</span>
            </div>
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-operational" /> {onlineSchools} online</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-degraded" /> {degradedSchools} degraded</div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-down" /> {downSchools} offline</div>
          </div>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="bg-status-operational" style={{ width: `${(onlineSchools / Math.max(1, totalSchools)) * 100}%` }} />
          <div className="bg-status-degraded" style={{ width: `${(degradedSchools / Math.max(1, totalSchools)) * 100}%` }} />
          <div className="bg-status-down" style={{ width: `${(downSchools / Math.max(1, totalSchools)) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Schools" value={totalSchools} icon={SchoolIcon} />
        <MetricCard
          label="Schools Down"
          value={downSchools}
          icon={AlertTriangle}
          tone={downSchools > 0 ? "down" : "operational"}
        />
        <MetricCard
          label="Degraded"
          value={degradedSchools}
          icon={Activity}
          tone={degradedSchools > 0 ? "degraded" : "operational"}
        />
        <MetricCard
          label="Active Tickets"
          value={openTickets}
          icon={TicketCheck}
          hint={`${tickets.length} total`}
        />
        <MetricCard
          label="LEO Latency"
          value={`${cloud?.latency_ms ?? 0}ms`}
          icon={Gauge}
          tone={cloud?.status === "down" ? "down" : "operational"}
        />
        <MetricCard
          label="Packet Loss"
          value={cloud?.status === "down" ? "100%" : "0.2%"}
          icon={Zap}
          tone={cloud?.status === "down" ? "down" : "operational"}
        />
      </div>

      {/* GIS map of all schools */}
      {mounted && (
        <Suspense
          fallback={
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="h-[450px] animate-pulse rounded-md bg-muted/30" />
            </div>
          }
        >
          <SchoolsMap schools={schools} flyToSchoolId={focusSchool ?? null} />
        </Suspense>
      )}

      {/* Severity breakdown + alert feed strip */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Open Ticket Severity
          </h2>
          <div className="space-y-2">
            {(["critical", "high", "medium", "low"] as const).map((p) => {
              const count = sevCounts[p];
              const total = sevCounts.critical + sevCounts.high + sevCounts.medium + sevCounts.low;
              const pct = total ? (count / total) * 100 : 0;
              return (
                <div key={p}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="capitalize">{p}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full bg-priority-${p}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Live Alert Feed
          </h2>
          <div className="max-h-64 space-y-1.5 overflow-auto text-xs">
            {activity.length === 0 && <div className="text-muted-foreground">No recent alerts.</div>}
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2 border-b border-border/40 pb-1.5 last:border-0">
                <span className="text-muted-foreground" suppressHydrationWarning>
                  {new Date(a.created_at).toLocaleTimeString()}
                </span>
                <span className="rounded bg-muted px-1 py-0 text-[9px] uppercase tracking-wider">{a.kind}</span>
                <span className="flex-1">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Region Health
          </h2>
          <div className="space-y-2">
            {regions.map((region) => {
              const inRegion = schools.filter((s) => s.region === region);
              const down = inRegion.filter((s) => s.status === "down").length;
              const deg = inRegion.filter((s) => s.status === "degraded").length;
              const ok = inRegion.length - down - deg;
              const total = inRegion.length;
              return (
                <Link
                  key={region}
                  to="/schools"
                  search={{ region, status: undefined, province: undefined, isp: undefined }}
                  className="block rounded-md border border-border bg-background/40 p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{region}</span>
                    <span className="text-xs text-muted-foreground">{total} schools</span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-status-operational"
                      style={{ width: `${(ok / total) * 100}%` }}
                    />
                    <div
                      className="bg-status-degraded"
                      style={{ width: `${(deg / total) * 100}%` }}
                    />
                    <div className="bg-status-down" style={{ width: `${(down / total) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <StatusDot status="operational" /> {ok}
                    </span>
                    <span className="flex items-center gap-1">
                      <StatusDot status="degraded" /> {deg}
                    </span>
                    <span className="flex items-center gap-1">
                      <StatusDot status="down" /> {down}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Upstream
            </h2>
            <div className="flex items-center gap-3">
              <Cloud className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{cloud?.service ?? "Cloud"}</div>
                <div className="text-xs text-muted-foreground">
                  {cloud?.status === "down" ? "Service outage" : `${cloud?.latency_ms ?? 0}ms latency`}
                </div>
              </div>
              <StatusDot status={cloud?.status ?? "unknown"} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Root Cause Distribution
            </h2>
            <div className="space-y-2">
              {Object.entries(causeDist).length === 0 && (
                <div className="text-xs text-muted-foreground">No active incidents 🎉</div>
              )}
              {Object.entries(causeDist)
                .sort((a, b) => b[1] - a[1])
                .map(([cause, count]) => (
                  <div key={cause}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{ROOT_CAUSE_LABELS[cause as RootCause]}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(count / maxCause) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Activity Feed
            </h2>
            <div className="space-y-2 text-xs">
              {activity.length === 0 && (
                <div className="text-muted-foreground">No activity yet.</div>
              )}
              {activity.slice(0, 8).map((a) => (
                <div key={a.id} className="flex gap-2">
                  <span className="text-muted-foreground" suppressHydrationWarning>
                    {new Date(a.created_at).toLocaleTimeString()}
                  </span>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
