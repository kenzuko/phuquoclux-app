import {
  Form,
  Link,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import { Brand } from "../components/Brand";
import { isProductType, money, products } from "../domain/catalog";
import { assertQuoteBookable } from "../domain/commerce";
import { getOffer } from "../domain/offer";
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

function parseSelection(request: Request) {
  const url = new URL(request.url);
  return {
    pax: Math.max(1, Math.min(20, Number(url.searchParams.get("pax")) || 2)),
    offerId:
      url.searchParams.get("offer") ??
      url.searchParams.get("option") ??
      undefined,
    serviceDate: url.searchParams.get("date") ?? undefined,
  };
}

export async function loader({
  params,
  request,
  context,
}: LoaderFunctionArgs) {
  const type = params.type;
  if (!isProductType(type)) {
    throw new Response("Not found", { status: 404 });
  }

  assertPrototypeCommerce(getCommerceMode(context.cloudflare.env));

  const selection = parseSelection(request);
  const product = products[type];
  const quote = await createPrototypeQuote({
    type,
    offerId: selection.offerId,
    pax: selection.pax,
    serviceDate: selection.serviceDate,
    requestId: context.cloudflare.requestId,
  });
  const offer = getOffer(type, quote.offerId);

  if (!offer) {
    throw new Response("Offer unavailable", { status: 503 });
  }

  return {
    product,
    offer,
    pax: selection.pax,
    quote,
    quoteReceipt: serializePrototypeQuoteReceipt(quote),
    requestId: crypto.randomUUID(),
  };
}

export async function action({
  params,
  request,
  context,
}: ActionFunctionArgs) {
  const type = params.type;
  if (!isProductType(type)) {
    throw new Response("Not found", { status: 404 });
  }

  assertPrototypeCommerce(getCommerceMode(context.cloudflare.env));
  assertSameOriginMutation(request);

  const selection = parseSelection(request);
  const form = await request.formData();
  const requestId = readUuid(form, "requestId");
  const receipt = parsePrototypeQuoteReceipt(
    readText(form, "quoteReceipt", { required: true, maxLength: 1600 }),
  );

  const freshQuote = await createPrototypeQuote({
    type,
    offerId: selection.offerId,
    pax: selection.pax,
    serviceDate: selection.serviceDate,
    requestId: context.cloudflare.requestId,
  });
  const quote = reconcilePrototypeQuote(receipt, freshQuote);
  assertQuoteBookable(quote);

  const offer = getOffer(type, quote.offerId);
  if (!offer) {
    throw new Response("Offer unavailable", { status: 503 });
  }

  const operationalFields = new Set(offer.operationalFields);
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
    type,
    quote: quote.id,
    booking: booking.id,
    state: booking.state,
  });

  return redirect(`/bookings?${next.toString()}`);
}

export default function CheckoutRoute() {
  const { product, offer, pax, quote, quoteReceipt, requestId } =
    useLoaderData<typeof loader>();
  const expiresAt = new Date(quote.expiresAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <span className="secure-label">Checkout prototype</span>
      </header>

      <main className="checkout-main">
        <Link
          className="back-link"
          to={`/product/${product.type}?pax=${pax}&offer=${encodeURIComponent(
            offer.id,
          )}&date=${quote.serviceDate}`}
        >
          ← Quay lại dịch vụ
        </Link>

        <div className="checkout-grid">
          <Form
            className="checkout-form"
            method="post"
            action={`/checkout/${product.type}?pax=${pax}&offer=${encodeURIComponent(
              offer.id,
            )}&date=${quote.serviceDate}`}
          >
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="quoteReceipt" value={quoteReceipt} />

            <section className="checkout-section">
              <p className="section-kicker">NGƯỜI ĐẶT</p>
              <h1>Thông tin liên hệ</h1>
              <p>Mass checkout: không bắt buộc tạo tài khoản trước.</p>
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
              <h2>Thông tin vận hành</h2>
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
                Prototype chưa nối inventory nhà cung cấp nên Quote đang ở trạng thái
                yêu cầu xác nhận. Không hiển thị “còn chỗ” khi chưa có dữ liệu thật.
              </div>
            </section>

            <button className="checkout-submit" type="submit">
              Gửi yêu cầu đặt
            </button>
          </Form>

          <aside className="order-summary">
            <p className="section-kicker">QUOTE</p>
            <h2>{product.name}</h2>
            <div className="order-meta">
              <div>
                <span>Offer</span>
                <b>{offer.label}</b>
              </div>
              <div>
                <span>Ngày sử dụng</span>
                <b>{quote.serviceDate}</b>
              </div>
              <div>
                <span>Số khách</span>
                <b>{pax}</b>
              </div>
              <div>
                <span>Tình trạng</span>
                <b>Cần xác nhận</b>
              </div>
            </div>
            <div className="order-line total">
              <span>Tổng theo Quote</span>
              <strong>{money(quote.total.amount)}</strong>
            </div>
            <div className="quote-meta">
              <span>Quote #{quote.id.slice(0, 8)}</span>
              <span>Giữ giá prototype đến {expiresAt}</span>
            </div>
            <div className="support-note">
              <b>JoTrip đứng sau vận hành</b>
              <p>
                Sau khi provider được nối, Quote sẽ chỉ đi tiếp khi Availability
                và policy của đúng Offer cho phép.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
