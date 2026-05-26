import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, User, Clock, Tag, MapPin, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { qk } from "@/lib/noc/queries";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  root_cause: string;
  site_location: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  created_at: string;
  resolution_notes: string | null;
}

interface Technician {
  id: string;
  email: string | null;
  full_name: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  resolved: "bg-green-500/20 text-green-400",
};

function useTechnicians() {
  return useQuery({
    queryKey: ["technicians"],
    queryFn: async (): Promise<Technician[]> => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return (data ?? []).filter((u: { roles: string[] }) =>
        u.roles.includes("technician") || u.roles.includes("admin")
      ) as Technician[];
    },
  });
}

export function TicketDetailPanel({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const { data: technicians = [] } = useTechnicians();

  const [status, setStatus] = useState(ticket.status);
  const [assigneeId, setAssigneeId] = useState(ticket.assignee_id ?? "");
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (assigneeId) {
        patch.assignee_id = assigneeId;
        const tech = technicians.find((t) => t.id === assigneeId);
        patch.assignee_name = tech?.full_name ?? tech?.email ?? null;
      } else {
        patch.assignee_id = null;
        patch.assignee_name = null;
      }
      if (status === "resolved") {
        if (!resolutionNotes.trim()) {
          toast.error("Resolution notes required to close a ticket.");
          setSaving(false);
          return;
        }
        patch.resolution_notes = resolutionNotes.trim();
        patch.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("tickets")
        .update(patch)
        .eq("id", ticket.id);

      if (error) throw error;

      toast.success("Ticket updated");
      qc.invalidateQueries({ queryKey: qk.tickets });
      onClose();
    } catch (err) {
      toast.error("Failed to update ticket", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-background border-l border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="space-y-1 flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${PRIORITY_COLOR[ticket.priority] ?? ""}`}>
                {ticket.priority}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[ticket.status] ?? ""}`}>
                {ticket.status.replace("_", " ")}
              </span>
            </div>
            <h2 className="text-base font-semibold">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent/50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              <span>{ticket.root_cause?.replace(/_/g, " ")}</span>
            </div>
            {ticket.site_location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{ticket.site_location}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{new Date(ticket.created_at).toLocaleString()}</span>
            </div>
            {ticket.assignee_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{ticket.assignee_name}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {ticket.description && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</p>
              <p className="text-sm text-foreground whitespace-pre-wrap rounded-md bg-muted/40 p-3">
                {ticket.description}
              </p>
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manage Ticket</p>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {/* Assign technician */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Assign To</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name ?? t.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resolution notes (required when resolving) */}
              {status === "resolved" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Resolution Notes <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                    placeholder="What was done to resolve this issue?"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {/* Resolution notes (read-only for technicians) */}
          {!isAdmin && ticket.resolution_notes && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resolution Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap rounded-md bg-muted/40 p-3">
                {ticket.resolution_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}