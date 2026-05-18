import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { qk } from "@/lib/noc/queries";
import { pollRuijieDeviceStatus } from "@/lib/integrations/ruijie-sync";

interface Props {
  /** When provided, also invalidates that single school cache. */
  schoolId?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  label?: string;
}

export function RefreshDevicesButton({ schoolId, size = "sm", variant = "outline", label = "Refresh device status" }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  async function refresh() {
    if (running) return;
    setRunning(true);
    try {
      const r = await pollRuijieDeviceStatus();
      qc.invalidateQueries({ queryKey: qk.schools });
      if (schoolId) qc.invalidateQueries({ queryKey: qk.school(schoolId) });
      toast.success(`Refreshed ${r.updated} device(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button size={size} variant={variant} onClick={refresh} disabled={running} className="h-8 px-2 text-xs">
      {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
      {running ? "Refreshing…" : label}
    </Button>
  );
}