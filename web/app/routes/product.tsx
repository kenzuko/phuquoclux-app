import { useMemo, useState } from "react";
import {
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import { Brand } from "../components/Brand";
import {
  isProductType,
  mapEntities,
  money,
  products,
} from "../domain/catalog";
import { getOffer, offersForProduct } from "../domain/offer";
import { normalizeServiceDate, todayInPhuQuoc } from "../domain/service-date";
import { IslandMap } from "../components/IslandMap";

export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const type = params.type;
  if (!isProductType(type)) {
    throw new Response("Not found", { status: 404 });
  }

  const product = products[type];
  const offers = offersForProduct(type);
  const url = new URL(request.url);
  const initialPax = Math.max(
    1,
    Math.min(20, Number(url.searchParams.get("pax")) || 2),
  );
  const requestedOffer =
    url.searchParams.get("offer") ??
    url.searchParams.get("option") ??
    undefined;
  const initialOffer = getOffer(type, requestedOffer);

  if (!initialOffer) {
    throw new Response("No offer configured", { status: 503 });
  }

  const defaultDate = todayInPhuQuoc();
  const initialServiceDate = normalizeServiceDate(
    url.searchParams.get("date") ?? undefined,
  );

  return {
    product,
    offers,
    defaultDate,
    initialServiceDate,
    initialPax,
    initialOfferId: initialOffer.id,
    entities: mapEntities.filter(
      (entity) =>
        product.mapEntityIds.includes(entity.id) &&
        entity.verification === "verified",
    ),
    mapStyleUrl:
      context.cloudflare.env.MAP_STYLE_URL ??
      "https://demotiles.maplibre.org/style.json",
  };
}

export default function ProductRoute() {
  const {
    product,
    offers,
    entities,
    mapStyleUrl,
    defaultDate,
    initialServiceDate,
    initialPax,
    initialOfferId,
  } = useLoaderData<typeof loader>();
  const [offerId, setOfferId] = useState(initialOfferId);
  const [pax, setPax] = useState(initialPax);
  const [serviceDate, setServiceDate] = useState(initialServiceDate);

  const offer =
    offers.find((item) => item.id === offerId) ?? offers[0];
  const quantity = offer.price.basis === "per_person" ? pax : 1;
  const total = offer.price.amount * quantity;

  const checkoutUrl = useMemo(() => {
    const query = new URLSearchParams({
      pax: String(pax),
      offer: offerId,
      date: serviceDate,
    });
    return `/checkout/${product.type}?${query}`;
  }, [offerId, pax, product.type, serviceDate]);

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <Link className="header-link" to="/bookings">
          Đặt chỗ của tôi
        </Link>
      </header>

      <main className="detail-main">
        <Link className="back-link" to="/">
          ← Quay lại khám phá
        </Link>

        <section className="product-hero">
          <div>
            <p className="eyebrow">{product.kicker}</p>
            <h1>{product.name}</h1>
            <p>{product.lead}</p>
            <div className="chip-row">
              {product.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          </div>
          <div className={`product-hero-art product-hero-art--${product.type}`}>
            <span>{product.locationLabel}</span>
          </div>
        </section>

        <section className="detail-grid">
          <div className="detail-content">
            <section className="content-block">
              <p className="section-kicker">TÓM TẮT</p>
              <h2>Biết rõ trước khi đặt</h2>
              <p>
                PhuQuocLux tách thông tin địa điểm khỏi điều kiện bán.
                Giá, lựa chọn, ngày sử dụng và chính sách thuộc đúng Offer.
              </p>
              <div className="fact-grid">
                <div>
                  <small>Khu vực</small>
                  <b>{product.locationLabel}</b>
                </div>
                <div>
                  <small>Giá từ</small>
                  <b>{money(product.fromPrice)}</b>
                </div>
                <div>
                  <small>Voucher</small>
                  <b>Trong booking</b>
                </div>
                <div>
                  <small>Hỗ trợ</small>
                  <b>JoTrip</b>
                </div>
              </div>
            </section>

            <section className="content-block">
              <p className="section-kicker">VỊ TRÍ / TUYẾN</p>
              <h2>Xem trên bản đồ</h2>
              {entities.length ? (
                <div className="product-map-wrap">
                  <IslandMap
                    entities={entities}
                    styleUrl={mapStyleUrl}
                    category="all"
                    onSelect={() => undefined}
                    interaction="embedded"
                  />
                </div>
              ) : (
                <div className="map-verification-note">
                  <b>Chưa gắn pin sản phẩm</b>
                  <p>
                    Vị trí commerce chỉ được đưa lên Map khi tọa độ/điểm sử dụng
                    đã được xác minh. Không dùng pin gần đúng để lấp chỗ trống.
                  </p>
                </div>
              )}
            </section>

            <section className="content-block">
              <p className="section-kicker">TRƯỚC KHI ĐẶT</p>
              <h2>Thông tin cần biết</h2>
              <div className="policy-list">
                <div>
                  <b>Availability</b>
                  <p>
                    Không ghi “còn chỗ” cho tới khi Availability service xác nhận.
                  </p>
                </div>
                <div>
                  <b>Đổi / huỷ</b>
                  <p>
                    Policy đi theo đúng Offer, không dùng luật chung cho mọi sản phẩm.
                  </p>
                </div>
                <div>
                  <b>Vận hành</b>
                  <p>
                    Thông tin đón, voucher và hỗ trợ được đưa về My Bookings sau khi xác nhận.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="booking-card">
            <div className="booking-price">
              <small>Từ</small>
              <strong>{money(product.fromPrice)}</strong>
              <span>{product.unit}</span>
            </div>

            <label className="booking-field">
              <span>Ngày sử dụng</span>
              <input
                type="date"
                value={serviceDate}
                min={defaultDate}
                onChange={(event) => setServiceDate(event.target.value)}
              />
            </label>

            <div className="booking-field">
              <span>Lựa chọn</span>
              <div className="option-list">
                {offers.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={offerId === item.id ? "is-selected" : ""}
                    onClick={() => setOfferId(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="booking-field">
              <span>Số khách</span>
              <div className="quantity-control">
                <button
                  type="button"
                  onClick={() => setPax((value) => Math.max(1, value - 1))}
                >
                  −
                </button>
                <b>{pax}</b>
                <button
                  type="button"
                  onClick={() => setPax((value) => Math.min(20, value + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div className="booking-total">
              <small>Ước tính theo Offer</small>
              <strong>{money(total)}</strong>
            </div>

            <Link className="booking-cta" to={checkoutUrl}>
              Tiếp tục đặt
            </Link>
            <p className="microcopy">
              Giá cuối cùng được đóng thành Quote ở checkout. Chưa xác nhận availability.
            </p>
          </aside>
        </section>
      </main>
    </div>
  );
}
