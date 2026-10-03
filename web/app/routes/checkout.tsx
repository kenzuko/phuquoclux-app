import { cloudflareRequestContext } from "../cloudflare-context";
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router";
import { Brand } from "../components/Brand";
import { getProductBySlug, money, type ProductId } from "../domain/catalog";
import {
  cancellationPolicyLabel,
  confirmationPolicyLabel,
  findOffer,
  getOffer,
  type Offer,
} from "../domain/offer";
import { formatServiceDate } from "../domain/service-date";
import { appendUnitQuantities, unitQuantitiesFromSearch } from "../domain/pricing";
import { createPrototypeQuote } from "../services/quote.server";
import { assertPrototypeCommerce, getCommerceMode } from "../services/commerce-mode.server";
import { safeReturnTo } from "../domain/navigation";

function parsePax(url: URL) {
  return Math.max(1, Math.min(20, Number(url.searchParams.get("pax")) || 2));
}

function readSelection(request: Request, productId: ProductId) {
  const url = new URL(request.url);
  const pax = parsePax(url);
  const offerId = url.searchParams.get("offer") ??
    url.searchParams.get("option") ?? undefined;
  const offer = offerId ? findOffer(productId, offerId) : getOffer(productId);

  if (!offer) {
    throw new Response("Offer unavailable", { status: 400 });
  }
  return {
    pax,
    offer,
    unitQuantities: unitQuantitiesFromSearch(offer, url.searchParams, pax),
    serviceDate: url.searchParams.get("date") ?? undefined,
  };
}

function buildSelectionQuery(
  offer: Offer,
  pax: number,
  serviceDate: string,
  unitQuantities: Record<string, number>,
  returnTo: string,
) {
  const params = new URLSearchParams({
    pax: String(pax),
    offer: offer.id,
    date: serviceDate,
  });
  appendUnitQuantities(params, offer, unitQuantities);
  params.set("returnTo", returnTo);
  return params.toString();
}

async function createRouteQuote(input: Parameters<typeof createPrototypeQuote>[0]) {
  try {
    return await createPrototypeQuote(input);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "OFFER_CAPACITY_EXCEEDED" || code === "TOO_MANY_PARTICIPANTS") {
      throw new Response("Selected option cannot carry this party size", {
        status: 409,
      });
    }
    throw error;
  }
}

/**
 * GET is a price/party/date preview only. No booking record exists yet.
 * Even a valid quote is never an invitation to submit personal details.
 */
export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const product = getProductBySlug(params.slug);
  if (!product) {
    throw new Response("Not found", { status: 404 });
  }
  assertPrototypeCommerce(getCommerceMode(context.get(cloudflareRequestContext).env));

  const selection = readSelection(request, product.id);
  const returnTo = safeReturnTo(
    new URL(request.url).searchParams.get("returnTo"),
    "/map",
  );
  const quote = await createRouteQuote({
    productId: product.id,
    offerId: selection.offer.id,
    pax: selection.pax,
    unitQuantities: selection.unitQuantities,
    serviceDate: selection.serviceDate,
    requestId: context.get(cloudflareRequestContext).requestId,
  });

  return {
    product,
    offer: selection.offer,
    quote,
    selectionQuery: buildSelectionQuery(
      selection.offer,
      quote.pax,
      quote.serviceDate,
      selection.unitQuantities,
      returnTo,
    ),
  };
}

/**
 * Fail closed before reading a request body. Durable storage and guest access
 * are already present, but production delivery/outbox activation is not yet
 * cleared end-to-end. A POST must stay unavailable until that gate is green.
 */
export async function action(): Promise<never> {
  throw new Response(
    "Booking requests are not available until delivery and activation checks are complete.",
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export function meta() {
  return [
    { title: "Xem trước đặt dịch vụ | My Phu Quoc" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export default function CheckoutRoute() {
  const { product, offer, quote, selectionQuery } = useLoaderData<typeof loader>();
  const expiresAt = new Date(quote.expiresAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const selectedProductUrl = `/product/${product.slug}?${selectionQuery}`;

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <span className="secure-label">Chưa nhận đặt chỗ</span>
      </header>

      <main id="main-content" className="checkout-main">
        <Link className="back-link" to={selectedProductUrl}>
          ← Quay lại dịch vụ
        </Link>

        <div className="checkout-grid">
          <div className="checkout-form">
            <section className="checkout-section">
              <p className="section-kicker">XEM TRƯỚC ĐẶT CHỖ</p>
              <h1>Kiểm tra lựa chọn</h1>
              <p>
                Bạn có thể xem phương án, ngày đi, số khách và giá tham khảo,
                nhưng hiện tại My Phu Quoc chưa tiếp nhận yêu cầu đặt chỗ.
              </p>
              <div className="prototype-warning" role="status">
                Chúng tôi chưa mở nhận thông tin khách vì luồng giao booking
                và xác nhận cuối cùng vẫn đang được kiểm tra. Không có yêu cầu
                nào được gửi đi hoặc ghi nhận ở bước này.
              </div>
            </section>

            <section className="checkout-section">
              <p className="section-kicker">KHI HỆ THỐNG MỞ ĐẶT CHỖ</p>
              <h2>Thông tin liên hệ</h2>
              <p>
                Họ tên, số điện thoại và email chỉ được yêu cầu khi booking
                có thể được lưu an toàn và người đặt nhận được mã truy cập.
              </p>
              <h2>Thông tin cho chuyến đi</h2>
              <p>
                {offer.operationalFields.includes("hotel_or_pickup")
                  ? "Điểm đón hoặc khách sạn. "
                  : ""}
                {offer.operationalFields.includes("flight_number")
                  ? "Số hiệu chuyến bay. "
                  : ""}
                {offer.operationalFields.includes("luggage_count")
                  ? "Số kiện hành lý. "
                  : ""}
                {offer.operationalFields.includes("guest_note")
                  ? "Ghi chú cho JoTrip."
                  : ""}
              </p>
            </section>

            <section className="checkout-section">
              <p className="section-kicker">TRẠNG THÁI</p>
              <h2>Chưa tiếp nhận yêu cầu</h2>
              <p>
                Giá hiện tại chỉ để tham khảo và chưa có xác nhận chỗ thực tế.
                Hãy kiểm tra lại khi hệ thống đặt chỗ được mở.
              </p>
            </section>

            <Link className="checkout-submit" to={selectedProductUrl}>
              Quay lại điều chỉnh lựa chọn
            </Link>
          </div>

          <aside className="order-summary">
            <p className="section-kicker">TÓM TẮT LỰA CHỌN</p>
            <h2>{product.name}</h2>
            <div className="order-meta">
              <div><span>Lựa chọn</span><b>{offer.label}</b></div>
              <div>
                <span>Ngày sử dụng</span>
                <b>{formatServiceDate(quote.serviceDate)}</b>
              </div>
              <div><span>Tổng số khách</span><b>{quote.pax}</b></div>
              {quote.lines.map((line) => (
                <div key={line.code}>
                  <span>{line.label} × {line.quantity}</span>
                  <b>{money(line.total.amount)}</b>
                </div>
              ))}
              <div>
                <span>Tình trạng</span>
                <b>{confirmationPolicyLabel(offer)}</b>
              </div>
              <div>
                <span>Đổi / huỷ</span>
                <b>{cancellationPolicyLabel(offer)}</b>
              </div>
            </div>
            <div className="order-line total">
              <span>{quote.priceState === "final" ? "Giá đang xem" : "Giá tham khảo"}</span>
              <strong>{money(quote.total.amount)}</strong>
            </div>
            <div className="quote-meta">
              <span>Chưa có mã đặt chỗ</span>
              <span>
                {quote.priceState === "final"
                  ? `Giá cần được xác minh lại sau ${expiresAt}`
                  : `Ước tính lúc ${expiresAt}`}
              </span>
            </div>
            {product.pricingNote ? (
              <div className="pricing-context-note pricing-context-note--summary">
                {product.pricingNote}
              </div>
            ) : null}
            <div className="support-note">
              <b>My Phu Quoc do JoTrip vận hành</b>
              <p>
                Trang này chưa gửi yêu cầu đến JoTrip. Chỉ khi có xác nhận
                thật, đặt chỗ mới xuất hiện trong tài khoản khách.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
