import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Plus, Search, Loader2 } from "lucide-react";
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

// Fix Leaflet marker icons (Vite path resolution)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ALBANIA_CENTER: [number, number] = [41.1533, 20.1683];

function PanTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, Math.max(map.getZoom(), 13), { animate: true });
  }, [map, pos]);
  return null;
}

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export function NewSchoolDialog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [ispType, setIspType] = useState("");
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);

  const reset = () => {
    setName("");
    setRegion("");
    setProvince("");
    setIspType("");
    setPos(null);
    setSearch("");
  };

  const handleSearch = async () => {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok) throw new Error("Geocoding request failed");
      const json = (await res.json()) as NominatimResult[];
      if (!json.length) {
        toast.error("No location found for that address");
        return;
      }
      const r = json[0];
      const next: [number, number] = [parseFloat(r.lat), parseFloat(r.lon)];
      setPos(next);
      // Auto-fill region with the first comma-separated part if empty
      if (!region && r.display_name) {
        const first = r.display_name.split(",")[0]?.trim();
        if (first) setRegion(first);
      }
    } catch (err) {
      toast.error("Address lookup failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !region.trim()) {
      toast.error("Name and region are required");
      return;
    }
    if (!pos) {
      toast.error("Please pick a location on the map");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("schools").insert({
        name: name.trim(),
        region: region.trim(),
        province: province.trim() || null,
        isp_type: ispType.trim() || null,
        latitude: pos[0],
        longitude: pos[1],
      }).select("id").single();
      if (error) throw error;
      toast.success("School registered", { description: "Showing on the map…" });
      qc.invalidateQueries({ queryKey: qk.schools });
      reset();
      setOpen(false);
      if (data?.id) {
        navigate({ to: "/", search: { focusSchool: data.id } as never });
      }
    } catch (err) {
      toast.error("Could not register school", {
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
          Register School
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Register a new school</DialogTitle>
          <DialogDescription>
            Search an address or drag the pin to set the school's exact location.
            Coordinates are saved with the school record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ns-name">Name *</Label>
              <Input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ns-region">Region / City *</Label>
              <Input id="ns-region" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ns-province">Province</Label>
              <Input id="ns-province" value={province} onChange={(e) => setProvince(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ns-isp">ISP type</Label>
              <Input id="ns-isp" value={ispType} onChange={(e) => setIspType(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input
                  value={pos?.[0]?.toFixed(6) ?? ""}
                  readOnly
                  placeholder="—"
                  className="bg-muted/40"
                />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input
                  value={pos?.[1]?.toFixed(6) ?? ""}
                  readOnly
                  placeholder="—"
                  className="bg-muted/40"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSearch();
                    }
                  }}
                  placeholder="Search address (e.g. Tirana, Rruga e Kavajës)"
                  className="pl-7"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSearch}
                disabled={searching || !search.trim()}
              >
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Find"}
              </Button>
            </div>

            <div style={{ height: 320 }} className="overflow-hidden rounded-md border border-border">
              <MapContainer
                center={pos ?? ALBANIA_CENTER}
                zoom={pos ? 13 : 7}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickToPlace onPlace={setPos} />
                {pos && (
                  <Marker
                    position={pos}
                    draggable
                    ref={(ref) => {
                      markerRef.current = ref;
                    }}
                    eventHandlers={{
                      dragend: () => {
                        const m = markerRef.current;
                        if (m) {
                          const ll = m.getLatLng();
                          setPos([ll.lat, ll.lng]);
                        }
                      },
                    }}
                  />
                )}
                <PanTo pos={pos} />
              </MapContainer>
            </div>
            <p className="text-xs text-muted-foreground">
              Click the map to drop the pin, then drag it for fine adjustment.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Save school
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClickToPlace({ onPlace }: { onPlace: (p: [number, number]) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onPlace([e.latlng.lat, e.latlng.lng]);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onPlace]);
  return null;
}

export default NewSchoolDialog;