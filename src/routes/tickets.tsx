import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTicketsPaged, useTicketCounts } from "@/lib/noc/queries";
import { RequireRole } from "@/components/noc/Guards";

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-green-500/20 text-green-400",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  resolved: "bg-green-500/20 text-green-400",
};

export const Route = createFileRoute("/tickets")({
  component: () => (
    <RequireRole allow={["admin", "technician"]}>
      <TicketsPage />
    </RequireRole>
  ),
});

function TicketsPage() {
  const [status, setStatus] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [priority, setPriority] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: counts } = useTicketCounts();
  const { data, isLoading } = useTicketsPaged({ status, priority, search, page, pageSize: 25 });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <p className="text-sm text-muted-foreground">{total} tickets</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["all", "open", "in_progress", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(0); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              status === s
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
            {counts && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {s === "all" ? counts.all : counts[s as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={priority}
          onChange={(e) => { setPriority(e.target.value as typeof priority); setPage(0); }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Ticket #</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Priority</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Root Cause</th>
                  <th className="px-4 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No tickets found.
                    </td>
                  </tr>
                )}
                {rows.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {ticket.ticket_number}
                    </td>
                    <td className="px-4 py-3 font-medium">{ticket.title}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLOR[ticket.priority] ?? ""}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLOR[ticket.status] ?? ""}`}>
                        {ticket.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{ticket.root_cause}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50 hover:bg-accent/50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50 hover:bg-accent/50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}