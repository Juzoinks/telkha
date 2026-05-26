import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Status } from "./types";
import { z } from "zod";

export interface DbDevice {
  id: string;
  school_id: string;
  name: string;
  type: string;
  status: Status;
  last_seen: string;
  uptime_pct?: number | null;
  config_hash?: string | null;
  mac_address?: string | null;
  ruijie_device_id?: string | null;
}
export interface DbSchool {
  id: string;
  name: string;
  region: string;
  status: Status;
  gateway_reachable: boolean;
  internet_check_ok: boolean;
  province?: string | null;
  isp_type?: string | null;
  last_visit_at?: string | null;
  last_synced_at?: string | null;
  ruijie_site_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  devices?: DbDevice[];
}
export interface DbTicket {
  id: string;
  ticket_number: string;
  root_cause: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  school_ids: string[];
  device_ids: string[];
  report_ids: string[];
  assignee_id: string | null;
  assignee_name: string | null;
  site_location: string | null;
  created_at: string;
  updated_at: string;
  sla_due_at: string | null;
  resolution_notes: string | null;
  confidence: number | null;
  closed_at: string | null;
}
export interface DbReport {
  id: string;
  school_id: string;
  type: string;
  message: string | null;
  created_at: string;
  report_status: "new" | "confirmed" | "closed";
  linked_ticket_id: string | null;
  linked_ticket_number: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reporter_id: string | null;
}
export interface DbReportableSchool {
  id: string;
  name: string;
  region: string;
}
export interface DbCloud {
  id: number;
  service: string;
  status: Status;
  latency_ms: number;
  last_check: string;
}
export interface DbActivity {
  id: string;
  kind: string;
  message: string;
  created_at: string;
}

export const qk = {
  schools: ["schools"] as const,
  school: (id: string) => ["school", id] as const,
  tickets: ["tickets"] as const,
  cloud: ["cloud"] as const,
  reports: ["reports"] as const,
  reportableSchools: ["reportable-schools"] as const,
  activity: ["activity"] as const,
  notifications: ["notifications"] as const,
  comments: (ticketId: string) => ["ticket-comments", ticketId] as const,
  audit: ["audit-log"] as const,
  myReports: ["my-reports"] as const,
  maintenance: ["maintenance-windows"] as const,
};

export function useSchools() {
  return useQuery({
    queryKey: qk.schools,
    queryFn: async (): Promise<DbSchool[]> => {
      const { data, error } = await supabase
        .from("schools")
        .select(
          "id,name,region,status,gateway_reachable,internet_check_ok,province,isp_type,last_visit_at,last_synced_at,ruijie_site_id,latitude,longitude,devices(id,school_id,name,type,status,last_seen,uptime_pct,config_hash,mac_address,ruijie_device_id)",
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as DbSchool[];
    },
    // Background polling: refresh device/school status every 30s so dashboards stay live
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useSchool(id: string) {
  return useQuery({
    queryKey: qk.school(id),
    queryFn: async (): Promise<DbSchool | null> => {
      const { data, error } = await supabase
        .from("schools")
        .select(
          "id,name,region,status,gateway_reachable,internet_check_ok,province,isp_type,last_visit_at,last_synced_at,ruijie_site_id,latitude,longitude,devices(id,school_id,name,type,status,last_seen,uptime_pct,config_hash,mac_address,ruijie_device_id)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DbSchool) ?? null;
    },
    refetchInterval: 30_000,
  });
}

export function useTickets(enabled = true) {
  return useQuery({
    queryKey: qk.tickets,
    enabled,
    queryFn: async (): Promise<DbTicket[]> => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbTicket[];
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Validated, paginated tickets queries                              */
/* ------------------------------------------------------------------ */

const ticketStatusSchema = z.enum(["all", "open", "in_progress", "resolved"]);
const ticketPrioritySchema = z.enum(["all", "critical", "high", "medium", "low"]);
const ticketSortSchema = z.enum(["created_at", "priority", "status"]);
const ticketSearchSchema = z
  .string()
  .max(100)
  .regex(/^[\p{L}\p{N}\s._@\-:#]*$/u, "Invalid characters in search")
  .optional()
  .or(z.literal(""));

export interface PaginatedTickets {
  rows: DbTicket[];
  total: number;
}

export function useTicketsPaged(opts: {
  status: "all" | "open" | "in_progress" | "resolved";
  priority: "all" | "critical" | "high" | "medium" | "low";
  search?: string;
  sort?: "created_at" | "priority" | "status";
  page: number;
  pageSize?: number;
  enabled?: boolean;
}) {
  const status = ticketStatusSchema.parse(opts.status);
  const priority = ticketPrioritySchema.parse(opts.priority);
  const sort = ticketSortSchema.parse(opts.sort ?? "created_at");
  const search = (ticketSearchSchema.parse(opts.search ?? "") || "").trim();
  const page = Math.max(0, Math.floor(opts.page));
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 25));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ["tickets-paged", status, priority, search, sort, page, pageSize],
    enabled: opts.enabled ?? true,
    queryFn: async (): Promise<PaginatedTickets> => {
      let q = supabase
        .from("tickets")
        .select("*", { count: "exact" })
        .order(sort, { ascending: false })
        .range(from, to);
      if (status !== "all") q = q.eq("status", status);
      if (priority !== "all") q = q.eq("priority", priority);
      if (search) {
        const safe = search.replace(/[%,]/g, " ");
        q = q.or(
          `title.ilike.%${safe}%,ticket_number.ilike.%${safe}%,description.ilike.%${safe}%`,
        );
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as DbTicket[], total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}

/** Per-status counts for ticket tabs — head-only requests. */
export function useTicketCounts() {
  return useQuery({
    queryKey: ["ticket-counts"],
    queryFn: async () => {
      const statuses = ["open", "in_progress", "resolved"] as const;
      const [allRes, ...rest] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true }),
        ...statuses.map((s) =>
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("status", s),
        ),
      ]);
      if (allRes.error) throw allRes.error;
      for (const r of rest) if (r.error) throw r.error;
      return {
        all: allRes.count ?? 0,
        open: rest[0].count ?? 0,
        in_progress: rest[1].count ?? 0,
        resolved: rest[2].count ?? 0,
      };
    },
    staleTime: 10_000,
  });
}

export function useCloud(enabled = true) {
  return useQuery({
    queryKey: qk.cloud,
    enabled,
    queryFn: async (): Promise<DbCloud> => {
      const { data, error } = await supabase.from("cloud_status").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as DbCloud;
    },
  });
}

export function useReports(schoolId?: string) {
  return useQuery({
    queryKey: schoolId ? ["reports", schoolId] : qk.reports,
    queryFn: async (): Promise<DbReport[]> => {
      let q = supabase
        .from("teacher_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (schoolId) q = q.eq("school_id", schoolId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DbReport[];
    },
  });
}

/**
 * Server-side filtered + paginated reports query.
 * Filter and search are validated; pagination uses .range() so the dataset
 * cannot grow unbounded on the client.
 */
const reportStatusSchema = z.enum(["all", "new", "confirmed", "closed"]);
const reportSearchSchema = z
  .string()
  .max(100)
  .regex(/^[\p{L}\p{N}\s._@\-:#]*$/u, "Invalid characters in search")
  .optional()
  .or(z.literal(""));

export interface PaginatedReports {
  rows: DbReport[];
  total: number;
}

export function useReportsPaged(opts: {
  status: "all" | "new" | "confirmed" | "closed";
  search?: string;
  page: number;
  pageSize?: number;
}) {
  const status = reportStatusSchema.parse(opts.status);
  const search = (reportSearchSchema.parse(opts.search ?? "") || "").trim();
  const page = Math.max(0, Math.floor(opts.page));
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 25));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ["reports-paged", status, search, page, pageSize],
    queryFn: async (): Promise<PaginatedReports> => {
      let q = supabase
        .from("teacher_reports")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (status !== "all") q = q.eq("report_status", status);
      if (search) {
        // Safe: search is validated to a restricted character set; escape % and , for PostgREST or() syntax.
        const safe = search.replace(/[%,]/g, " ");
        q = q.or(
          `message.ilike.%${safe}%,linked_ticket_number.ilike.%${safe}%,type.ilike.%${safe}%`,
        );
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as DbReport[], total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}

/** Lightweight head-only counts per status — used so tab counts stay correct under pagination. */
export function useReportCounts() {
  return useQuery({
    queryKey: ["report-counts"],
    queryFn: async () => {
      const statuses = ["new", "confirmed", "closed"] as const;
      const [allRes, ...rest] = await Promise.all([
        supabase.from("teacher_reports").select("id", { count: "exact", head: true }),
        ...statuses.map((s) =>
          supabase
            .from("teacher_reports")
            .select("id", { count: "exact", head: true })
            .eq("report_status", s),
        ),
      ]);
      if (allRes.error) throw allRes.error;
      for (const r of rest) if (r.error) throw r.error;
      return {
        all: allRes.count ?? 0,
        new: rest[0].count ?? 0,
        confirmed: rest[1].count ?? 0,
        closed: rest[2].count ?? 0,
      };
    },
    staleTime: 10_000,
  });
}

export function useReportableSchools(enabled = true) {
  return useQuery({
    queryKey: qk.reportableSchools,
    enabled,
    queryFn: async (): Promise<DbReportableSchool[]> => {
      const { data, error } = await supabase.rpc("list_reportable_schools");
      if (error) throw error;
      return (data ?? []) as DbReportableSchool[];
    },
  });
}

export function useActivity() {
  return useQuery({
    queryKey: qk.activity,
    queryFn: async (): Promise<DbActivity[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DbActivity[];
    },
  });
}