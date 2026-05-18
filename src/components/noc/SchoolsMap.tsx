import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Link } from "@tanstack/react-router";
import { Search, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import type { DbSchool, DbReport } from "@/lib/noc/queries";
import { useReports } from "@/lib/noc/queries";

// Fix Leaflet default marker icon URLs (Vite breaks them otherwise)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const CITY_COORDS: Record<string, [number, number]> = {
  Tirana: [41.3275, 19.8187], "Tiranë": [41.3275, 19.8187],
  "Durrës": [41.3231, 19.4414], Durres: [41.3231, 19.4414],
  "Shkodër": [42.0683, 19.5126], Shkoder: [42.0683, 19.5126],
  "Vlorë": [40.4686, 19.4914], Vlore: [40.4686, 19.4914],
  Elbasan: [41.1125, 20.0822],
  "Korçë": [40.6186, 20.7808], Korce: [40.6186, 20.7808],
  Fier: [40.7239, 19.5567], Berat: [40.7058, 19.9522],
  "Lezhë": [41.7836, 19.6436], Lezhe: [41.7836, 19.6436],
  "Gjirokastër": [40.0758, 20.1389], Gjirokaster: [40.0758, 20.1389],
  "Kukës": [42.0769, 20.4222], Kukes: [42.0769, 20.4222],
  "Dibër": [41.6342, 20.4231], Diber: [41.6342, 20.4231],
  "Sarandë": [39.8756, 20.0053], Sarande: [39.8756, 20.0053],
  Pogradec: [40.9028, 20.6519],
  "Krujë": [41.5089, 19.7928], Kruje: [41.5089, 19.7928],
  "Lushnjë": [40.9419, 19.7050], Lushnje: [40.9419, 19.7050],
  "Kavajë": [41.1856, 19.5567], Kavaje: [41.1856, 19.5567],
};

const STATUS_COLORS: Record<string, string> = {
  operational: "#22c55e",
  degraded: "#f59e0b",
  down: "#ef4444",
  unknown: "#9ca3af",
};

const ALL_STATUSES = ["operational", "degraded", "down", "unknown"] as const;

function colorFor(status: string) {
  return STATUS_COLORS[status] ?? "#6366f1";
}

type ReportTone = "none" | "confirmed" | "pending";

function reportRingColor(tone: ReportTone, baseColor: string) {
  if (tone === "pending") return "#ef4444";
  if (tone === "confirmed") return "#f59e0b";
  return baseColor;
}

const iconCache = new Map<string, L.DivIcon>();
function makeColoredIcon(color: string, ringColor: string, pulse: boolean) {
  const cacheKey = `${color}|${ringColor}|${pulse ? "p" : "n"}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;
  const ring = pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${ringColor};animation:schoolMarkerPulse 1.6s ease-out infinite;"></span>`
    : "";
  const html = `
    <span style="position:relative;display:inline-block;width:18px;height:18px;">
      ${ring}
      <span style="position:relative;display:inline-block;width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.4),0 2px 4px rgba(0,0,0,0.3);"></span>
    </span>`;
  const icon = L.divIcon({
    html, className: "school-marker",
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

function makeHighlightIcon(color: string) {
  const html = `
    <span style="position:relative;display:inline-block;width:24px;height:24px;">
      <span style="position:absolute;inset:-8px;border-radius:50%;border:3px solid #6366f1;animation:schoolMarkerPulse 1.4s ease-out infinite;"></span>
      <span style="position:relative;display:inline-block;width:24px;height:24px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px #6366f1,0 4px 8px rgba(0,0,0,0.4);"></span>
    </span>`;
  return L.divIcon({
    html, className: "school-marker school-marker-highlight",
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14],
  });
}

function coordsFor(school: DbSchool): [number, number] | null {
  if (
    typeof school.latitude === "number" && typeof school.longitude === "number" &&
    !Number.isNaN(school.latitude) && !Number.isNaN(school.longitude)
  ) return [school.latitude, school.longitude];
  const base = CITY_COORDS[school.region] ?? CITY_COORDS[school.province ?? ""];
  return base ?? null;
}

function FitBounds({ points, signature }: { points: [number, number][]; signature: string }) {
  const map = useMap();
  const lastSig = useRef<string>("");
  useEffect(() => {
    if (!points.length) return;
    if (lastSig.current === signature) return;
    lastSig.current = signature;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points, signature]);
  return null;
}

// Imperative API: parent can fly to a school + open its popup
type SchoolMarkerRefs = Map<string, L.Marker>;
function FlyToHandler({
  flyTo, markerRefs,
}: {
  flyTo: { schoolId: string; pos: [number, number] } | null;
  markerRefs: React.MutableRefObject<SchoolMarkerRefs>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!flyTo) return;
    map.flyTo(flyTo.pos, Math.max(map.getZoom(), 13), { duration: 1.0 });
    const t = setTimeout(() => markerRefs.current.get(flyTo.schoolId)?.openPopup(), 1100);
    return () => clearTimeout(t);
  }, [flyTo, map, markerRefs]);
  return null;
}

export interface SchoolsMapProps {
  schools: DbSchool[];
  /** Imperative target: when set, map flies to this school and opens popup */
  flyToSchoolId?: string | null;
}

export function SchoolsMap({ schools, flyToSchoolId }: SchoolsMapProps) {
  const [enabledStatuses, setEnabledStatuses] = useState<Set<string>>(() => new Set(ALL_STATUSES));
  const [search, setSearch] = useState("");
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "none">("all");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { data: reports = [] } = useReports();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => {
      setIsMobile(mq.matches);
      setCollapsed(mq.matches); // collapse by default on mobile
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const reportsBySchool = useMemo(() => {
    const m = new Map<string, { latest: DbReport; pendingCount: number; confirmedCount: number; total: number }>();
    for (const r of reports) {
      const cur = m.get(r.school_id);
      const isPending = r.report_status === "new";
      const isConfirmed = r.report_status === "confirmed";
      if (!cur) {
        m.set(r.school_id, {
          latest: r,
          pendingCount: isPending ? 1 : 0,
          confirmedCount: isConfirmed ? 1 : 0,
          total: 1,
        });
      } else {
        if (isPending) cur.pendingCount += 1;
        if (isConfirmed) cur.confirmedCount += 1;
        cur.total += 1;
      }
    }
    return m;
  }, [reports]);

  const allMarkers = useMemo(
    () =>
      schools
        .map((s) => {
          const c = coordsFor(s);
          return c ? { school: s, pos: c } : null;
        })
        .filter((m): m is { school: DbSchool; pos: [number, number] } => m !== null),
    [schools],
  );

  const q = search.trim().toLowerCase();
  const visibleMarkers = useMemo(
    () =>
      allMarkers.filter(({ school }) => {
        if (!enabledStatuses.has(school.status)) return false;
        if (q && !school.name.toLowerCase().includes(q)) return false;
        const info = reportsBySchool.get(school.id);
        const hasPending = (info?.pendingCount ?? 0) > 0;
        const hasAnyReport = !!info;
        if (reportFilter === "pending" && !hasPending) return false;
        if (reportFilter === "none" && hasAnyReport) return false;
        return true;
      }),
    [allMarkers, enabledStatuses, q, reportFilter, reportsBySchool],
  );

  const points = visibleMarkers.map((m) => m.pos);
  const fitSignature = useMemo(() => `${allMarkers.length}`, [allMarkers.length]);
  const center: [number, number] = points[0] ?? [41.1533, 20.1683];

  const flyTarget = useMemo(() => {
    if (!flyToSchoolId) return null;
    const m = allMarkers.find((x) => x.school.id === flyToSchoolId);
    return m ? { schoolId: flyToSchoolId, pos: m.pos } : null;
  }, [flyToSchoolId, allMarkers]);

  const markerRefs = useRef<SchoolMarkerRefs>(new Map());

  const toggleStatus = (s: string) => {
    setEnabledStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const totalSchools = schools.length;
  const schoolsWithPending = useMemo(
    () => schools.filter((s) => (reportsBySchool.get(s.id)?.pendingCount ?? 0) > 0).length,
    [schools, reportsBySchool],
  );
  const schoolsWithNoReports = totalSchools - reportsBySchool.size;
  const unmappedCount = schools.length - allMarkers.length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <style>{`
        @keyframes schoolMarkerPulse {
          0%   { transform: scale(0.85); opacity: 0.9; }
          70%  { transform: scale(1.6);  opacity: 0;   }
          100% { transform: scale(1.6);  opacity: 0;   }
        }
      `}</style>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-4 w-4" /> School Locations Map
        </h2>
        {isMobile && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {collapsed ? <><ChevronDown className="h-3 w-3" /> Show map</> : <><ChevronUp className="h-3 w-3" /> Hide map</>}
          </button>
        )}
      </div>

      {/* Mini stats bar — clickable filters */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <button
          type="button"
          onClick={() => setReportFilter("all")}
          className={`rounded-md border p-2 transition-colors ${reportFilter === "all" ? "border-primary bg-accent" : "border-border bg-background hover:bg-accent/30"}`}
        >
          <div className="text-lg font-semibold tabular-nums">{totalSchools}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Schools</div>
        </button>
        <button
          type="button"
          onClick={() => setReportFilter("pending")}
          className={`rounded-md border p-2 transition-colors ${reportFilter === "pending" ? "border-priority-high bg-priority-high/10" : "border-border bg-background hover:bg-accent/30"}`}
        >
          <div className="text-lg font-semibold tabular-nums text-priority-high">{schoolsWithPending}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending Reports</div>
        </button>
        <button
          type="button"
          onClick={() => setReportFilter("none")}
          className={`rounded-md border p-2 transition-colors ${reportFilter === "none" ? "border-primary bg-accent" : "border-border bg-background hover:bg-accent/30"}`}
        >
          <div className="text-lg font-semibold tabular-nums">{schoolsWithNoReports}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">No Reports</div>
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools…"
                className="h-8 w-48 rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_STATUSES.map((s) => {
                const active = enabledStatuses.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStatus(s)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                      active ? "border-border bg-muted/60" : "border-border/40 bg-transparent text-muted-foreground opacity-50"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full border border-white" style={{ background: colorFor(s) }} />
                    <span className="capitalize">{s}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative" style={{ minHeight: 450, height: 450 }}>
            <MapContainer center={center} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%", borderRadius: 8 }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
                {visibleMarkers.map(({ school, pos }) => {
                  const reportInfo = reportsBySchool.get(school.id);
                  const hasPending = (reportInfo?.pendingCount ?? 0) > 0;
                  const hasConfirmed = (reportInfo?.confirmedCount ?? 0) > 0;
                  const tone: ReportTone = hasPending ? "pending" : hasConfirmed ? "confirmed" : "none";
                  const baseColor = colorFor(school.status);
                  const ringColor = reportRingColor(tone, baseColor);
                  const isFocus = flyToSchoolId === school.id;
                  return (
                    <Marker
                      key={`${school.id}:${school.status}:${tone}:${isFocus ? "f" : ""}`}
                      position={pos}
                      icon={isFocus ? makeHighlightIcon(baseColor) : makeColoredIcon(baseColor, ringColor, hasPending)}
                      ref={(ref) => {
                        if (ref) markerRefs.current.set(school.id, ref);
                        else markerRefs.current.delete(school.id);
                      }}
                    >
                      <Popup>
                        <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{school.name}</div>
                          <div style={{ marginBottom: 4 }}>
                            <span style={{
                              display: "inline-block", padding: "1px 6px", borderRadius: 4,
                              background: baseColor, color: "#fff", textTransform: "capitalize", fontSize: 10, fontWeight: 600,
                            }}>{school.status}</span>
                            <span style={{ marginLeft: 6, color: "#6b7280" }}>{school.region}</span>
                          </div>
                          <div style={{ color: "#9ca3af", fontSize: 10 }}>
                            {pos[0].toFixed(4)}, {pos[1].toFixed(4)}
                          </div>
                          {reportInfo && (
                            <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid #e5e7eb" }}>
                              <div style={{ fontWeight: 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                                Latest report
                                {hasPending && (
                                  <span style={{ padding: "0 6px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 10 }}>
                                    {reportInfo.pendingCount} pending
                                  </span>
                                )}
                              </div>
                              <div>
                                <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{reportInfo.latest.type}</span>
                                {" · "}
                                <span style={{
                                  display: "inline-block", padding: "0 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                                  background: reportInfo.latest.report_status === "new" ? "#fee2e2" : reportInfo.latest.report_status === "confirmed" ? "#fef3c7" : "#dcfce7",
                                  color: reportInfo.latest.report_status === "new" ? "#991b1b" : reportInfo.latest.report_status === "confirmed" ? "#92400e" : "#166534",
                                }}>{reportInfo.latest.report_status}</span>
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 11 }}>
                                {new Date(reportInfo.latest.created_at).toLocaleString()}
                              </div>
                              {reportInfo.latest.message && (
                                <div style={{
                                  marginTop: 2, color: "#374151",
                                  display: "-webkit-box", WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical", overflow: "hidden",
                                }}>{reportInfo.latest.message}</div>
                              )}
                            </div>
                          )}
                          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                            <Link to="/schools/$schoolId" params={{ schoolId: school.id }} style={{
                              display: "inline-block", padding: "4px 10px", borderRadius: 4,
                              background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 500,
                            }}>School details →</Link>
                            {reportInfo && (
                              <Link to="/reports" style={{
                                display: "inline-block", padding: "4px 10px", borderRadius: 4,
                                border: "1px solid #cbd5e1", color: "#0f172a", textDecoration: "none", fontWeight: 500,
                              }}>View All Reports</Link>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
              <FitBounds points={allMarkers.map((m) => m.pos)} signature={fitSignature} />
              <FlyToHandler flyTo={flyTarget} markerRefs={markerRefs} />
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 z-[1000] rounded-md border border-border bg-card/95 p-2 text-xs shadow-md backdrop-blur" style={{ minWidth: 140 }}>
              <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Legend</div>
              <div className="space-y-1">
                <LegendRow color="#22c55e" label="No issues" />
                <LegendRow color="#f59e0b" label="Confirmed report" />
                <LegendRow color="#ef4444" label="Pending report" pulse />
                <LegendRow color="#9ca3af" label="No data" />
              </div>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Showing {visibleMarkers.length} of {schools.length} schools
            {unmappedCount > 0 && ` (${unmappedCount} have no coordinates)`}
            {q && ` · "${search}"`}
            {reportFilter !== "all" && ` · ${reportFilter === "pending" ? "with pending" : "no reports"}`}
          </p>
        </>
      )}
    </div>
  );
}

function LegendRow({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-block h-3 w-3 rounded-full border border-white" style={{ background: color }}>
        {pulse && (
          <span className="absolute inset-[-3px] rounded-full border-2" style={{ borderColor: color, animation: "schoolMarkerPulse 1.6s ease-out infinite" }} />
        )}
      </span>
      <span>{label}</span>
    </div>
  );
}

export default SchoolsMap;
