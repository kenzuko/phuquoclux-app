import {
  Form,
  Link,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import { Brand } from "../components/Brand";
import { getProductBySlug, money, type ProductId } from "../domain/catalog";
import { assertQuoteBookable } from "../domain/commerce";
import { getOffer, type Offer } from "../domain/offer";
import {
  appendUnitQuantities,
  unitQuantitiesFromSearch,
} from "../domain/pricing";
import { createPrototypeQuote } from "../services/quote.server";
import { createPrototypeBookingRequest } from "../services/booking.server";
import {
  assertPrototypeCommerce,
  getCommerceMode,
} from "../services/commerce-mode.server";
import {
  assertSameOriginMutation,
  readEmail,
  readPhone,
  readText,
  readUuid,
} from "../services/request-validation.server";
import {
  parsePrototypeQuoteReceipt,
  reconcilePrototypeQuote,
  serializePrototypeQuoteReceipt,
} from "../services/prototype-quote-receipt.server";

function parsePax(url: URL) {
  return Math.max(
    1,
    Math.min(20, Number(url.searchParams.get("pax")) || 2),
  );
}

function readSelection(
  request: Request,
  productId: ProductId,
) {
  const url = new URL(request.url);
  const pax = parsePax(url);
  const offerId =
    url.searchParams.get("offer") ??
    url.searchParams.get("option") ??
    undefined;
  const offer = getOffer(productId, offerId);

  if (!offer) {
    throw new Response("Offer unavailable", { status: 503 });
  }

  return {
    pax,
    offer,
    unitQuantities: unitQuantitiesFromSearch(
      offer,
      url.searchParams,
      pax,
    ),
    serviceDate: url.searchParams.get("date") ?? undefined,
  };
}

function buildSelectionQuery(
  offer: Offer,
  pax: number,
  serviceDate: string,
  unitQuantities: Record<string, number>,
) {
  const params = new URLSearchParams({
    pax: String(pax),
    offer: offer.id,
    date: serviceDate,
  });
  appendUnitQuantities(params, offer, unitQuantities);
  return params.toString();
}

export async function loader({
  params,
  request,
  context,
}: LoaderFunctionArgs) {
  const product = getProductBySlug(params.slug);
  if (!product) {
    throw new Response("Not found", { status: 404 });
  }

  assertPrototypeCommerce(getCommerceMode(context.cloudflare.env));

  const selection = readSelection(request, product.id);
  const quote = await createPrototypeQuote({
    productId: product.id,
    offerId: selection.offer.id,
    pax: selection.pax,
    unitQuantities: selection.unitQuantities,
    serviceDate: selection.serviceDate,
    requestId: context.cloudflare.requestId,
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
    ),
    quoteReceipt: serializePrototypeQuoteReceipt(quote),
    requestId: crypto.randomUUID(),
  };
}

export async function action({
  params,
  request,
  context,
}: ActionFunctionArgs) {
  const product = getProductBySlug(params.slug);
  if (!product) {
    throw new Response("Not found", { status: 404 });
  }

  assertPrototypeCommerce(getCommerceMode(context.cloudflare.env));
  assertSameOriginMutation(request);

  const selection = readSelection(request, product.id);
  const form = await request.formData();
  const requestId = readUuid(form, "requestId");
  const receipt = parsePrototypeQuoteReceipt(
    readText(form, "quoteReceipt", { required: true, maxLength: 2000 }),
  );

  const freshQuote = await createPrototypeQuote({
    productId: product.id,
    offerId: selection.offer.id,
    pax: selection.pax,
    unitQuantities: selection.unitQuantities,
    serviceDate: selection.serviceDate,
    requestId: context.cloudflare.requestId,
  });
  const quote = reconcilePrototypeQuote(receipt, freshQuote);
  assertQuoteBookable(quote);

  const operationalFields = new Set(selection.offer.operationalFields);
  const name = readText(form, "name", { required: true, maxLength: 120 });
  const phone = readPhone(form);
  const email = readEmail(form);
  const hotelOrPickup = readText(form, "usage", { maxLength: 300 });
  const flightNumber = readText(form, "flightNumber", { maxLength: 32 });
  const guestNote = readText(form, "note", { maxLength: 1200 });

  const booking = createPrototypeBookingRequest({
    requestId,
    quote,
    contact: { name, phone, email },
    operationalData: {
      hotelOrPickup: operationalFields.has("hotel_or_pickup")
        ? hotelOrPickup || undefined
        : undefined,
      flightNumber: operationalFields.has("flight_number")
        ? flightNumber || undefined
        : undefined,
      guestNote: operationalFields.has("guest_note")
        ? guestNote || undefined
        : undefined,
    },
  });

  const next = new URLSearchParams({
    demo: "request",
    product: product.id,
    date: booking.serviceDate,
    state: booking.state,
  });

  return redirect(`/bookings?${next.toString()}`);
}

export function meta() {
  return [
    { title: "Đặt dịch vụ | PhuQuocLux" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export default function CheckoutRoute() {
  const {
    product,
    offer,
    quote,
    selectionQuery,
    quoteReceipt,
    requestId,
  } = useLoaderData<typeof loader>();
  const expiresAt = new Date(quote.expiresAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <span className="secure-label">Chưa thu tiền</span>
      </header>

      <main className="checkout-main">
        <Link
          className="back-link"
          to={`/product/${product.slug}?${selectionQuery}`}
        >
          ← Quay lại dịch vụ
        </Link>

        <div className="checkout-grid">
          <Form
            className="checkout-form"
            method="post"
            action={`/checkout/${product.slug}?${selectionQuery}`}
          >
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="quoteReceipt" value={quoteReceipt} />

            <section className="checkout-section">
              <p className="section-kicker">NGƯỜI ĐẶT</p>
              <h1>Thông tin liên hệ</h1>
              <p>Không cần tạo tài khoản. JoTrip dùng thông tin này để liên hệ về đặt chỗ.</p>
              <div className="form-grid">
                <label>
                  <span>Họ và tên</span>
                  <input name="name" required autoComplete="name" />
                </label>
                <label>
                  <span>Số điện thoại</span>
                  <input name="phone" required autoComplete="tel" />
                </label>
                <label className="full">
                  <span>Email</span>
                  <input name="email" required type="email" autoComplete="email" />
                </label>
              </div>
            </section>

            <section className="checkout-section">
              <p className="section-kicker">THÔNG TIN SỬ DỤNG</p>
              <h2>Thông tin để phục vụ chuyến đi</h2>
              <div className="form-grid">
                {offer.operationalFields.includes("hotel_or_pickup") ? (
                  <label className="full">
                    <span>Khách sạn / điểm đến / ghi chú đón</span>
                    <input name="usage" autoComplete="off" />
                  </label>
                ) : null}
                {offer.operationalFields.includes("flight_number") ? (
                  <label className="full">
                    <span>Số chuyến bay</span>
                    <input
                      name="flightNumber"
                      placeholder="Ví dụ: VN1825"
                      autoCapitalize="characters"
                      autoComplete="off"
                    />
                  </label>
                ) : null}
                {offer.operationalFields.includes("guest_note") ? (
                  <label className="full">
                    <span>Ghi chú</span>
                    <textarea name="note" rows={4} />
                  </label>
                ) : null}
              </div>
            </section>

            <section className="checkout-section">
              <p className="section-kicker">TRẠNG THÁI</p>
              <h2>Cần xác nhận tình trạng</h2>
              <div className="prototype-warning">
                Bản thử nghiệm hiện chưa nối dữ liệu chỗ trống và giá bán chính thức từ nhà cung cấp.
                Vì vậy hệ thống chỉ nhận yêu cầu, không tự báo “còn chỗ” và không coi giá ước tính là giá thanh toán.
              </div>
            </section>

            <button className="checkout-submit" type="submit">
              Gửi yêu cầu đặt
            </button>
          </Form>

          <aside className="order-summary">
            <p className="section-kicker">TÓM TẮT ĐẶT CHỖ</p>
            <h2>{product.name}</h2>
            <div className="order-meta">
              <div>
                <span>Lựa chọn</span>
                <b>{offer.label}</b>
              </div>
              <div>
                <span>Ngày sử dụng</span>
                <b>{quote.serviceDate}</b>
              </div>
              <div>
                <span>Tổng số khách</span>
                <b>{quote.pax}</b>
              </div>
              {quote.lines.map((line) => (
                <div key={line.code}>
                  <span>
                    {line.label} × {line.quantity}
                  </span>
                  <b>{money(line.total.amount)}</b>
                </div>
              ))}
              <div>
                <span>Tình trạng</span>
                <b>Cần xác nhận</b>
              </div>
            </div>
            <div className="order-line total">
              <span>{quote.priceState === "final" ? "Tổng" : "Giá ước tính"}</span>
              <strong>{money(quote.total.amount)}</strong>
            </div>
            <div className="quote-meta">
              <span>Mã tạm #{quote.id.slice(0, 8)}</span>
              <span>
                {quote.priceState === "final"
                  ? `Giữ giá đến ${expiresAt}`
                  : `Ước tính đến ${expiresAt}`}
              </span>
            </div>
            <div className="support-note">
              <b>JoTrip đứng sau vận hành</b>
              <p>
                JoTrip sẽ kiểm tra lại tình trạng và điều kiện của đúng dịch vụ
                trước khi xác nhận đặt chỗ.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
