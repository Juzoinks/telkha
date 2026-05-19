import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSchools } from "@/lib/noc/queries";
import { StatusDot } from "@/components/noc/StatusDot";
import { RequireRole } from "@/components/noc/Guards";

export const Route = createFileRoute("/schools")({
  component: () => (
    <RequireRole allow={["admin", "technician"]}>
      <SchoolsPage />
    </RequireRole>
  ),
});

function SchoolsPage() {
  const { data: schools = [], isLoading } = useSchools();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = schools.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.region.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Schools</h1>
        <p className="text-sm text-muted-foreground">{schools.length} schools total</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search schools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="operational">Operational</option>
          <option value="degraded">Degraded</option>
          <option value="down">Down</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">School</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-left">Province</th>
                <th className="px-4 py-3 text-left">ISP</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Gateway</th>
                <th className="px-4 py-3 text-left">Internet</th>
                <th className="px-4 py-3 text-left">Devices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    No schools found.
                  </td>
                </tr>
              )}
              {filtered.map((school) => (
                <tr key={school.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{school.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{school.region}</td>
                  <td className="px-4 py-3 text-muted-foreground">{school.province ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{school.isp_type ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={school.status} />
                      <span className="capitalize">{school.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={school.gateway_reachable ? "text-green-500" : "text-red-500"}>
                      {school.gateway_reachable ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={school.internet_check_ok ? "text-green-500" : "text-red-500"}>
                      {school.internet_check_ok ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {school.devices?.length ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}