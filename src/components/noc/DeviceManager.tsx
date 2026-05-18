import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Cpu, Wifi, Router, Link2, Cloud } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { qk, type DbDevice } from "@/lib/noc/queries";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listRuijieSites, listRuijieDevices, type RuijieDevice } from "@/lib/integrations/ruijie";
import { syncRuijieSchool } from "@/lib/integrations/ruijie-sync";

const TYPES = ["ap", "switch", "gateway", "controller"] as const;
type DeviceType = (typeof TYPES)[number];

const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  type: z.enum(TYPES),
  mac_address: z.string().trim().regex(macRegex, "MAC must be AA:BB:CC:DD:EE:FF").optional().or(z.literal("")),
  ruijie_device_id: z.string().trim().max(80).optional().or(z.literal("")),
});

const ICONS: Record<DeviceType, typeof Cpu> = { ap: Wifi, switch: Router, gateway: Router, controller: Cpu };

interface Props {
  schoolId: string;
  ruijieSiteId: string | null;
  devices: DbDevice[];
}

export function DeviceManager({ schoolId, ruijieSiteId, devices }: Props) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DbDevice | null>(null);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: qk.school(schoolId) });
    qc.invalidateQueries({ queryKey: qk.schools });
  }

  async function remove(d: DbDevice) {
    if (!confirm(`Delete device "${d.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("devices").delete().eq("id", d.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Device deleted");
      refresh();
    }
  }

  async function syncFromRuijie() {
    if (!ruijieSiteId) {
      toast.error("School is not linked to a Ruijie site");
      return;
    }
    setSyncing(true);
    try {
      const r = await syncRuijieSchool(schoolId, ruijieSiteId);
      toast.success(`Synced ${r.devices} device(s)${r.bound ? `, bound ${r.bound} by MAC` : ""}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Cpu className="h-3.5 w-3.5" /> Manage Devices
        </h2>
        <div className="flex gap-2">
          {ruijieSiteId && (
            <Button size="sm" variant="outline" onClick={syncFromRuijie} disabled={syncing} className="h-7 px-2 text-xs">
              {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Cloud className="mr-1 h-3 w-3" />}
              Sync this school
            </Button>
          )}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(null)}>
                <Plus className="mr-1 h-3 w-3" /> Add device
              </Button>
            </DialogTrigger>
            <DeviceFormDialog schoolId={schoolId} editing={editing} onSaved={() => { setOpen(false); setEditing(null); refresh(); }} />
          </Dialog>
        </div>
      </div>

      {devices.length === 0 ? (
        <p className="text-xs text-muted-foreground">No devices yet. Add manually or sync from Ruijie.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Name</th>
                <th className="px-2 py-1.5 text-left">Type</th>
                <th className="px-2 py-1.5 text-left">MAC</th>
                <th className="px-2 py-1.5 text-left">Ruijie</th>
                <th className="px-2 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const Icon = ICONS[(d.type as DeviceType)] ?? Cpu;
                return (
                  <tr key={d.id} className="border-b border-border/40">
                    <td className="px-2 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        {d.name}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 capitalize text-muted-foreground">{d.type}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{d.mac_address ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      {d.ruijie_device_id ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-status-operational">
                          <Link2 className="h-3 w-3" /> bound
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">manual</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Dialog
                        open={open && editing?.id === d.id}
                        onOpenChange={(v) => {
                          if (v) {
                            setEditing(d);
                            setOpen(true);
                          } else {
                            setOpen(false);
                            setEditing(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(d)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DeviceFormDialog
                          schoolId={schoolId}
                          editing={editing?.id === d.id ? editing : null}
                          onSaved={() => { setOpen(false); setEditing(null); refresh(); }}
                        />
                      </Dialog>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => remove(d)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeviceFormDialog({ schoolId, editing, onSaved }: { schoolId: string; editing: DbDevice | null; onSaved: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<DeviceType>((editing?.type as DeviceType) ?? "ap");
  const [mac, setMac] = useState(editing?.mac_address ?? "");
  const [ruijieId, setRuijieId] = useState(editing?.ruijie_device_id ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = schema.safeParse({ name, type, mac_address: mac, ruijie_device_id: ruijieId });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      school_id: schoolId,
      name: parsed.data.name,
      type: parsed.data.type,
      mac_address: parsed.data.mac_address ? parsed.data.mac_address.toUpperCase() : null,
      ruijie_device_id: parsed.data.ruijie_device_id || null,
    };
    const { error } = editing
      ? await supabase.from("devices").update(payload).eq("id", editing.id)
      : await supabase.from("devices").insert({ ...payload, status: "operational" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Device updated" : "Device added");
    onSaved();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit device" : "Add device"}</DialogTitle>
        <DialogDescription>
          Add a network device installed at this school. If you provide a MAC address, it will be auto-bound to the matching Ruijie device on the next sync.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label htmlFor="d-name" className="text-xs">Name</Label>
          <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="AP-Lobby-1" />
        </div>
        <div>
          <Label htmlFor="d-type" className="text-xs">Type</Label>
          <select
            id="d-type"
            value={type}
            onChange={(e) => setType(e.target.value as DeviceType)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="d-mac" className="text-xs">MAC address (optional)</Label>
          <Input id="d-mac" value={mac} onChange={(e) => setMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" className="font-mono" />
          <p className="mt-1 text-[10px] text-muted-foreground">Used to auto-bind to Ruijie cloud on next sync.</p>
        </div>
        <div>
          <Label htmlFor="d-rj" className="text-xs">Ruijie device ID (optional)</Label>
          <Input id="d-rj" value={ruijieId} onChange={(e) => setRuijieId(e.target.value)} placeholder="RJ-DEV-1000-1" className="font-mono" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {editing ? "Save changes" : "Add device"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Dialog to bind an existing school to a Ruijie site by picking from the API list. */
export function BindRuijieSiteDialog({ schoolId, currentSiteId, schoolName }: { schoolId: string; currentSiteId: string | null; schoolName: string }) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<{ site_id: string; site_name: string; region: string; devices?: RuijieDevice[] }[]>([]);
  const [picked, setPicked] = useState<string>(currentSiteId ?? "");
  const [saving, setSaving] = useState(false);

  if (!hasRole("admin")) return null;

  async function loadSites() {
    setLoading(true);
    try {
      const list = await listRuijieSites();
      setSites(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    const value = picked || null;
    const { error } = await supabase.from("schools").update({ ruijie_site_id: value }).eq("id", schoolId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(value ? "Linked to Ruijie site" : "Unlinked from Ruijie");
    qc.invalidateQueries({ queryKey: qk.school(schoolId) });
    qc.invalidateQueries({ queryKey: qk.schools });
    // Auto-pull devices on link
    if (value) {
      try {
        const r = await syncRuijieSchool(schoolId, value);
        toast.success(`Pulled ${r.devices} device(s) from Ruijie`);
        qc.invalidateQueries({ queryKey: qk.school(schoolId) });
      } catch {
        // already toasted above; suppress
      }
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadSites(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
          <Link2 className="mr-1 h-3 w-3" />
          {currentSiteId ? "Re-link Ruijie" : "Link Ruijie site"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link "{schoolName}" to a Ruijie site</DialogTitle>
          <DialogDescription>
            Bind this school to a Ruijie Cloud site. Background polling and per-school sync will then keep its devices up to date.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Ruijie sites…
          </div>
        ) : (
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">— Not linked —</option>
            {sites.map((s) => (
              <option key={s.site_id} value={s.site_id}>
                {s.site_name} · {s.region} ({s.site_id})
              </option>
            ))}
          </select>
        )}
        <DialogFooter>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}