import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserCog, School as SchoolIcon, Check, Crown, Users, Trash2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth/AuthProvider";
import { useSchools } from "@/lib/noc/queries";
import { useAuditLog } from "@/lib/noc/extra-queries";
import { roleLabel, accessSummary } from "@/lib/auth/roles";
import { RequireRole } from "@/components/noc/Guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — User Access Management" },
      { name: "description", content: "Grant or revoke Admin/Support roles and assign which schools each user can manage." },
    ],
  }),
  component: () => (
    <RequireRole allow={["admin"]}>
      <AdminPage />
    </RequireRole>
  ),
});

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: AppRole[];
}

interface AccessRow {
  user_id: string;
  school_id: string;
}

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
    staleTime: 30_000,
  });
}

function useAccess() {
  return useQuery({
    queryKey: ["admin-access"],
    queryFn: async (): Promise<AccessRow[]> => {
      const { data, error } = await supabase.from("user_school_access").select("user_id,school_id");
      if (error) throw error;
      return (data ?? []) as AccessRow[];
    },
    staleTime: 30_000,
  });
}

function useAdminExists() {
  return useQuery({
    queryKey: ["admin-exists"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("admin_exists");
      if (error) throw error;
      return !!data;
    },
    staleTime: 60_000,
  });
}

const ROLE_BADGE: Record<AppRole, string> = {
  admin: "bg-priority-high/15 text-priority-high border-priority-high/40",
  technician: "bg-primary/15 text-primary border-primary/40",
  teacher: "bg-muted text-muted-foreground border-border",
};

function RoleBadges({ roles }: { roles: AppRole[] }) {
  if (!roles.length) return <Badge variant="outline" className="text-[10px]">No role</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span key={r} className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_BADGE[r]}`}>
          {roleLabel(r)}
        </span>
      ))}
    </div>
  );
}

function relTime(iso: string | null) {
  if (!iso) return "Never signed in";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function AdminPage() {
  const { user, roles, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useUsers();
  const { data: access = [] } = useAccess();
  const { data: schools = [] } = useSchools();
  const { data: adminAlreadyExists } = useAdminExists();
  const { data: auditEntries = [] } = useAuditLog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [bootstrapping, setBootstrapping] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>(null);

  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (!selectedId && users.length) setSelectedId(users[0].id);
  }, [users, selectedId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => (u.email ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const selected = users.find((u) => u.id === selectedId) ?? null;
  const selectedAccess = useMemo(
    () => new Set(access.filter((a) => a.user_id === selectedId).map((a) => a.school_id)),
    [access, selectedId],
  );

  async function logAudit(action: string, targetId: string, diff: Record<string, unknown>) {
    await supabase.from("audit_log").insert([{
      actor_id: user?.id ?? null,
      action,
      target_type: "user",
      target_id: targetId,
      diff: diff as never,
    }]);
  }

  async function bootstrapAdmin() {
    if (!user) return;
    setBootstrapping(true);
    const { data, error } = await supabase.rpc("bootstrap_first_admin", { _user_id: user.id });
    if (error) toast.error(error.message);
    else if (data === true) {
      toast.success("You are now Admin.");
      await refreshRoles();
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-exists"] });
    } else toast.error("An admin already exists.");
    setBootstrapping(false);
  }

  async function applyRole(userId: string, role: AppRole, on: boolean) {
    if (on) await supabase.from("user_roles").insert({ user_id: userId, role });
    else await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    await logAudit(on ? "role.grant" : "role.revoke", userId, { role });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["audit-log"] });
  }

  function toggleRole(userId: string, role: AppRole, has: boolean) {
    setConfirm({
      title: has ? `Remove ${roleLabel(role)} role?` : `Grant ${roleLabel(role)} role?`,
      description: `This will ${has ? "revoke" : "grant"} the ${roleLabel(role)} role for the selected user.`,
      onConfirm: async () => {
        await applyRole(userId, role, !has);
        toast.success(`Role ${has ? "removed" : "granted"}`);
      },
    });
  }

  function toggleSchool(userId: string, schoolId: string, on: boolean) {
    const sName = schools.find((s) => s.id === schoolId)?.name ?? schoolId.slice(0, 8);
    setConfirm({
      title: on ? `Remove access to ${sName}?` : `Grant access to ${sName}?`,
      description: on
        ? `User will no longer be able to manage ${sName}.`
        : `User will be able to manage ${sName}.`,
      onConfirm: async () => {
        if (on) {
          await supabase.from("user_school_access").delete().eq("user_id", userId).eq("school_id", schoolId);
        } else {
          await supabase.from("user_school_access").insert({ user_id: userId, school_id: schoolId });
        }
        await logAudit(on ? "school.revoke" : "school.grant", userId, { school_id: schoolId, school_name: sName });
        qc.invalidateQueries({ queryKey: ["admin-access"] });
        qc.invalidateQueries({ queryKey: ["audit-log"] });
        toast.success(`School access updated`);
      },
    });
  }

  function bulkApplyRole(role: AppRole, grant: boolean) {
    if (!bulk.size) return;
    setConfirm({
      title: `${grant ? "Grant" : "Revoke"} ${roleLabel(role)} for ${bulk.size} users?`,
      description: `This will ${grant ? "grant" : "revoke"} the ${roleLabel(role)} role for all selected users.`,
      onConfirm: async () => {
        for (const uid of bulk) await applyRole(uid, role, grant);
        toast.success(`Updated ${bulk.size} users`);
        setBulk(new Set());
      },
    });
  }

  function toggleBulk(id: string) {
    setBulk((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Hide bootstrap if an admin already exists in the workspace
  if (!isAdmin) {
    if (adminAlreadyExists) {
      return (
        <div className="mx-auto max-w-md space-y-4 p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">
            An admin already exists for this workspace. Ask them to grant you access.
          </p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <Crown className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold">Claim first admin</h1>
        <p className="text-sm text-muted-foreground">
          No admin exists yet. You can claim the first admin seat for this workspace.
        </p>
        <Button onClick={bootstrapAdmin} disabled={bootstrapping}>
          {bootstrapping ? "Working…" : "Make me the first admin"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="h-6 w-6 text-primary" /> User Access Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage Admin/Support roles and assign schools that Support users can manage.
        </p>
      </div>

      {bulk.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-medium">{bulk.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkApplyRole("technician", true)}>+ Support</Button>
            <Button size="sm" variant="outline" onClick={() => bulkApplyRole("technician", false)}>− Support</Button>
            <Button size="sm" variant="outline" onClick={() => bulkApplyRole("admin", true)}>+ Admin</Button>
            <Button size="sm" variant="ghost" onClick={() => setBulk(new Set())}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3">
            <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[70vh] overflow-auto">
            {isLoading && (
              <div className="space-y-2 p-3">
                {[1,2,3,4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            )}
            {filtered.map((u) => {
              const isSel = selectedId === u.id;
              const isChecked = bulk.has(u.id);
              return (
                <div
                  key={u.id}
                  className={`flex items-start gap-2 border-b border-border p-3 transition-colors hover:bg-accent/40 ${isSel ? "bg-accent/60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleBulk(u.id)}
                    className="mt-1.5"
                    aria-label="Select user"
                  />
                  <button onClick={() => setSelectedId(u.id)} className="flex w-full flex-col items-start gap-1 text-left">
                    <span className="text-sm font-medium">{u.full_name || u.email}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                    <RoleBadges roles={u.roles} />
                    <span className="text-[10px] text-muted-foreground">Last active: {relTime(u.last_sign_in_at)}</span>
                  </button>
                </div>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No users found.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">{selected.full_name || selected.email}</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{selected.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">Last active: {relTime(selected.last_sign_in_at)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{accessSummary(selected.roles)}</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {(["admin", "technician", "teacher"] as AppRole[]).map((r) => {
                    const has = selected.roles.includes(r);
                    const isSelf = selected.id === user?.id;
                    const lockSelfAdmin = isSelf && r === "admin" && has;
                    return (
                      <button
                        key={r}
                        disabled={lockSelfAdmin}
                        onClick={() => toggleRole(selected.id, r, has)}
                        className={`flex items-center justify-between rounded-md border p-3 text-sm transition-colors ${
                          has
                            ? "border-primary bg-accent text-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-accent/30"
                        } ${lockSelfAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                        title={lockSelfAdmin ? "You can't revoke your own Admin role" : ""}
                      >
                        <span className="font-medium text-foreground">{roleLabel(r)}</span>
                        {has && <Check className="h-4 w-4 text-status-operational" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <SchoolIcon className="h-4 w-4 text-primary" /> School access
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selected.roles.includes("admin")
                      ? "Admins manage all schools"
                      : `${selectedAccess.size} of ${schools.length} assigned`}
                  </span>
                </div>
                {selected.roles.includes("admin") ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Admins automatically have access to every school.
                  </p>
                ) : (
                  <div className="mt-3 grid max-h-[50vh] gap-1 overflow-auto sm:grid-cols-2">
                    {schools.map((s) => {
                      const on = selectedAccess.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleSchool(selected.id, s.id, on)}
                          className={`flex items-center justify-between rounded-md border p-2 text-sm transition-colors ${
                            on
                              ? "border-primary bg-accent"
                              : "border-border bg-background text-muted-foreground hover:bg-accent/30"
                          }`}
                        >
                          <span>
                            <span className="font-medium text-foreground">{s.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{s.region}</span>
                          </span>
                          {on && <Check className="h-4 w-4 text-status-operational" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Select a user to manage their access.
            </div>
          )}
        </div>
      </div>

      {/* Recent audit log */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4 text-primary" /> Recent permission changes
          </h2>
          <span className="text-xs text-muted-foreground">Last {Math.min(50, auditEntries.length)} entries</span>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/30 text-left uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Action</th>
                <th className="p-2">Target user</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries
                .filter((e) => e.action.startsWith("role.") || e.action.startsWith("school."))
                .slice(0, 50)
                .map((e) => {
                  const tu = users.find((u) => u.id === e.target_id);
                  const ac = users.find((u) => u.id === e.actor_id);
                  return (
                    <tr key={e.id} className="border-b border-border/50 last:border-0">
                      <td className="p-2 text-muted-foreground" suppressHydrationWarning>
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="p-2">{ac?.full_name || ac?.email || "system"}</td>
                      <td className="p-2"><span className="rounded bg-muted px-1.5 py-0.5">{e.action}</span></td>
                      <td className="p-2">{tu?.full_name || tu?.email || e.target_id?.slice(0, 8)}</td>
                      <td className="p-2 text-muted-foreground">{JSON.stringify(e.diff)}</td>
                    </tr>
                  );
                })}
              {auditEntries.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No changes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const fn = confirm?.onConfirm;
                setConfirm(null);
                if (fn) await fn();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
