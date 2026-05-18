import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "./queries";

/** Subscribe to all NOC tables and invalidate the relevant queries on changes. */
export function useNocRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("noc-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        qc.invalidateQueries({ queryKey: qk.tickets });
        qc.invalidateQueries({ queryKey: qk.activity });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schools" }, () => {
        qc.invalidateQueries({ queryKey: qk.schools });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => {
        qc.invalidateQueries({ queryKey: qk.schools });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cloud_status" }, () => {
        qc.invalidateQueries({ queryKey: qk.cloud });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teacher_reports" }, () => {
        qc.invalidateQueries({ queryKey: qk.reports });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => {
        qc.invalidateQueries({ queryKey: qk.activity });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}