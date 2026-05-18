import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function admin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

type Priority = "critical" | "high" | "medium" | "low";

interface DraftTicket {
  ticket_number: string;
  root_cause: string;
  priority: Priority;
  status: string;
  title: string;
  description: string;
  school_ids: string[];
  device_ids: string[];
  report_ids: string[];
}

async function postTelegramAlert(payload: unknown) {
  // Scaffold: log to console. Once TELEGRAM_API_KEY + TELEGRAM_CHAT_ID
  // are set as secrets, swap this for a real fetch to the connector gateway.
  console.log("[telegram alert]", JSON.stringify(payload));
}

/** Recompute all tickets from current DB state. Replaces any existing open/in_progress tickets. */
export const recomputeTickets = createServerFn({ method: "POST" }).handler(async () => {
  const sb = admin();

  const [{ data: schools }, { data: devices }, { data: reports }, { data: cloud }] = await Promise.all([
    sb.from("schools").select("*"),
    sb.from("devices").select("*"),
    sb.from("teacher_reports").select("*"),
    sb.from("cloud_status").select("*").eq("id", 1).single(),
  ]);

  const schoolList = schools ?? [];
  const deviceList = devices ?? [];
  const reportList = reports ?? [];
  const cloudRow = cloud!;

  const devicesBySchool = new Map<string, typeof deviceList>();
  for (const d of deviceList) {
    if (!devicesBySchool.has(d.school_id)) devicesBySchool.set(d.school_id, []);
    devicesBySchool.get(d.school_id)!.push(d);
  }

  const drafts: DraftTicket[] = [];
  const handledSchools = new Set<string>();
  const handledReports = new Set<string>();
  let counter = 1000;
  const nextNum = () => `TKT-${++counter}`;

  // RULE 1: Cloud outage
  if (cloudRow.status === "down") {
    const affected = schoolList.filter((s) => !s.internet_check_ok);
    if (affected.length >= 1) {
      drafts.push({
        ticket_number: nextNum(),
        root_cause: "CLOUD_OUTAGE",
        priority: "critical",
        status: "open",
        title: `Amazon LEO outage affecting ${affected.length} school(s)`,
        description:
          "Upstream Amazon LEO satellite service is DOWN. Multiple schools have lost internet. All related alerts grouped under this incident.",
        school_ids: affected.map((s) => s.id),
        device_ids: [],
        report_ids: reportList
          .filter((r) => affected.some((s) => s.id === r.school_id))
          .map((r) => r.id),
      });
      affected.forEach((s) => handledSchools.add(s.id));
      reportList
        .filter((r) => affected.some((s) => s.id === r.school_id))
        .forEach((r) => handledReports.add(r.id));
    }
  }

  // RULES 2/3/4: per-school
  for (const s of schoolList) {
    if (handledSchools.has(s.id)) continue;
    const ds = devicesBySchool.get(s.id) ?? [];
    const down = ds.filter((d) => d.status === "down");
    const allDown = ds.length > 0 && down.length === ds.length;
    const someDown = down.length > 0 && !allDown;

    if (allDown && !s.gateway_reachable) {
      drafts.push({
        ticket_number: nextNum(),
        root_cause: "SITE_NETWORK_DOWN",
        priority: "critical",
        status: "open",
        title: `Site network down — ${s.name}`,
        description: `All ${ds.length} devices offline and gateway unreachable.`,
        school_ids: [s.id],
        device_ids: ds.map((d) => d.id),
        report_ids: collect(reportList, [s.id], handledReports),
      });
      handledSchools.add(s.id);
    } else if (someDown) {
      drafts.push({
        ticket_number: nextNum(),
        root_cause: "DEVICE_FAILURE",
        priority: down.length >= 3 ? "high" : "medium",
        status: "open",
        title: `${down.length} device(s) offline — ${s.name}`,
        description: `${down.map((d) => d.name).join(", ")} reporting offline.`,
        school_ids: [s.id],
        device_ids: down.map((d) => d.id),
        report_ids: collect(reportList, [s.id], handledReports),
      });
      handledSchools.add(s.id);
    } else if (!s.internet_check_ok && ds.every((d) => d.status === "operational")) {
      drafts.push({
        ticket_number: nextNum(),
        root_cause: "ISP_OR_UPSTREAM",
        priority: "high",
        status: "open",
        title: `Internet down (devices OK) — ${s.name}`,
        description: "Devices respond locally but internet check failing — likely ISP/upstream.",
        school_ids: [s.id],
        device_ids: [],
        report_ids: collect(reportList, [s.id], handledReports),
      });
      handledSchools.add(s.id);
    }
  }

  // RULE 5: mass user reports
  const bySchool = new Map<string, typeof reportList>();
  for (const r of reportList) {
    if (handledReports.has(r.id)) continue;
    if (!bySchool.has(r.school_id)) bySchool.set(r.school_id, []);
    bySchool.get(r.school_id)!.push(r);
  }
  for (const [sid, rs] of bySchool) {
    if (rs.length >= 3) {
      const s = schoolList.find((x) => x.id === sid);
      drafts.push({
        ticket_number: nextNum(),
        root_cause: "PERFORMANCE_DEGRADATION",
        priority: "high",
        status: "open",
        title: `Performance degradation reported — ${s?.name ?? sid}`,
        description: `${rs.length} teacher reports while devices appear online.`,
        school_ids: [sid],
        device_ids: [],
        report_ids: rs.map((r) => r.id),
      });
      rs.forEach((r) => handledReports.add(r.id));
    }
  }

  // RULE 6: remaining single user reports
  for (const r of reportList) {
    if (handledReports.has(r.id)) continue;
    const s = schoolList.find((x) => x.id === r.school_id);
    drafts.push({
      ticket_number: nextNum(),
      root_cause: "UNVERIFIED_USER_ISSUE",
      priority: "low",
      status: "open",
      title: `User report — ${s?.name ?? r.school_id}`,
      description: `Teacher reported: ${r.type.replace(/_/g, " ")}. No matching monitoring alert.`,
      school_ids: [r.school_id],
      device_ids: [],
      report_ids: [r.id],
    });
    handledReports.add(r.id);
  }

  // Replace open/in_progress tickets; preserve resolved ones
  await sb.from("tickets").delete().in("status", ["open", "in_progress"]);

  let inserted: { id: string; ticket_number: string; priority: string; root_cause: string; title: string }[] = [];
  if (drafts.length) {
    const { data, error } = await sb.from("tickets").insert(drafts).select("id,ticket_number,priority,root_cause,title");
    if (error) throw error;
    inserted = data ?? [];
  }

  // Activity + alerts for criticals
  const criticals = inserted.filter((t) => t.priority === "critical");
  if (criticals.length) {
    await sb.from("activity_log").insert(
      criticals.map((t) => ({
        kind: "ticket_critical",
        message: `Critical ticket created: ${t.title}`,
        meta: { ticket_id: t.id, ticket_number: t.ticket_number, root_cause: t.root_cause },
      })),
    );
    for (const t of criticals.filter((c) => c.root_cause === "CLOUD_OUTAGE")) {
      await postTelegramAlert({
        text: `🚨 CLOUD OUTAGE\n${t.title}\nTicket: ${t.ticket_number}`,
      });
    }
  }

  await sb.from("activity_log").insert({
    kind: "engine_run",
    message: `Root cause engine ran — ${drafts.length} ticket(s)`,
  });

  return { ticketCount: drafts.length };
});

function collect(reports: { id: string; school_id: string }[], schoolIds: string[], handled: Set<string>) {
  const ids: string[] = [];
  for (const r of reports) {
    if (schoolIds.includes(r.school_id) && !handled.has(r.id)) {
      ids.push(r.id);
      handled.add(r.id);
    }
  }
  return ids;
}

/** Toggle the cloud outage simulation. Marks ~25% of schools as no-internet when going down. */
export const toggleCloudOutage = createServerFn({ method: "POST" }).handler(async () => {
  const sb = admin();
  const { data: cur } = await sb.from("cloud_status").select("*").eq("id", 1).single();
  const goingDown = cur?.status !== "down";
  await sb
    .from("cloud_status")
    .update({
      status: goingDown ? "down" : "operational",
      latency_ms: goingDown ? 9999 : 42,
      last_check: new Date().toISOString(),
    })
    .eq("id", 1);

  if (goingDown) {
    // mark a chunk of schools as no-internet to simulate outage fan-out
    const { data: schools } = await sb.from("schools").select("id");
    const ids = (schools ?? []).filter((_, i) => i % 4 === 0).map((s) => s.id);
    if (ids.length) {
      await sb.from("schools").update({ internet_check_ok: false, status: "degraded" }).in("id", ids);
    }
  } else {
    await sb.from("schools").update({ internet_check_ok: true, status: "operational" }).eq("internet_check_ok", false);
  }

  await sb.from("activity_log").insert({
    kind: "cloud_toggle",
    message: goingDown ? "Simulated Amazon LEO outage" : "Cloud recovered",
  });

  return { status: goingDown ? "down" : "operational" };
});

/**
 * Update ticket status / assignee. Authenticated + scoped:
 * - Validates input with Zod.
 * - Verifies the caller can manage every school the ticket is attached to via
 *   public.can_manage_ticket(uid, school_ids) before performing the write.
 * - Uses the user-scoped Supabase client so RLS is the second line of defense.
 */
const updateTicketInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  resolution_notes: z.string().trim().max(2000).optional(),
});

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateTicketInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load the ticket to know which schools it touches.
    const { data: ticket, error: loadErr } = await supabase
      .from("tickets")
      .select("id, school_ids, status")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!ticket) throw new Response("Ticket not found", { status: 404 });

    // Server-side permission check (independent of RLS).
    const { data: allowed, error: permErr } = await supabase.rpc("can_manage_ticket", {
      _user_id: userId,
      _school_ids: (ticket.school_ids ?? []) as string[],
    });
    if (permErr) throw permErr;
    if (!allowed) throw new Response("Forbidden", { status: 403 });

    if (data.status === "resolved" && !data.resolution_notes) {
      // Make sure resolution_notes is present on the row before allowing close.
      const { data: cur } = await supabase
        .from("tickets")
        .select("resolution_notes")
        .eq("id", data.id)
        .maybeSingle();
      if (!cur?.resolution_notes?.trim()) {
        throw new Response("Resolution notes required to close ticket", { status: 400 });
      }
    }

    const patch: Database["public"]["Tables"]["tickets"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (data.status) {
      patch.status = data.status;
      if (data.status === "resolved") patch.closed_at = new Date().toISOString();
    }
    if (data.assignee_id !== undefined) patch.assignee_id = data.assignee_id;
    if (data.resolution_notes !== undefined) patch.resolution_notes = data.resolution_notes;

    const { error } = await supabase.from("tickets").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Manually create a ticket. Strictly validated and permission-checked: caller must be
 * able to manage every school in school_ids.
 */
const createTicketInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional().default(""),
  priority: z.enum(["critical", "high", "medium", "low"]),
  root_cause: z.enum([
    "CLOUD_OUTAGE",
    "SITE_NETWORK_DOWN",
    "DEVICE_FAILURE",
    "ISP_OR_UPSTREAM",
    "PERFORMANCE_DEGRADATION",
    "UNVERIFIED_USER_ISSUE",
  ]),
  school_ids: z.array(z.string().uuid()).min(1).max(200),
  device_ids: z.array(z.string().uuid()).max(500).optional().default([]),
  report_ids: z.array(z.string().uuid()).max(500).optional().default([]),
});

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createTicketInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: allowed, error: permErr } = await supabase.rpc("can_manage_ticket", {
      _user_id: userId,
      _school_ids: data.school_ids,
    });
    if (permErr) throw permErr;
    if (!allowed) throw new Response("Forbidden: cannot create tickets for these schools", { status: 403 });

    const ticket_number = `TKT-${Date.now().toString().slice(-7)}`;
    const { data: created, error } = await supabase
      .from("tickets")
      .insert({
        ticket_number,
        title: data.title,
        description: data.description ?? "",
        priority: data.priority,
        root_cause: data.root_cause,
        status: "open",
        school_ids: data.school_ids,
        device_ids: data.device_ids ?? [],
        report_ids: data.report_ids ?? [],
      })
      .select("id, ticket_number")
      .single();
    if (error) throw error;
    return created;
  });