import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, AlertCircle, LayoutDashboard, LogOut, School, TicketCheck, Radio, ShieldCheck, Inbox, BarChart3, ScrollText } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCloud, useTickets } from "@/lib/noc/queries";
import { useNocRealtime } from "@/lib/noc/useRealtime";
import { toggleCloudOutage, recomputeTickets } from "@/lib/noc/engine.functions";
import { formatRoleList } from "@/lib/auth/roles";
import { StatusDot } from "./StatusDot";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

const STAFF_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/schools", label: "Schools", icon: School },
  { to: "/tickets", label: "Tickets", icon: TicketCheck },
  { to: "/reports", label: "Reports", icon: Inbox },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/report", label: "Teacher Portal", icon: AlertCircle },
];
const ADMIN_NAV = [
  { to: "/admin", label: "User Access", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

const TEACHER_NAV = [{ to: "/report", label: "Report Issue", icon: AlertCircle }];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isStaff, signOut, user, roles } = useAuth();
  const onAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  useNocRealtime();
  const { data: cloud } = useCloud(!onAuthPage);
  const { data: tickets } = useTickets(!onAuthPage);
  const openTickets = (tickets ?? []).filter((t) => t.status !== "resolved").length;
  const toggleFn = useServerFn(toggleCloudOutage);
  const recomputeFn = useServerFn(recomputeTickets);
  const isAdmin = roles.includes("admin");
  const navItems = isStaff ? [...STAFF_NAV, ...(isAdmin ? ADMIN_NAV : [])] : TEACHER_NAV;

  const cloudStatus = cloud?.status ?? "unknown";
  const cloudLatency = cloud?.latency_ms ?? 0;

  if (onAuthPage) return <Outlet />;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Radio className="h-5 w-5 text-status-operational" />
          <div>
            <div className="text-sm font-semibold leading-none">NOC Platform</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              School Network Ops
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {session && <NotificationBell />}
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map((item) => {
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.to === "/tickets" && openTickets > 0 && (
                  <span className="ml-auto rounded-full bg-status-down px-2 py-0.5 text-[10px] font-semibold text-white">
                    {openTickets}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-border p-3 text-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amazon LEO</span>
              <StatusDot status={cloudStatus} />
            </div>
            <div className="mt-1 text-muted-foreground">
              {cloudStatus === "down" ? "OUTAGE" : `${cloudLatency}ms`}
            </div>
            {isStaff && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full text-xs"
                  onClick={async () => {
                    await toggleFn();
                    await recomputeFn();
                  }}
                >
                  <Activity className="mr-1.5 h-3 w-3" />
                  Simulate {cloudStatus === "down" ? "recovery" : "outage"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 w-full text-xs"
                  onClick={() => recomputeFn()}
                >
                  Re-run engine
                </Button>
              </>
            )}
          </div>
          {session && (
            <div className="border-t border-border pt-3">
              <div className="truncate font-medium text-foreground">{user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {formatRoleList(roles)}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 w-full justify-start text-xs"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="mr-1.5 h-3 w-3" /> Sign out
              </Button>
            </div>
          )}
          {!session && (
            <Link to="/login" className="block rounded-md bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground">
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:hidden">
          <Radio className="h-5 w-5 text-status-operational" />
          <div className="text-sm font-semibold">NOC Platform</div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <StatusDot status={cloudStatus} />
            <span className="text-muted-foreground">LEO</span>
            {session && <NotificationBell />}
            <ThemeToggle />
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1.5 md:hidden">
          {navItems.map((item) => {
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-xs",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
