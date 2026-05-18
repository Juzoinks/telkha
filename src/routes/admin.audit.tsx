import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { RequireRole } from "@/components/noc/Guards";
import { useAuditLog } from "@/lib/noc/extra-queries";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — Admin" }] }),
  component: () => (
    <RequireRole allow={["admin"]}>
      <AuditPage />
    </RequireRole>
  ),
});

function AuditPage() {
  const { data: entries = [], isLoading } = useAuditLog();

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ScrollText className="h-5 w-5 text-primary" /> Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Every role change, school assignment, and ticket update.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && entries.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No audit entries yet.</td></tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3 text-xs text-muted-foreground" suppressHydrationWarning>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-xs">{e.actor_id?.slice(0, 8) ?? "system"}</td>
                  <td className="p-3"><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.action}</span></td>
                  <td className="p-3 text-xs">{e.target_type} <span className="text-muted-foreground">{e.target_id?.slice(0, 8)}</span></td>
                  <td className="p-3 text-xs text-muted-foreground">
                    <code className="text-[10px]">{JSON.stringify(e.diff)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}