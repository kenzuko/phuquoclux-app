import { useCallback, useMemo, useState } from "react";
import { Form, Link, type LoaderFunctionArgs, useLoaderData } from "react-router";
import { BottomNav } from "../components/BottomNav";
import { Brand } from "../components/Brand";
import { IslandMap } from "../components/IslandMap";
import {
  mapEntities,
  money,
  products,
  type MapCategory,
  type MapEntity,
  mapVerificationLabel,
} from "../domain/catalog";
import type { BoundingBox } from "../domain/discovery";
import { todayInPhuQuoc } from "../domain/service-date";
import { fromPriceForProduct } from "../domain/offer";

export async function loader({ context }: LoaderFunctionArgs) {
  return {
    today: todayInPhuQuoc(),
    mapStyleUrl:
      context.cloudflare.env.MAP_STYLE_URL ??
      "https://demotiles.maplibre.org/style.json",
  };
}

const filters: Array<{ id: "all" | MapCategory; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "tour", label: "Tour" },
  { id: "ticket", label: "Vé" },
  { id: "transfer", label: "Xe" },
  { id: "place", label: "Địa điểm" },
];

export default function HomeRoute() {
  const { mapStyleUrl, today } = useLoaderData<typeof loader>();
  const [category, setCategory] = useState<"all" | MapCategory>("all");
  const [selected, setSelected] = useState<MapEntity | null>(null);
  const [desktopViewport, setDesktopViewport] = useState<BoundingBox | null>(null);
  const onSelect = useCallback((entity: MapEntity) => setSelected(entity), []);
  const onDesktopViewportChange = useCallback(
    (bounds: BoundingBox) => setDesktopViewport(bounds),
    [],
  );

  const mapAreaUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (desktopViewport) {
      params.set("west", desktopViewport.west.toFixed(5));
      params.set("south", desktopViewport.south.toFixed(5));
      params.set("east", desktopViewport.east.toFixed(5));
      params.set("north", desktopViewport.north.toFixed(5));
    }
    const query = params.toString();
    return query ? `/map?${query}` : "/map";
  }, [category, desktopViewport]);

  return (
    <div className="page-shell">
      <header className="topbar">
        <Brand />
        <div className="top-actions">
          <span className="icon-button language-indicator" aria-label="Ngôn ngữ hiện tại: Tiếng Việt">VI</span>
          <Link className="header-link" to="/bookings">Đặt chỗ</Link>
        </div>
      </header>

      <main className="home-main">
        <section className="home-context">
          <div>
            <p className="eyebrow">ĐIỂM ĐẾN</p>
            <h1>Phú Quốc</h1>
          </div>
          <p>Khám phá trên bản đồ · Tìm và đặt dịch vụ nhanh</p>
        </section>

        <Form className="search-panel" method="get" action="/map">
          {category !== "all" ? (
            <input type="hidden" name="category" value={category} />
          ) : null}
          <label className="search-box">
            <span>⌕</span>
            <input name="q" placeholder="Tour, vé, xe, địa điểm..." />
          </label>
          <div className="trip-controls">
            <label className="trip-field">
              <small>Ngày đi</small>
              <input type="date" name="date" defaultValue={today} min={today} />
            </label>
            <label className="trip-field">
              <small>Số khách</small>
              <select name="pax" defaultValue="2">
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value} khách
                    </option>
                  ),
                )}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Tìm kiếm
            </button>
          </div>
        </Form>

        <section className="discovery-grid">
          <div className="discovery-content">
            <div className="filter-row">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  className={category === filter.id ? "is-active" : ""}
                  type="button"
                  onClick={() => {
                    setCategory(filter.id);
                    setSelected(null);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="mobile-map-card">
              <IslandMap
                entities={mapEntities}
                styleUrl={mapStyleUrl}
                category={category}
                onSelect={onSelect}
                interaction="embedded"
              />
              {selected ? <MapEntitySheet entity={selected} onClose={() => setSelected(null)} /> : null}
            </div>

            <section className="quick-section">
              <p className="section-kicker">DỊCH VỤ NHANH</p>
              <h2>Bạn đang cần gì?</h2>
              <div className="service-grid">
                <Service href="/product/transfer" icon="🚗" title="Đón sân bay" copy="Xe riêng, giá rõ ràng" />
                <Service href="/product/ticket" icon="🎟" title="Vé Hòn Thơm" copy="Chọn ngày, nhận voucher" />
                <Service href="/product/tour" icon="🛥" title="Tour hôm nay" copy="Xem tour và lựa chọn" />
                <Service href="/map" icon="⌖" title="Mở bản đồ" copy="Khám phá theo khu vực" />
              </div>
            </section>

            <section className="product-section">
              <p className="section-kicker">GỢI Ý Ở PHÚ QUỐC</p>
              <h2>Dễ đặt, dễ đi</h2>
              <div className="product-list">
                {Object.values(products)
                  .filter(
                    (product) =>
                      category === "all" || product.type === category,
                  )
                  .map((product) => (
                  <article className="product-card" key={product.type}>
                    <div className={`product-art product-art--${product.type}`}>
                      <span>{product.type === "tour" ? "◌" : product.type === "ticket" ? "⌁" : "→"}</span>
                    </div>
                    <div className="product-body">
                      <p>{product.kicker}</p>
                      <h3>{product.name}</h3>
                      <span>{product.lead}</span>
                      <div className="product-foot">
                        <div>
                          <small>Từ</small>
                          <b>
                            {fromPriceForProduct(product.type) === null
                              ? "Liên hệ"
                              : money(fromPriceForProduct(product.type)!)}
                          </b>
                        </div>
                        <Link to={`/product/${product.type}`}>Xem</Link>
                      </div>
                    </div>
                  </article>
                ))}
                {category === "place" ? (
                  <div className="category-placeholder">
                    <b>Đang bổ sung địa điểm</b>
                    <span>
                      Chỉ hiển thị những điểm có vị trí và trạng thái hoạt động đủ tin cậy.
                    </span>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="desktop-map-card">
            <div className="map-card-head">
              <div><small>KHÁM PHÁ TRÊN BẢN ĐỒ</small><b>Phú Quốc</b></div>
              <Link className="map-area-link" to={mapAreaUrl}>
                Tìm khu vực này
              </Link>
            </div>
            <div className="desktop-map-stage">
              <IslandMap
                entities={mapEntities}
                styleUrl={mapStyleUrl}
                category={category}
                onSelect={onSelect}
                onViewportChange={onDesktopViewportChange}
                interaction="full"
              />
              {selected ? <MapEntitySheet entity={selected} onClose={() => setSelected(null)} /> : null}
            </div>
          </aside>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function Service({ href, icon, title, copy }: { href: string; icon: string; title: string; copy: string }) {
  return (
    <Link className="service-card" to={href}>
      <span>{icon}</span>
      <b>{title}</b>
      <small>{copy}</small>
    </Link>
  );
}

function MapEntitySheet({ entity, onClose }: { entity: MapEntity; onClose: () => void }) {
  return (
    <div className="entity-sheet">
      <button className="entity-close" type="button" onClick={onClose}>×</button>
      <small>{entity.kicker}</small>
      <span className={`verification-badge verification-badge--${entity.verification}`}>
        {mapVerificationLabel(entity.verification)}
      </span>
      <strong>{entity.name}</strong>
      <p>{entity.copy}</p>
      {entity.href ? <Link to={entity.href}>Xem lựa chọn</Link> : null}
    </div>
  );
}
