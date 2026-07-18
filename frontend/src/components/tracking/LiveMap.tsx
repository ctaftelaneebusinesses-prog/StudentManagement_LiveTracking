import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LiveLocation } from "@/types/tracking.types";
export function LiveMap({ locations, height = "360px" }: { locations: LiveLocation[]; height?: string }) {
  const host = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null); const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => { if (!host.current || map.current) return; map.current = L.map(host.current).setView([20.5937, 78.9629], 5); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map.current); layer.current = L.layerGroup().addTo(map.current); return () => { map.current?.remove(); map.current = null; }; }, []);
  useEffect(() => { if (!map.current || !layer.current) return; layer.current.clearLayers(); const valid = locations.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)); valid.forEach((item) => L.circleMarker([item.latitude, item.longitude], { radius: 9, color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.85 }).bindPopup(`<b>${item.label}</b><br/>${item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString() : "Live"}`).addTo(layer.current!)); if (valid.length) map.current.fitBounds(L.latLngBounds(valid.map((item) => [item.latitude, item.longitude])), { padding: [30, 30], maxZoom: 15 }); }, [locations]);
  return <div ref={host} className="overflow-hidden rounded-md border border-slate-200" style={{ height }} aria-label="Live vehicle map" />;
}
