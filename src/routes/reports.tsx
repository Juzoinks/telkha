import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useReportsPaged, useReportCounts } from "@/lib/noc/queries";
import { RequireRole } from "@/components/noc/Guards";

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  confirmed: "bg-yellow-500/20 text-yellow-400",
  closed: "bg-green-500/20 text-green-400",
};

export const Route = createFileRoute("/reports")({
  component: () => (
    <RequireRole allow={["admin", "technician"]}>
      <ReportsPage />
    </RequireRole>
  ),
});

function ReportsPage() {
  const [status, setStatus] = useState<"all" | "new" | "confirmed" | "closed">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: counts } = useReportCounts();
  const { data, isLoading } = useReportsPaged({ status, search, page, pageSize: 25 });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">{total} reports from teachers</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["all", "new", "confirmed", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(0); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              status === s
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {counts && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {s === "all" ? counts.all : counts[s as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search reports..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Message</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Linked Ticket</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No reports found.
                    </td>
                  </tr>
                )}
                {rows.map((report) => (
                  <tr key={report.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-medium capitalize">{report.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {report.message ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLOR[report.report_status] ?? ""}`}>
                        {report.report_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {report.linked_ticket_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(report.created_at).toLocaleDateString()}
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