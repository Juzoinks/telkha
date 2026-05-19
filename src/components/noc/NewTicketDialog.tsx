import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/noc/queries";
import { toast } from "sonner";

type Priority = "low" | "medium" | "high" | "critical";

export function NewTicketDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("low");
  const [siteLocation, setSiteLocation] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("low");
    setSiteLocation("");
    setRootCause("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("tickets").insert({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        site_location: siteLocation.trim() || null,
        root_cause: rootCause.trim() || null,
        status: "open",
      });

      if (error) throw error;

      toast.success("Ticket created", { description: "NOC has been notified." });
      qc.invalidateQueries({ queryKey: qk.tickets });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error("Could not create ticket", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-zinc-900 border border-zinc-700">
        <DialogHeader>
          <DialogTitle>Create a new ticket</DialogTitle>
          <DialogDescription>
            Fill in the details below. The team will be notified and dispatch accordingly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="nt-title">Title *</Label>
            <Input
              id="nt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Network down at School A"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="nt-description">Description</Label>
            <textarea
              id="nt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="nt-priority">Priority</Label>
              <select
                id="nt-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nt-location">Site Location</Label>
              <Input
                id="nt-location"
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="e.g. School B, Tirana"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="nt-rootcause">Root Cause</Label>
            <Input
              id="nt-rootcause"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="e.g. Router failure, ISP outage..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Create ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewTicketDialog;