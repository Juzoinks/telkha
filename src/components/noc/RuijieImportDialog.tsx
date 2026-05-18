import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { listRuijieSites, listRuijieDevices, type RuijieSite, type RuijieDevice } from "@/lib/integrations/ruijie";
import { runRuijieSync } from "@/lib/integrations/ruijie-sync";
import { qk } from "@/lib/noc/queries";

type SiteWithDevices = RuijieSite & { devices: RuijieDevice[] };

export function RuijieImportDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sites, setSites] = useState<SiteWithDevices[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function fetchPreview() {
    setLoading(true);
    try {
      const list = await listRuijieSites();
      const enriched = await Promise.all(
        list.map(async (s) => ({ ...s, devices: await listRuijieDevices(s.site_id) })),
      );
      setSites(enriched);
      setSelected(new Set(enriched.map((s) => s.site_id)));
    } catch (e) {
      toast.error("Failed to fetch from Ruijie: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSite(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function importSelected() {
    const chosen = sites.filter((s) => selected.has(s.site_id));
    if (chosen.length === 0) {
      toast.error("Select at least one site");
      return;
    }
    setImporting(true);
    try {
      const result = await runRuijieSync(chosen.map((s) => s.site_id));
      result.errors.forEach((m) => toast.error(m));
      toast.success(`Imported ${result.schools} schools, ${result.devices} devices`);
      qc.invalidateQueries({ queryKey: qk.schools });
      setOpen(false);
      setSites([]);
      setSelected(new Set());
    } catch (e) {
      toast.error("Import failed: " + (e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Cloud className="mr-1 h-3.5 w-3.5" />
          Sync from Ruijie
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Ruijie Cloud — Import schools & devices
          </DialogTitle>
          <DialogDescription>
            Pulls sites and their installed network devices from Ruijie Cloud.
            Existing schools matched by Ruijie site ID will be refreshed; new ones will be created.
            <span className="ml-1 text-xs italic">(Mock data — connect API key to enable live sync.)</span>
          </DialogDescription>
        </DialogHeader>

        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Button onClick={fetchPreview} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {loading ? "Contacting Ruijie Cloud…" : "Fetch sites from Ruijie"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Endpoint: <code className="rounded bg-muted px-1">GET /api/v1/sites</code>
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <Checkbox
                      checked={selected.size === sites.length}
                      onCheckedChange={() =>
                        setSelected(selected.size === sites.length ? new Set() : new Set(sites.map((s) => s.site_id)))
                      }
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Site</th>
                  <th className="px-3 py-2 text-left font-semibold">Region</th>
                  <th className="px-3 py-2 text-left font-semibold">Devices</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.site_id} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="px-3 py-2">
                      <Checkbox checked={selected.has(s.site_id)} onCheckedChange={() => toggleSite(s.site_id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.site_name}</div>
                      <div className="text-xs text-muted-foreground">{s.site_id}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{s.region}</td>
                    <td className="px-3 py-2">
                      <span className="tabular-nums">{s.devices.length}</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({s.devices.filter((d) => d.status === "online").length} online)
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={s.online ? "default" : "destructive"} className="text-[10px]">
                        {s.online ? "Online" : "Offline"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          {sites.length > 0 && (
            <>
              <Button variant="outline" onClick={fetchPreview} disabled={loading || importing}>
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={importSelected} disabled={importing || selected.size === 0}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Import {selected.size} site{selected.size === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}