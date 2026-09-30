import { useMemo, useState } from "react";
import {
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import { Brand } from "../components/Brand";
import {
  getProductBySlug,
  mapCoordinateScopeCopy,
  mapCoordinateScopeLabel,
  mapEntities,
  money,
} from "../domain/catalog";
import {
  cancellationPolicyLabel,
  confirmationPolicyLabel,
  fromPriceForProduct,
  getOffer,
  maxPaxForProduct,
  offerSupportsPax,
  offersForProduct,
  priceCertaintyForProduct,
} from "../domain/offer";
import {
  appendUnitQuantities,
  defaultUnitQuantities,
  priceOffer,
  unitQuantitiesFromSearch,
  type UnitQuantities,
} from "../domain/pricing";
import { normalizeServiceDate, todayInPhuQuoc } from "../domain/service-date";
import { mapUrl, normalizePax } from "../domain/trip-intent";
import { safeReturnTo } from "../domain/navigation";
import { IslandMap } from "../components/IslandMap";
import { ProductVisual } from "../components/ProductVisual";

export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const product = getProductBySlug(params.slug);
  if (!product) {
    throw new Response("Not found", { status: 404 });
  }

  const offers = offersForProduct(product.id);
  const url = new URL(request.url);
  const initialPax = Math.min(
    normalizePax(url.searchParams.get("pax"), 2),
    maxPaxForProduct(product.id),
  );
  const requestedOffer =
    url.searchParams.get("offer") ??
    url.searchParams.get("option") ??
    undefined;
  const requestedInitialOffer = getOffer(product.id, requestedOffer);
  const initialOffer =
    requestedInitialOffer &&
    offerSupportsPax(requestedInitialOffer, initialPax)
      ? requestedInitialOffer
      : offers.find((offer) => offerSupportsPax(offer, initialPax));

  if (!initialOffer) {
    throw new Response("No offer configured", { status: 503 });
  }

  const defaultDate = todayInPhuQuoc();
  const initialServiceDate = normalizeServiceDate(
    url.searchParams.get("date") ?? undefined,
  );
  const returnTo = safeReturnTo(
    url.searchParams.get("returnTo"),
    mapUrl({ date: initialServiceDate, pax: initialPax }),
  );

  return {
    product,
    offers,
    fromPrice: fromPriceForProduct(product.id),
    priceState: priceCertaintyForProduct(product.id),
    defaultDate,
    initialServiceDate,
    initialPax,
    maxPax: maxPaxForProduct(product.id),
    initialOfferId: initialOffer.id,
    returnTo,
    initialUnitQuantities: unitQuantitiesFromSearch(
      initialOffer,
      url.searchParams,
      initialPax,
    ),
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

export function meta({
  data,
}: {
  data?: Awaited<ReturnType<typeof loader>>;
}) {
  if (!data) {
    return [{ title: "Dịch vụ Phú Quốc | PhuQuocLux" }];
  }

  return [
    { title: `${data.product.name} | PhuQuocLux` },
    { name: "description", content: data.product.lead },
    { property: "og:title", content: data.product.name },
    { property: "og:description", content: data.product.lead },
    { property: "og:type", content: "website" },
  ];
}

export default function ProductRoute() {
  const {
    product,
    offers,
    fromPrice,
    priceState,
    entities,
    mapStyleUrl,
    defaultDate,
    initialServiceDate,
    initialPax,
    maxPax,
    initialOfferId,
    returnTo,
    initialUnitQuantities,
  } = useLoaderData<typeof loader>();
  const [offerId, setOfferId] = useState(initialOfferId);
  const [pax, setPax] = useState(initialPax);
  const [serviceDate, setServiceDate] = useState(initialServiceDate);
  const [unitQuantities, setUnitQuantities] =
    useState<UnitQuantities>(initialUnitQuantities);

  const offer =
    offers.find((item) => item.id === offerId) ?? offers[0];
  const priced = priceOffer(offer, pax, unitQuantities);

  const checkoutUrl = useMemo(() => {
    const query = new URLSearchParams({
      pax: String(priced.pax),
      offer: offerId,
      date: serviceDate,
    });
    appendUnitQuantities(query, offer, unitQuantities);
    query.set("returnTo", returnTo);
    return `/checkout/${product.slug}?${query}`;
  }, [
    offer,
    offerId,
    priced.pax,
    product.slug,
    returnTo,
    serviceDate,
    unitQuantities,
  ]);

  function chooseOffer(nextOfferId: string) {
    const next =
      offers.find((item) => item.id === nextOfferId) ?? offers[0];
    setOfferId(next.id);
    setUnitQuantities(
      next.pricing.mode === "unit_mix"
        ? defaultUnitQuantities(next, pax)
        : {},
    );
  }

  function changePax(delta: number) {
    const nextPax = Math.max(
      1,
      Math.min(maxPax, pax + delta),
    );

    if (nextPax === pax) return;

    if (!offerSupportsPax(offer, nextPax)) {
      const compatible = offers.find((item) =>
        offerSupportsPax(item, nextPax),
      );

      if (compatible) {
        setOfferId(compatible.id);
        setUnitQuantities(
          compatible.pricing.mode === "unit_mix"
            ? defaultUnitQuantities(compatible, nextPax)
            : {},
        );
      }
    }

    setPax(nextPax);
  }

  function changeUnit(code: string, delta: number) {
    setUnitQuantities((current) => {
      const nextValue = Math.max(
        0,
        Math.min(20, (current[code] ?? 0) + delta),
      );
      const next = { ...current, [code]: nextValue };
      const total = Object.values(next).reduce(
        (sum, value) => sum + value,
        0,
      );

      if (total < 1 || total > 20) return current;
      return next;
    });
  }

  const primaryEntity = entities[0];
  const mapSearchParams = new URLSearchParams({ q: product.name });
  const productMapUrl = mapUrl(
    { date: serviceDate, pax: priced.pax },
    mapSearchParams,
  );

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <Link className="header-link" to="/bookings">
          Đặt chỗ của tôi
        </Link>
      </header>

      <main className="detail-main">
        <Link className="back-link" to={returnTo}>
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
          <ProductVisual product={product} mode="hero" />
        </section>

        <section className="detail-grid">
          <div className="detail-content">
            <section className="content-block">
              <p className="section-kicker">TÓM TẮT</p>
              <h2>Biết rõ trước khi đặt</h2>
              <p>
                Chọn ngày, số khách và phương án phù hợp. Giá hiển thị sẽ thay đổi
                theo lựa chọn của bạn và được kiểm tra lại trước khi gửi yêu cầu.
              </p>
              <div className="fact-grid">
                {product.facts.slice(0, 2).map((fact) => (
                  <div key={fact.label}>
                    <small>{fact.label}</small>
                    <b>{fact.value}</b>
                  </div>
                ))}
                <div>
                  <small>
                    {priceState === "estimated" ? "Giá tham khảo từ" : "Giá từ"}
                  </small>
                  <b>{fromPrice === null ? "Liên hệ" : money(fromPrice)}</b>
                </div>
                <div>
                  <small>Sau khi xác nhận</small>
                  <b>{product.fulfillmentSummary}</b>
                </div>
              </div>
            </section>

            <section className="content-block">
              <p className="section-kicker">VỊ TRÍ / TUYẾN</p>
              <h2>
                {primaryEntity?.coordinateScope === "area"
                  ? "Xem khu vực trên bản đồ"
                  : "Xem trên bản đồ"}
              </h2>
              {entities.length ? (
                <>
                  <div className="product-map-wrap">
                    <IslandMap
                      entities={entities}
                      styleUrl={mapStyleUrl}
                      category="all"
                      onSelect={() => undefined}
                      interaction="embedded"
                    />
                  </div>
                  {primaryEntity ? (
                    <div className="product-map-scope">
                      <b>{mapCoordinateScopeLabel(primaryEntity.coordinateScope)}</b>
                      <span>{mapCoordinateScopeCopy(primaryEntity)}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="map-verification-note">
                  <b>Chưa hiển thị vị trí chính xác</b>
                  <p>
                    PhuQuocLux chỉ hiển thị pin khi vị trí đủ tin cậy.
                    Những điểm chưa xác minh sẽ không được đặt gần đúng trên bản đồ.
                  </p>
                </div>
              )}
              <Link className="product-map-link" to={productMapUrl}>
                Mở trên bản đồ
              </Link>
            </section>

            <section className="content-block">
              <p className="section-kicker">TRƯỚC KHI ĐẶT</p>
              <h2>Thông tin cần biết</h2>
              <div className="policy-list">
                <div>
                  <b>Tình trạng chỗ</b>
                  <p>
                    Chỉ báo còn chỗ khi có dữ liệu xác nhận. Nếu chưa chắc chắn,
                    hệ thống sẽ ghi rõ là cần kiểm tra lại.
                  </p>
                </div>
                <div>
                  <b>Đổi / huỷ</b>
                  <p>
                    Điều kiện đổi hoặc hủy đi theo đúng lựa chọn bạn đặt và được
                    xác nhận rõ trước khi phát sinh thanh toán.
                  </p>
                </div>
                <div>
                  <b>Sau khi đặt</b>
                  <p>
                    Điểm đón, voucher và hướng dẫn sử dụng sẽ nằm trong mục
                    Đặt chỗ của tôi sau khi được xác nhận.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="booking-card">
            <div className="booking-price">
              <small>
                {priceState === "estimated" ? "Giá tham khảo từ" : "Từ"}
              </small>
              <strong>{fromPrice === null ? "Liên hệ" : money(fromPrice)}</strong>
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

            {offers.length > 1 ? (
              <div className="booking-field">
                <span>Lựa chọn</span>
                <div className="option-list">
                  {offers.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={offerId === item.id ? "is-selected" : ""}
                      onClick={() => chooseOffer(item.id)}
                      disabled={!offerSupportsPax(item, pax)}
                    >
                      <span>{item.label}</span>
                      {item.constraints?.maxPax ? (
                        <small>Tối đa {item.constraints.maxPax} khách</small>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="booking-field">
              <span>
                {offer.pricing.mode === "unit_mix"
                  ? "Số lượng vé"
                  : "Số khách"}
              </span>

              {offer.pricing.mode === "unit_mix" ? (
                <div className="unit-quantity-list">
                  {offer.pricing.units.map((unit) => (
                    <div className="unit-quantity-row" key={unit.code}>
                      <div>
                        <b>{unit.label}</b>
                        <small>{money(unit.amount)} / vé</small>
                      </div>
                      <div className="quantity-control">
                        <button
                          type="button"
                          onClick={() => changeUnit(unit.code, -1)}
                        >
                          −
                        </button>
                        <b>{unitQuantities[unit.code] ?? 0}</b>
                        <button
                          type="button"
                          onClick={() => changeUnit(unit.code, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="quantity-control">
                  <button
                    type="button"
                    onClick={() => changePax(-1)}
                  >
                    −
                  </button>
                  <b>{pax}</b>
                  <button
                    type="button"
                    onClick={() => changePax(1)}
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div className="booking-total">
              <small>
                {priced.priceState === "estimated" ? "Tạm tính tham khảo" : "Tạm tính"}
              </small>
              <strong>{money(priced.totalAmount)}</strong>
            </div>

            <div className="booking-policy-summary">
              <div>
                <span>Xác nhận</span>
                <b>{confirmationPolicyLabel(offer)}</b>
              </div>
              <div>
                <span>Đổi / huỷ</span>
                <b>{cancellationPolicyLabel(offer)}</b>
              </div>
            </div>

            <Link className="booking-cta" to={checkoutUrl}>
              Tiếp tục đặt
            </Link>
            <p className="microcopy">
              Giá và tình trạng chỗ sẽ được kiểm tra lại ở bước tiếp theo.
            </p>
            {product.pricingNote ? (
              <p className="pricing-context-note">{product.pricingNote}</p>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
