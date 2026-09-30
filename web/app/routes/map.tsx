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
import { WeatherContextChip } from "../components/WeatherContextChip";
import type { MapCategory, MapEntity } from "../domain/catalog";
import {
  mapVerificationLabel,
  money,
  productsForMapEntity,
} from "../domain/catalog";
import {
  fromPriceForProduct,
  priceCertaintyForProduct,
} from "../domain/offer";
import {
  homeUrl,
  productSlugUrl,
  productUrl,
  tripIntentFromUrl,
  type TripIntent,
} from "../domain/trip-intent";
import {
  discover,
  type BoundingBox,
  type DiscoveryQuery,
} from "../domain/discovery";
import { boundsForEntities } from "../domain/map-bounds";
import { withReturnTo } from "../domain/navigation";
import { useWeatherContext } from "../hooks/use-weather-context";
import { cloudflareRequestContext } from "../cloudflare-context";

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
  const intent = tripIntentFromUrl(url);

  const result = discover({
    category,
    q,
    bounds,
    date: intent.date,
    pax: intent.pax,
  });
  const searchFocusBounds =
    !bounds && q ? boundsForEntities(result.entities) : undefined;

  return {
    result,
    category,
    q: q ?? "",
    intent,
    hasAreaSearch: Boolean(bounds),
    initialBounds: bounds ?? searchFocusBounds ?? null,
    mapStyleUrl:
      context.get(cloudflareRequestContext).env.MAP_STYLE_URL ??
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
    intent,
    hasAreaSearch,
    initialBounds,
    mapStyleUrl,
  } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<MapEntity | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [viewport, setViewport] = useState<BoundingBox | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedWeather = useWeatherContext(selected?.weatherPointId);
  const entityResults =
    category === "place"
      ? result.entities
      : result.entities.slice(0, 6);
  const returnTo = searchParams.toString()
    ? `/map?${searchParams.toString()}`
    : "/map";

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
    setSheetExpanded(false);
  }

  function searchThisArea() {
    if (!viewport) return;

    const params = new URLSearchParams(searchParams);
    for (const key of boundKeys) {
      params.set(key, viewport[key].toFixed(5));
    }
    setSearchParams(params);
    setSelected(null);
    setSheetExpanded(false);
  }

  function clearAreaSearch() {
    const params = new URLSearchParams(searchParams);
    for (const key of boundKeys) params.delete(key);
    setSearchParams(params);
    setSelected(null);
    setSheetExpanded(false);
  }

  function changeIntent(key: "date" | "pax", value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    setSearchParams(params);
    setSelected(null);
    setSheetExpanded(false);
  }

  return (
    <div className="map-page">
      <header className="map-topbar">
        <Brand compact />
        <Form className="map-search" method="get" action="/map">
          {category !== "all" ? (
            <input type="hidden" name="category" value={category} />
          ) : null}
          <input type="hidden" name="date" value={intent.date} />
          <input type="hidden" name="pax" value={intent.pax} />
          {hasAreaSearch && initialBounds ? (
            <>
              <input type="hidden" name="west" value={initialBounds.west} />
              <input type="hidden" name="south" value={initialBounds.south} />
              <input type="hidden" name="east" value={initialBounds.east} />
              <input type="hidden" name="north" value={initialBounds.north} />
            </>
          ) : null}
          <span>⌕</span>
          <input
            key={q}
            name="q"
            defaultValue={q}
            placeholder="Tìm trên bản đồ Phú Quốc"
            aria-label="Tìm trên bản đồ Phú Quốc"
          />
        </Form>
        <Link className="map-close-link" to={homeUrl(intent)}>
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
            aria-pressed={category === id}
            onClick={() => changeCategory(id as "all" | MapCategory)}
          >
            {label}
          </button>
        ))}
        <label className="map-intent-control">
          <span>Ngày</span>
          <input
            type="date"
            value={intent.date}
            onChange={(event) => changeIntent("date", event.target.value)}
          />
        </label>
        <label className="map-intent-control">
          <span>Khách</span>
          <select
            value={intent.pax}
            onChange={(event) => changeIntent("pax", event.target.value)}
          >
            {Array.from({ length: 20 }, (_, index) => index + 1).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
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

      <main id="main-content" className="full-map-stage">
        <IslandMap
          entities={result.entities}
          styleUrl={mapStyleUrl}
          category="all"
          onSelect={onSelect}
          selectedEntityId={selected?.id}
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
              {mapVerificationLabel(selected)}
            </span>
            <strong>{selected.name}</strong>
            <p>{selected.copy}</p>
            <WeatherContextChip
              weather={selectedWeather}
              variant="inline"
            />
            <MapRelatedProducts
              entity={selected}
              intent={intent}
              returnTo={returnTo}
            />
          </aside>
        ) : (
          <aside
            className={`map-results-sheet${sheetExpanded ? " is-expanded" : ""}`}
          >
            <button
              className="sheet-grabber"
              type="button"
              aria-label={
                sheetExpanded
                  ? "Thu gọn danh sách kết quả"
                  : "Mở rộng danh sách kết quả"
              }
              aria-expanded={sheetExpanded}
              onClick={() => setSheetExpanded((value) => !value)}
            />
            <div className="map-results-head">
              <div>
                <small>
                  {hasAreaSearch ? "TRONG KHU VỰC ĐÃ CHỌN" : "TRÊN BẢN ĐỒ"}
                </small>
                <strong>
                  {result.entities.length} nơi · {result.products.length} dịch vụ
                </strong>
              </div>
              <span>Giá hiển thị</span>
            </div>

            <div className="map-result-cards">
              {result.products.length ? (
                <div className="map-result-group">
                  <span className="map-result-group-label">DỊCH VỤ</span>
                  {result.products.map((product) => (
                    <Link
                      key={product.productId}
                      className="map-result-card"
                      to={withReturnTo(
                        productSlugUrl(product.slug, intent),
                        returnTo,
                      )}
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
                        <span className="map-result-place">
                          {product.locationLabel}
                        </span>
                        <small>
                          {product.fromPrice === null
                            ? "Liên hệ"
                            : `${product.priceState === "estimated" ? "Tham khảo " : ""}${money(product.fromPrice)} ${product.unit}`}
                        </small>
                        {product.spatialMatch === "unlocated" ? (
                          <small className="map-result-location">
                            Chưa gắn vị trí chính xác
                          </small>
                        ) : null}
                      </div>
                      <i>→</i>
                    </Link>
                  ))}
                </div>
              ) : null}

              {entityResults.length ? (
                <div className="map-result-group">
                  <span className="map-result-group-label">
                    ĐIỂM TRÊN BẢN ĐỒ
                  </span>
                  {entityResults.map((entity) => (
                    <button
                      key={entity.id}
                      className="map-entity-result"
                      type="button"
                      onClick={() => {
                        setSelected(entity);
                        setSheetExpanded(false);
                      }}
                    >
                      <span
                        className={`map-result-icon map-result-icon--${entity.category}`}
                      >
                        {entity.icon}
                      </span>
                      <span>
                        <b>{entity.name}</b>
                        <small>{entity.subtitle}</small>
                        <em
                          className={`map-result-verification map-result-verification--${entity.verification}`}
                        >
                          {mapVerificationLabel(entity)}
                        </em>
                      </span>
                      <i>⌖</i>
                    </button>
                  ))}
                </div>
              ) : null}

              {!result.products.length && !result.entities.length ? (
                <div className="map-empty">
                  <b>Chưa có kết quả phù hợp</b>
                  <span>
                    Thử đổi bộ lọc, từ khóa hoặc quay lại tìm trên toàn đảo.
                  </span>
                </div>
              ) : null}
            </div>
          </aside>
        )}
      </main>

      <BottomNav intent={intent} />
    </div>
  );
}

function MapRelatedProducts({
  entity,
  intent,
  returnTo,
}: {
  entity: MapEntity;
  intent: TripIntent;
  returnTo: string;
}) {
  const related = productsForMapEntity(entity.id);

  if (!related.length) return null;

  return (
    <div className="entity-related-products">
      {related.slice(0, 4).map((product) => (
        <Link
          className="entity-product-link"
          key={product.id}
          to={withReturnTo(productUrl(product, intent), returnTo)}
        >
          <span>
            <b>{product.name}</b>
            <small>
              {priceCertaintyForProduct(product.id) === "estimated"
                ? "Tham khảo từ "
                : "Từ "}
              {fromPriceForProduct(product.id) === null
                ? "Liên hệ"
                : money(fromPriceForProduct(product.id)!)}
            </small>
          </span>
          <i>→</i>
        </Link>
      ))}
    </div>
  );
}
