import { supabase } from "@/integrations/supabase/client";
import { listRuijieSites, listRuijieDevices, ruijieStatusToDb } from "./ruijie";

export interface RuijieSyncResult {
  schools: number;
  devices: number;
  errors: string[];
  at: string;
}

/**
 * Pulls all sites + devices from Ruijie (mock) and upserts them into the database.
 * Idempotent: matches existing records by `ruijie_site_id` / `ruijie_device_id`.
 */
export async function runRuijieSync(filterSiteIds?: string[]): Promise<RuijieSyncResult> {
  const allSites = await listRuijieSites();
  const sites = filterSiteIds ? allSites.filter((s) => filterSiteIds.includes(s.site_id)) : allSites;

  let schoolsCount = 0;
  let devicesCount = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (const site of sites) {
    const devices = await listRuijieDevices(site.site_id);

    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .upsert(
        {
          ruijie_site_id: site.site_id,
          name: site.site_name,
          region: site.region,
          province: site.province,
          isp_type: site.isp_type,
          status: site.online ? "operational" : "down",
          gateway_reachable: site.online,
          internet_check_ok: site.online,
          last_synced_at: now,
        },
        { onConflict: "ruijie_site_id" },
      )
      .select("id")
      .single();

    if (schoolErr || !school) {
      errors.push(`${site.site_name}: ${schoolErr?.message ?? "no row"}`);
      continue;
    }
    schoolsCount++;

    if (devices.length > 0) {
      const rows = devices.map((d) => ({
        ruijie_device_id: d.device_id,
        school_id: school.id,
        name: d.name,
        type: d.type,
        status: ruijieStatusToDb(d.status),
        mac_address: d.mac,
        uptime_pct: d.uptime_pct,
        last_seen: d.last_seen,
        last_status_check_at: now,
      }));
      const { error: devErr } = await supabase
        .from("devices")
        .upsert(rows, { onConflict: "ruijie_device_id" });
      if (devErr) errors.push(`Devices for ${site.site_name}: ${devErr.message}`);
      else devicesCount += rows.length;
    }
  }

  await supabase.from("activity_log").insert({
    kind: "ruijie_sync",
    message: `Synced ${schoolsCount} schools and ${devicesCount} devices from Ruijie`,
    meta: { schools: schoolsCount, devices: devicesCount, errors: errors.length, scheduled: !filterSiteIds },
  });

  return { schools: schoolsCount, devices: devicesCount, errors, at: now };
}

/** Refresh just device statuses (lighter — no school upserts). Used by background poll.
 *  Also auto-binds manually-added devices to Ruijie devices when MAC matches. */
export async function pollRuijieDeviceStatus(): Promise<{ updated: number; bound: number; at: string }> {
  const sites = await listRuijieSites();
  const now = new Date().toISOString();
  let updated = 0;
  let bound = 0;

  for (const site of sites) {
    const devices = await listRuijieDevices(site.site_id);
    for (const d of devices) {
      // 1) Update by ruijie_device_id (already bound)
      const upd = await supabase
        .from("devices")
        .update({
          status: ruijieStatusToDb(d.status),
          last_seen: d.last_seen,
          uptime_pct: d.uptime_pct,
          last_status_check_at: now,
        })
        .eq("ruijie_device_id", d.device_id)
        .select("id");
      if (upd.data && upd.data.length > 0) {
        updated += upd.data.length;
        continue;
      }
      // 2) Auto-bind: match by MAC (case-insensitive) when not yet bound
      if (d.mac) {
        const bind = await supabase
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
        if (bind.data && bind.data.length > 0) {
          bound += bind.data.length;
          updated += bind.data.length;
        }
      }
    }
    await supabase
      .from("schools")
      .update({
        status: site.online ? "operational" : "down",
        gateway_reachable: site.online,
        internet_check_ok: site.online,
      })
      .eq("ruijie_site_id", site.site_id);
  }

  return { updated, bound, at: now };
}

/** Sync a single school by its bound Ruijie site_id. Upserts devices for that site only. */
export async function syncRuijieSchool(schoolId: string, ruijieSiteId: string): Promise<{ devices: number; bound: number; at: string }> {
  const now = new Date().toISOString();
  const devices = await listRuijieDevices(ruijieSiteId);
  let count = 0;
  let bound = 0;

  // Pull manually-added devices on this school that have a MAC but no ruijie_device_id (for auto-bind)
  const { data: manual } = await supabase
    .from("devices")
    .select("id,mac_address")
    .eq("school_id", schoolId)
    .is("ruijie_device_id", null);
  const manualByMac = new Map<string, string>();
  for (const m of manual ?? []) {
    if (m.mac_address) manualByMac.set(m.mac_address.toLowerCase(), m.id);
  }

  for (const d of devices) {
    const matchedManualId = d.mac ? manualByMac.get(d.mac.toLowerCase()) : undefined;
    if (matchedManualId) {
      const { error } = await supabase
        .from("devices")
        .update({
          ruijie_device_id: d.device_id,
          name: d.name,
          type: d.type,
          status: ruijieStatusToDb(d.status),
          uptime_pct: d.uptime_pct,
          last_seen: d.last_seen,
          last_status_check_at: now,
        })
        .eq("id", matchedManualId);
      if (!error) {
        bound++;
        count++;
      }
      continue;
    }
    const { error } = await supabase.from("devices").upsert(
      {
        ruijie_device_id: d.device_id,
        school_id: schoolId,
        name: d.name,
        type: d.type,
        status: ruijieStatusToDb(d.status),
        mac_address: d.mac,
        uptime_pct: d.uptime_pct,
        last_seen: d.last_seen,
        last_status_check_at: now,
      },
      { onConflict: "ruijie_device_id" },
    );
    if (!error) count++;
  }

  await supabase.from("schools").update({ last_synced_at: now }).eq("id", schoolId);
  return { devices: count, bound, at: now };
}