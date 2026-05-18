import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listRuijieSites, listRuijieDevices, ruijieStatusToDb } from "@/lib/integrations/ruijie";

/**
 * Server-side scheduled poll. Designed to be called by pg_cron every ~15 min.
 * Runs even when no admin tab is open. Uses service role key (bypasses RLS).
 * Mirrors `pollRuijieDeviceStatus` but server-flavored.
 */
export const Route = createFileRoute("/api/public/hooks/ruijie-poll")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler() {
  const startedAt = new Date().toISOString();
  let updatedDevices = 0;
  let updatedSchools = 0;
  const errors: string[] = [];

  try {
    const sites = await listRuijieSites();
    for (const site of sites) {
      const { error: schoolErr } = await supabaseAdmin
        .from("schools")
        .update({
          status: site.online ? "operational" : "down",
          gateway_reachable: site.online,
          internet_check_ok: site.online,
        })
        .eq("ruijie_site_id", site.site_id);
      if (schoolErr) errors.push(`school ${site.site_id}: ${schoolErr.message}`);
      else updatedSchools++;

      const devices = await listRuijieDevices(site.site_id);
      const now = new Date().toISOString();
      for (const d of devices) {
        const upd = await supabaseAdmin
          .from("devices")
          .update({
            status: ruijieStatusToDb(d.status),
            last_seen: d.last_seen,
            uptime_pct: d.uptime_pct,
            last_status_check_at: now,
          })
          .eq("ruijie_device_id", d.device_id)
          .select("id");
        if (upd.error) {
          errors.push(`device ${d.device_id}: ${upd.error.message}`);
        } else if (upd.data && upd.data.length > 0) {
          updatedDevices += upd.data.length;
        } else if (d.mac) {
          // auto-bind by MAC for manually-added devices
          const bind = await supabaseAdmin
            .from("devices")
            .update({
              ruijie_device_id: d.device_id,
              status: ruijieStatusToDb(d.status),
              last_seen: d.last_seen,
              uptime_pct: d.uptime_pct,
              last_status_check_at: now,
            })
            .ilike("mac_address", d.mac)
            .is("ruijie_device_id", null)
            .select("id");
          if (bind.error) errors.push(`bind ${d.device_id}: ${bind.error.message}`);
          else if (bind.data) updatedDevices += bind.data.length;
        }
      }
    }

    await supabaseAdmin.from("activity_log").insert({
      kind: "ruijie_poll",
      message: `Server poll updated ${updatedDevices} devices across ${updatedSchools} schools`,
      meta: { source: "cron", devices: updatedDevices, schools: updatedSchools, errors: errors.length },
    });

    return Response.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      updatedDevices,
      updatedSchools,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}