import { useCallback, useState } from "react";
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router";
import { Brand } from "../components/Brand";
import { IslandMap } from "../components/IslandMap";
import {
  mapEntities,
  money,
  products,
  type MapCategory,
  type MapEntity,
} from "../domain/catalog";

export async function loader({ context }: LoaderFunctionArgs) {
  return {
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
  { id: "place", label: "Ăn uống" },
];

export default function HomeRoute() {
  const { mapStyleUrl } = useLoaderData<typeof loader>();
  const [category, setCategory] = useState<"all" | MapCategory>("all");
  const [selected, setSelected] = useState<MapEntity | null>(null);
  const onSelect = useCallback((entity: MapEntity) => setSelected(entity), []);

  return (
    <div className="page-shell">
      <header className="topbar">
        <Brand />
        <div className="top-actions">
          <button className="icon-button" type="button">VI</button>
          <Link className="header-link" to="/bookings">Đặt chỗ</Link>
        </div>
      </header>

      <main className="home-main">
        <section className="hero-copy">
          <p className="eyebrow">Khám phá Phú Quốc theo cách của bạn</p>
          <h1>
            Nhìn trên bản đồ.
            <br />
            <span>Tìm đúng thứ cần.</span>
          </h1>
        </section>

        <section className="search-panel">
          <label className="search-box">
            <span>⌕</span>
            <input placeholder="Tour, vé, xe, khách sạn..." />
          </label>
          <div className="trip-controls">
            <button type="button"><small>Ngày đi</small><b>Hôm nay</b></button>
            <button type="button"><small>Số khách</small><b>2 khách</b></button>
            <button className="primary-button" type="button">Tìm kiếm</button>
          </div>
        </section>

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
                <Service href="#" icon="⛴" title="Tàu & phà" copy="Lịch chạy theo ngày" />
              </div>
            </section>

            <section className="product-section">
              <p className="section-kicker">GỢI Ý Ở PHÚ QUỐC</p>
              <h2>Dễ đặt, dễ đi</h2>
              <div className="product-list">
                {Object.values(products).map((product) => (
                  <article className="product-card" key={product.type}>
                    <div className={`product-art product-art--${product.type}`}>
                      <span>{product.type === "tour" ? "◌" : product.type === "ticket" ? "⌁" : "→"}</span>
                    </div>
                    <div className="product-body">
                      <p>{product.kicker}</p>
                      <h3>{product.name}</h3>
                      <span>{product.lead}</span>
                      <div className="product-foot">
                        <div><small>Từ</small><b>{money(product.fromPrice)}</b></div>
                        <Link to={`/product/${product.type}`}>Xem</Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="desktop-map-card">
            <div className="map-card-head">
              <div><small>KHÁM PHÁ TRÊN BẢN ĐỒ</small><b>Phú Quốc</b></div>
              <button type="button">Tìm khu vực này</button>
            </div>
            <div className="desktop-map-stage">
              <IslandMap
                entities={mapEntities}
                styleUrl={mapStyleUrl}
                category={category}
                onSelect={onSelect}
              />
              {selected ? <MapEntitySheet entity={selected} onClose={() => setSelected(null)} /> : null}
            </div>
          </aside>
        </section>
      </main>
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
      <strong>{entity.name}</strong>
      <p>{entity.copy}</p>
      {entity.href ? <Link to={entity.href}>Xem lựa chọn</Link> : null}
    </div>
  );
}
