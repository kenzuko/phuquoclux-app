import { useCallback, useState } from "react";
import {
  Form,
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { BottomNav } from "../components/BottomNav";
import { Brand } from "../components/Brand";
import { IslandMap } from "../components/IslandMap";
import type { MapCategory, MapEntity } from "../domain/catalog";
import { mapVerificationLabel, money } from "../domain/catalog";
import { normalizeServiceDate } from "../domain/service-date";
import {
  discover,
  type BoundingBox,
  type DiscoveryQuery,
} from "../domain/discovery";

const allowedCategories: Array<"all" | MapCategory> = [
  "all",
  "tour",
  "ticket",
  "transfer",
  "place",
];

const boundKeys = ["west", "south", "east", "north"] as const;

function parseCategory(value: string | null): DiscoveryQuery["category"] {
  return allowedCategories.includes(value as "all" | MapCategory)
    ? (value as "all" | MapCategory)
    : "all";
}

function parseNumber(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBounds(searchParams: URLSearchParams): BoundingBox | undefined {
  const west = parseNumber(searchParams.get("west"));
  const south = parseNumber(searchParams.get("south"));
  const east = parseNumber(searchParams.get("east"));
  const north = parseNumber(searchParams.get("north"));

  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    west >= east ||
    south >= north
  ) {
    return undefined;
  }

  return { west, south, east, north };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const category = parseCategory(url.searchParams.get("category"));
  const q = url.searchParams.get("q") ?? undefined;
  const bounds = parseBounds(url.searchParams);
  const date = normalizeServiceDate(url.searchParams.get("date") ?? undefined);
  const pax = Math.max(
    1,
    Math.min(20, Number(url.searchParams.get("pax")) || 2),
  );

  return {
    result: discover({ category, q, bounds, date, pax }),
    category,
    q: q ?? "",
    date,
    pax,
    hasAreaSearch: Boolean(bounds),
    initialBounds: bounds ?? null,
    mapStyleUrl:
      context.cloudflare.env.MAP_STYLE_URL ??
      "https://demotiles.maplibre.org/style.json",
  };
}

export function meta() {
  return [
    { title: "Bản đồ Phú Quốc | PhuQuocLux" },
    {
      name: "description",
      content: "Khám phá tour, vé, xe và địa điểm trên bản đồ Phú Quốc.",
    },
    { name: "robots", content: "noindex,follow" },
  ];
}

export default function MapRoute() {
  const {
    result,
    category,
    q,
    date,
    pax,
    hasAreaSearch,
    initialBounds,
    mapStyleUrl,
  } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<MapEntity | null>(null);
  const [viewport, setViewport] = useState<BoundingBox | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const onSelect = useCallback((entity: MapEntity) => setSelected(entity), []);
  const onViewportChange = useCallback(
    (bounds: BoundingBox) => setViewport(bounds),
    [],
  );

  function changeCategory(next: "all" | MapCategory) {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("category");
    else params.set("category", next);
    setSearchParams(params);
    setSelected(null);
  }

  function searchThisArea() {
    if (!viewport) return;

    const params = new URLSearchParams(searchParams);
    for (const key of boundKeys) {
      params.set(key, viewport[key].toFixed(5));
    }
    setSearchParams(params);
    setSelected(null);
  }

  function clearAreaSearch() {
    const params = new URLSearchParams(searchParams);
    for (const key of boundKeys) params.delete(key);
    setSearchParams(params);
    setSelected(null);
  }

  return (
    <div className="map-page">
      <header className="map-topbar">
        <Brand compact />
        <Form className="map-search" method="get" action="/map">
          {category !== "all" ? (
            <input type="hidden" name="category" value={category} />
          ) : null}
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="pax" value={pax} />
          <span>⌕</span>
          <input
            key={q}
            name="q"
            defaultValue={q}
            placeholder="Tìm trên bản đồ Phú Quốc"
            aria-label="Tìm trên bản đồ Phú Quốc"
          />
        </Form>
        <Link className="map-close-link" to="/">
          Đóng ×
        </Link>
      </header>

      <div className="map-filter-row">
        {[
          ["all", "Tất cả"],
          ["tour", "Tour"],
          ["ticket", "Vé"],
          ["transfer", "Xe"],
          ["place", "Địa điểm"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={category === id ? "is-active" : ""}
            onClick={() => changeCategory(id as "all" | MapCategory)}
          >
            {label}
          </button>
        ))}
        {hasAreaSearch ? (
          <button
            className="area-reset"
            type="button"
            onClick={clearAreaSearch}
          >
            Toàn đảo ×
          </button>
        ) : null}
      </div>

      <main className="full-map-stage">
        <IslandMap
          entities={result.entities}
          styleUrl={mapStyleUrl}
          category="all"
          onSelect={onSelect}
          onViewportChange={onViewportChange}
          initialBounds={initialBounds ?? undefined}
          interaction="full"
        />

        <button
          className="search-area-cta"
          type="button"
          onClick={searchThisArea}
          disabled={!viewport}
        >
          ⌕ {hasAreaSearch ? "Cập nhật khu vực này" : "Tìm trong khu vực này"}
        </button>

        {selected ? (
          <aside className="full-map-entity-sheet">
            <button
              className="entity-close"
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Đóng"
            >
              ×
            </button>
            <small>{selected.kicker}</small>
            <span className={`verification-badge verification-badge--${selected.verification}`}>
              {mapVerificationLabel(selected.verification)}
            </span>
            <strong>{selected.name}</strong>
            <p>{selected.copy}</p>
            {selected.href ? (
              <Link to={selected.href}>Xem lựa chọn</Link>
            ) : null}
          </aside>
        ) : (
          <aside className="map-results-sheet">
            <span className="sheet-grabber" />
            <div className="map-results-head">
              <div>
                <small>
                  {hasAreaSearch ? "TRONG KHU VỰC ĐÃ CHỌN" : "TRÊN BẢN ĐỒ"}
                </small>
                <strong>
                  {result.entities.length} nơi · {result.products.length} dịch vụ
                </strong>
              </div>
              <span>Giá từ</span>
            </div>

            <div className="map-result-cards">
              {result.products.map((product) => (
                <Link
                  key={product.productId}
                  className="map-result-card"
                  to={`/product/${product.slug}?date=${date}&pax=${pax}`}
                >
                  <span
                    className={`map-result-icon map-result-icon--${product.type}`}
                  >
                    {product.type === "tour"
                      ? "🛥"
                      : product.type === "ticket"
                        ? "🎟"
                        : "🚗"}
                  </span>
                  <div>
                    <b>{product.name}</b>
                    <small>
                      {product.fromPrice === null
                        ? "Liên hệ"
                        : `${money(product.fromPrice)} ${product.unit}`}
                    </small>
                  </div>
                  <i>→</i>
                </Link>
              ))}
              {!result.products.length ? (
                <div className="map-empty">
                  <b>Chưa có dịch vụ phù hợp</b>
                  <span>
                    Thử đổi bộ lọc, từ khóa hoặc quay lại tìm trên toàn đảo.
                  </span>
                </div>
              ) : null}
            </div>
          </aside>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
