import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "./queries";

export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface DbTicketComment {
  id: string;
  ticket_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
}

export interface DbAuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  diff: Record<string, unknown>;
  created_at: string;
}

export interface DbMaintenance {
  id: string;
  school_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DbSiteNote {
  id: string;
  school_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: qk.notifications,
    enabled: !!userId,
    queryFn: async (): Promise<DbNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DbNotification[];
    },
  });
}

export function useComments(ticketId: string) {
  return useQuery({
    queryKey: qk.comments(ticketId),
    enabled: !!ticketId,
    queryFn: async (): Promise<DbTicketComment[]> => {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbTicketComment[];
    },
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: qk.audit,
    queryFn: async (): Promise<DbAuditEntry[]> => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as DbAuditEntry[];
    },
  });
}

export function useMaintenanceWindows() {
  return useQuery({
    queryKey: qk.maintenance,
    queryFn: async (): Promise<DbMaintenance[]> => {
      const { data, error } = await supabase
        .from("maintenance_windows")
        .select("*")
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbMaintenance[];
    },
  });
}

export function useSchoolMaintenance(schoolId: string) {
  return useQuery({
    queryKey: ["maintenance-windows", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<DbMaintenance[]> => {
      const { data, error } = await supabase
        .from("maintenance_windows")
        .select("*")
        .eq("school_id", schoolId)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbMaintenance[];
    },
  });
}

export function useSiteNotes(schoolId: string) {
  return useQuery({
    queryKey: ["site-notes", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<DbSiteNote[]> => {
      const { data, error } = await supabase
        .from("site_notes")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbSiteNote[];
    },
  });
}