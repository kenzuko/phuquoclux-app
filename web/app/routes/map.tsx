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
import { money } from "../domain/catalog";
import { discover, type DiscoveryQuery } from "../domain/discovery";

const allowedCategories: Array<"all" | MapCategory> = [
  "all",
  "tour",
  "ticket",
  "transfer",
  "place",
];

function parseCategory(value: string | null): DiscoveryQuery["category"] {
  return allowedCategories.includes(value as "all" | MapCategory)
    ? (value as "all" | MapCategory)
    : "all";
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const category = parseCategory(url.searchParams.get("category"));
  const q = url.searchParams.get("q") ?? undefined;

  return {
    result: discover({ category, q }),
    category,
    q: q ?? "",
    mapStyleUrl:
      context.cloudflare.env.MAP_STYLE_URL ??
      "https://demotiles.maplibre.org/style.json",
  };
}

export default function MapRoute() {
  const { result, category, q, mapStyleUrl } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<MapEntity | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const onSelect = useCallback((entity: MapEntity) => setSelected(entity), []);

  function changeCategory(next: "all" | MapCategory) {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("category");
    else params.set("category", next);
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
          <span>⌕</span>
          <input
            key={q}
            name="q"
            defaultValue={q}
            placeholder="Tìm trên bản đồ Phú Quốc"
            aria-label="Tìm trên bản đồ Phú Quốc"
          />
        </Form>
        <Link className="map-close-link" to="/">Đóng ×</Link>
      </header>

      <div className="map-filter-row">
        {[
          ["all", "Tất cả"],
          ["tour", "Tour"],
          ["ticket", "Vé"],
          ["transfer", "Xe"],
          ["place", "Ăn uống"],
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
      </div>

      <main className="full-map-stage">
        <IslandMap
          entities={result.entities}
          styleUrl={mapStyleUrl}
          category="all"
          onSelect={onSelect}
        />

        <button className="search-area-cta" type="button">
          ⌕ Tìm trong khu vực này
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
            <strong>{selected.name}</strong>
            <p>{selected.copy}</p>
            {selected.href ? <Link to={selected.href}>Xem lựa chọn</Link> : null}
          </aside>
        ) : (
          <aside className="map-results-sheet">
            <span className="sheet-grabber" />
            <div className="map-results-head">
              <div>
                <small>TRONG KHU VỰC NÀY</small>
                <strong>
                  {result.entities.length} nơi · {result.products.length} dịch vụ
                </strong>
              </div>
              <span>Giá từ</span>
            </div>

            <div className="map-result-cards">
              {result.products.map((product) => (
                <Link
                  key={product.type}
                  className="map-result-card"
                  to={`/product/${product.type}`}
                >
                  <span className={`map-result-icon map-result-icon--${product.type}`}>
                    {product.type === "tour" ? "🛥" : product.type === "ticket" ? "🎟" : "🚗"}
                  </span>
                  <div>
                    <b>{product.name}</b>
                    <small>{money(product.fromPrice)} {product.unit}</small>
                  </div>
                  <i>→</i>
                </Link>
              ))}
              {!result.products.length ? (
                <div className="map-empty">
                  <b>Chưa có dịch vụ phù hợp</b>
                  <span>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
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
