"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Point-and-radius picker for the geo-fence form.
 *
 * Leaflet reads `window` at import time, so this component is only ever mounted
 * through `next/dynamic` with `ssr: false` (see `LocationFields`). Loading it
 * directly would break the server render.
 *
 * Tiles come from OpenStreetMap, which is free for low volume and requires
 * visible attribution. A deployment with meaningful traffic should switch to a
 * commercial tile provider — see the note in the form.
 */

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onMove: (latitude: number, longitude: number) => void;
}

const DEFAULT_ZOOM = 5;

export default function LocationPicker({
  latitude,
  longitude,
  radiusMeters,
  onMove,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  // Leaflet handlers are bound once but must see the latest callback. Syncing in an
// effect rather than during render keeps the ref write out of the render phase.
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: L.LatLngExpression = [latitude, longitude];
    const map = L.map(containerRef.current).setView(center, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    const circle = L.circle(center, {
      radius: radiusMeters,
      color: "#2566ec",
      weight: 2,
      fillColor: "#2566ec",
      fillOpacity: 0.15,
    }).addTo(map);
    circleRef.current = circle;

    // Leaflet's default marker icon resolves its images relative to the CSS file,
    // which breaks under bundlers. Inlined SVG avoids the extra asset entirely.
    const marker = L.marker(center, {
      draggable: true,
      icon: L.divIcon({
        className: "border-0 bg-transparent",
        html: '<div style="width:16px;height:16px;border-radius:9999px;background:#2566ec;border:2.5px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / 0.35)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(map);
    markerRef.current = marker;

    const publish = () => {
      const position = marker.getLatLng();
      circle.setLatLng(position);
      onMoveRef.current(position.lat, position.lng);
    };

    // Clicking the map is the primary interaction — faster than dragging.
    map.on("click", (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng);
      publish();
    });
    marker.on("dragend", publish);

    // The map is inside a dialog that starts hidden, so Leaflet computes a
    // zero-size container and renders as a grey square until invalidated.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Intentionally mount-only: later prop changes flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the circle in sync when the radius field is typed into directly.
  useEffect(() => {
    circleRef.current?.setRadius(radiusMeters);
  }, [radiusMeters]);

  // Recentre when the marker is moved by some other control, such as
  // "Gunakan lokasi saya".
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const current = marker.getLatLng();
    const moved = Math.abs(current.lat - latitude) > 1e-6 || Math.abs(current.lng - longitude) > 1e-6;
    if (!moved) return;

    marker.setLatLng([latitude, longitude]);
    circleRef.current?.setLatLng([latitude, longitude]);
    map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-lg border border-border sm:h-72"
      aria-label="Peta pilihan lokasi kerja"
    />
  );
}