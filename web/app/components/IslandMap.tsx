import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// Vite must emit and serve the worker as an app asset; the bare package
// worker path otherwise resolves to /node_modules/.vite/deps/... and 404s.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { MapCategory, MapEntity } from "../domain/catalog";
import type { BoundingBox } from "../domain/discovery";

type Props = {
  entities: MapEntity[];
  styleUrl: string;
  category: "all" | MapCategory;
  onSelect: (entity: MapEntity) => void;
  selectedEntityId?: string | null;
  onViewportChange?: (bounds: BoundingBox) => void;
  initialBounds?: BoundingBox;
  className?: string;
  interaction?: "embedded" | "full";
};

export function IslandMap({
  entities,
  styleUrl,
  category,
  onSelect,
  selectedEntityId,
  onViewportChange,
  initialBounds,
  className = "",
  interaction = "full",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Array<{ remove: () => void }>>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shouldMount, setShouldMount] = useState(false);
  const [zoom, setZoom] = useState(9.6);

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
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

    async function mount() {
      if (!hostRef.current || mapRef.current) return;

      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !hostRef.current) return;
        maplibregl.setWorkerUrl(maplibreWorkerUrl);

      const full = interaction === "full";
      const map = new maplibregl.Map({
        container: hostRef.current,
        style: styleUrl,
        center: [103.965, 10.205],
        zoom: 9.6,
        attributionControl: { compact: true },
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
        map.addControl(
          new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: false },
            trackUserLocation: false,
          }),
          "bottom-right",
        );
        map.on("moveend", emitViewport);
      }

      const syncZoom = () => setZoom(map.getZoom());

        // Do not treat a mounted canvas as evidence that its basemap loaded.
        map.on("error", (event) => {
          console.error("[IslandMap] MapLibre error", event.error);
        });

        loadTimer = setTimeout(() => {
          if (!map.loaded()) {
            console.error("[IslandMap] Map load timed out", {
              styleUrl,
              styleLoaded: map.isStyleLoaded(),
            });
            if (!cancelled) setFailed(true);
          }
        }, 12000);

        map.once("load", () => {
          if (loadTimer) clearTimeout(loadTimer);
          setFailed(false);
          setReady(true);
          syncZoom();
          emitViewport();
        });
      map.on("zoomend", syncZoom);
      mapRef.current = map;

        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(hostRef.current);
      } catch (error) {
        console.error("[IslandMap] Map initialization failed", error);
        if (!cancelled) setFailed(true);
      }
    }

    void mount();

    return () => {
      cancelled = true;
      if (loadTimer) clearTimeout(loadTimer);
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
      setFailed(false);
    };
  }, [interaction, onViewportChange, shouldMount, styleUrl]);

  useEffect(() => {
    if (!ready || !mapRef.current || !initialBounds) return;

    mapRef.current.fitBounds(
      [
        [initialBounds.west, initialBounds.south],
        [initialBounds.east, initialBounds.north],
      ],
      {
        padding: 36,
        duration: 0,
      },
    );
  }, [initialBounds, ready]);

  useEffect(() => {
    if (
      !ready ||
      !mapRef.current ||
      !selectedEntityId ||
      interaction !== "full"
    ) {
      return;
    }

    const entity = entities.find((item) => item.id === selectedEntityId);
    if (!entity) return;

    mapRef.current.easeTo({
      center: [entity.lng, entity.lat],
      zoom: Math.max(mapRef.current.getZoom(), 11.8),
      duration: 420,
    });
  }, [entities, interaction, ready, selectedEntityId]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    let cancelled = false;

    async function renderMarkers() {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const markerLimit = interaction === "embedded" ? 80 : 220;

      entities
        .filter((entity) => category === "all" || entity.category === category)
        .filter((entity) => zoom >= entity.minZoom)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, markerLimit)
        .forEach((entity) => {
          const el = document.createElement("button");
          el.type = "button";
          el.className = [
            "map-pin",
            `map-pin--${entity.category}`,
            `map-pin--${entity.verification}`,
            entity.id === selectedEntityId ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const icon = document.createElement("span");
          icon.className = "map-pin-icon";
          icon.textContent = entity.icon;
          el.append(icon);
          el.title = entity.name;
          el.setAttribute("aria-label", entity.name);
          el.setAttribute(
            "aria-pressed",
            entity.id === selectedEntityId ? "true" : "false",
          );
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
  }, [
    category,
    entities,
    interaction,
    onSelect,
    ready,
    selectedEntityId,
    zoom,
  ]);

  return (
    <div
      ref={hostRef}
      className={`island-map island-map--${interaction} ${className}`}
      data-map-ready={ready ? "true" : undefined}
      data-map-loading={shouldMount && !ready && !failed ? "true" : undefined}
      data-map-error={failed ? "true" : undefined}
      aria-label={failed ? "Bản đồ tạm thời chưa tải được" : undefined}
    />
  );
}
