import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapCategory, MapEntity } from "../domain/catalog";
import type { BoundingBox } from "../domain/discovery";

type Props = {
  entities: MapEntity[];
  styleUrl: string;
  category: "all" | MapCategory;
  onSelect: (entity: MapEntity) => void;
  onViewportChange?: (bounds: BoundingBox) => void;
  className?: string;
  interaction?: "embedded" | "full";
};

export function IslandMap({
  entities,
  styleUrl,
  category,
  onSelect,
  onViewportChange,
  className = "",
  interaction = "full",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Array<{ remove: () => void }>>([]);
  const [ready, setReady] = useState(false);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" },
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldMount) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function mount() {
      if (!hostRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !hostRef.current) return;

      const full = interaction === "full";
      const map = new maplibregl.Map({
        container: hostRef.current,
        style: styleUrl,
        center: [103.965, 10.205],
        zoom: 9.6,
        attributionControl: true,
        dragPan: full,
        scrollZoom: full,
        boxZoom: full,
        doubleClickZoom: full,
        keyboard: full,
        touchZoomRotate: full,
      });

      const emitViewport = () => {
        if (!onViewportChange) return;
        const bounds = map.getBounds();
        onViewportChange({
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        });
      };

      if (full) {
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "bottom-right",
        );
        map.on("moveend", emitViewport);
      }

      map.once("load", () => {
        setReady(true);
        emitViewport();
      });
      mapRef.current = map;

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(hostRef.current);
    }

    void mount();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [interaction, onViewportChange, shouldMount, styleUrl]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    let cancelled = false;

    async function renderMarkers() {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      entities
        .filter((entity) => category === "all" || entity.category === category)
        .forEach((entity) => {
          const el = document.createElement("button");
          el.type = "button";
          el.className = `map-pin map-pin--${entity.category}`;
          el.textContent = entity.icon;
          el.title = entity.name;
          el.setAttribute("aria-label", entity.name);
          el.addEventListener("click", () => onSelect(entity));

          const marker = new maplibregl.Marker({
            element: el,
            anchor: "bottom",
          })
            .setLngLat([entity.lng, entity.lat])
            .addTo(mapRef.current!);

          markersRef.current.push(marker);
        });
    }

    void renderMarkers();
    return () => {
      cancelled = true;
    };
  }, [category, entities, onSelect, ready]);

  return (
    <div
      ref={hostRef}
      className={`island-map island-map--${interaction} ${className}`}
      data-map-loading={shouldMount && !ready ? "true" : undefined}
    />
  );
}
