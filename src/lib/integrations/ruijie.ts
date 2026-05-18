// Mock Ruijie Cloud API client.
// Replace the implementations with real fetch() calls to https://noc.ruijienetworks.com
// once API credentials are available. The shape is intentionally close to the
// public Ruijie Cloud OpenAPI so the swap is mostly drop-in.

export interface RuijieSite {
  site_id: string;
  site_name: string;
  region: string;
  province?: string;
  isp_type?: string;
  online: boolean;
}

export type RuijieDeviceType = "ap" | "switch" | "gateway" | "controller";
export type RuijieDeviceStatus = "online" | "offline" | "alarm";

export interface RuijieDevice {
  device_id: string;
  site_id: string;
  name: string;
  type: RuijieDeviceType;
  status: RuijieDeviceStatus;
  mac: string;
  uptime_pct: number;
  last_seen: string; // ISO
}

const REGIONS = ["Tirana", "Durrës", "Shkodër", "Vlorë", "Elbasan", "Korçë"];
const PROVINCES = ["Tirana", "Durrës", "Shkodër", "Vlorë", "Elbasan", "Korçë", "Fier", "Berat"];
const ISPS = ["fiber", "vdsl", "satellite", "lte"];
const TYPES: RuijieDeviceType[] = ["gateway", "switch", "ap", "ap", "ap", "controller"];

function rand<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}
function mac(seed: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return [h((seed * 37) & 255), h((seed * 53) & 255), h((seed * 71) & 255), h((seed * 89) & 255), h((seed * 97) & 255), h((seed * 113) & 255)].join(":");
}

/** Simulates GET /api/v1/sites — list all sites visible to the API key */
export async function listRuijieSites(): Promise<RuijieSite[]> {
  await new Promise((r) => setTimeout(r, 600));
  const names = [
    "Shkolla 9-vjeçare 'Naim Frashëri'",
    "Gjimnazi 'Sami Frashëri'",
    "Shkolla 'Petro Nini Luarasi'",
    "Shkolla 'Edith Durham'",
    "Gjimnazi 'Çajupi'",
    "Shkolla 'Hasan Tahsini'",
    "Shkolla 'Misto Mame'",
    "Gjimnazi 'Aleksandër Xhuvani'",
    "Shkolla 'Kostandin Kristoforidhi'",
    "Shkolla 'Avni Rustemi'",
  ];
  return names.map((name, i) => ({
    site_id: `RJ-SITE-${1000 + i}`,
    site_name: name,
    region: rand(REGIONS, i),
    province: rand(PROVINCES, i + 3),
    isp_type: rand(ISPS, i),
    online: i % 5 !== 0,
  }));
}

/** Simulates GET /api/v1/sites/{site_id}/devices */
export async function listRuijieDevices(siteId: string): Promise<RuijieDevice[]> {
  await new Promise((r) => setTimeout(r, 400));
  const seed = Number(siteId.replace(/\D/g, "")) || 1;
  const count = 4 + (seed % 5);
  return Array.from({ length: count }, (_, i) => {
    const type = TYPES[i % TYPES.length];
    const isOnline = (seed + i) % 7 !== 0;
    return {
      device_id: `RJ-DEV-${siteId.replace("RJ-SITE-", "")}-${i + 1}`,
      site_id: siteId,
      name: `${type.toUpperCase()}-${i + 1}`,
      type,
      status: isOnline ? "online" : (seed + i) % 3 === 0 ? "alarm" : "offline",
      mac: mac(seed + i),
      uptime_pct: isOnline ? 95 + ((seed + i) % 5) : 60 + ((seed + i) % 30),
      last_seen: new Date(Date.now() - (isOnline ? 60_000 : 3_600_000) * ((seed + i) % 10 || 1)).toISOString(),
    };
  });
}

export function ruijieStatusToDb(s: RuijieDeviceStatus): "operational" | "degraded" | "down" {
  if (s === "online") return "operational";
  if (s === "alarm") return "degraded";
  return "down";
}