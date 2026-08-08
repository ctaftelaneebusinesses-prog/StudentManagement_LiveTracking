import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LiveLocation } from "@/types/tracking.types";

const busIcon = L.divIcon({
  className: "",
  html:
    '<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;' +
    'border-radius:9999px;background:#2563eb;box-shadow:0 2px 8px rgba(37,99,235,0.45);' +
    'border:2px solid white;font-size:16px;">🚌</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -17],
});

const viewerIcon = L.divIcon({
  className: "",
  html:
    '<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;' +
    'border-radius:9999px;background:#16a34a;box-shadow:0 2px 8px rgba(22,163,74,0.45);' +
    'border:2px solid white;font-size:14px;">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

export interface RouteStop {
  latitude: number;
  longitude: number;
  name: string;
}

export interface ViewerLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

interface LiveMapProps {
  locations: LiveLocation[];
  /** Optional stops for the active route(s) — drawn as a dashed line with small stop markers, giving the vehicle marker a path of context. */
  routeStops?: RouteStop[];
  /** The viewer's own live position (the student, while their Transport page is open) — drawn as a distinct pin with a dashed line to each vehicle marker. */
  viewerLocation?: ViewerLocation | null;
  height?: string;
}

export function LiveMap({ locations, routeStops, viewerLocation, height = "360px" }: LiveMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const vehicleLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!host.current || map.current) return;
    map.current = L.map(host.current).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map.current);
    routeLayer.current = L.layerGroup().addTo(map.current);
    vehicleLayer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !routeLayer.current) return;
    routeLayer.current.clearLayers();

    const validStops = (routeStops ?? []).filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
    if (validStops.length > 1) {
      L.polyline(
        validStops.map((s) => [s.latitude, s.longitude]),
        { color: "#94a3b8", weight: 3, dashArray: "6 6" }
      ).addTo(routeLayer.current);
    }
    validStops.forEach((stop) => {
      L.circleMarker([stop.latitude, stop.longitude], {
        radius: 5,
        color: "#64748b",
        weight: 2,
        fillColor: "#cbd5e1",
        fillOpacity: 1,
      })
        .bindTooltip(stop.name, { direction: "top" })
        .addTo(routeLayer.current!);
    });
  }, [routeStops]);

  useEffect(() => {
    if (!map.current || !vehicleLayer.current) return;
    vehicleLayer.current.clearLayers();

    const validLocations = locations.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    validLocations.forEach((item) => {
      const timeLine = item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString() : "Live";
      const etaLine = item.etaMinutes != null ? `<br/>ETA to next stop: ${item.etaMinutes} min` : "";
      // zIndexOffset keeps the bus marker on top even when it's drawn at (or
      // very near) the viewer's own coordinates — e.g. the ETA card reading
      // "0 km away" — where Leaflet would otherwise stack whichever marker
      // was added last (the viewer pin, below) above the bus.
      L.marker([item.latitude, item.longitude], { icon: busIcon, zIndexOffset: 1000 })
        .bindPopup(`<b>${item.label}</b><br/>${timeLine}${etaLine}`)
        .addTo(vehicleLayer.current!);
    });

    const hasViewer = !!viewerLocation && Number.isFinite(viewerLocation.latitude) && Number.isFinite(viewerLocation.longitude);
    if (hasViewer) {
      L.marker([viewerLocation!.latitude, viewerLocation!.longitude], { icon: viewerIcon })
        .bindPopup(viewerLocation!.label ?? "Your location")
        .addTo(vehicleLayer.current!);

      validLocations.forEach((item) => {
        L.polyline(
          [
            [viewerLocation!.latitude, viewerLocation!.longitude],
            [item.latitude, item.longitude],
          ],
          { color: "#16a34a", weight: 2, dashArray: "4 8", opacity: 0.7 }
        ).addTo(vehicleLayer.current!);
      });
    }

    const routePoints = (routeStops ?? [])
      .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map((s): [number, number] => [s.latitude, s.longitude]);
    const viewerPoint: [number, number][] = hasViewer ? [[viewerLocation!.latitude, viewerLocation!.longitude]] : [];
    const allPoints: [number, number][] = [...validLocations.map((v): [number, number] => [v.latitude, v.longitude]), ...routePoints, ...viewerPoint];
    if (allPoints.length) map.current.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 15 });
  }, [locations, routeStops, viewerLocation]);

  return (
    <div
      ref={host}
      className="overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.08]"
      style={{ height }}
      aria-label="Live vehicle map"
    />
  );
}
