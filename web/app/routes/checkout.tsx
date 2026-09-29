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

  const selection = parseSelection(request);
  const quote = await createPrototypeQuote({
    type,
    offerId: selection.offerId,
    pax: selection.pax,
    serviceDate: selection.serviceDate,
  });
  assertQuoteBookable(quote);

  const form = await request.formData();
  const requestId = String(form.get("requestId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const hotelOrPickup = String(form.get("usage") ?? "").trim();
  const guestNote = String(form.get("note") ?? "").trim();

  if (!requestId || !name || !phone || !email) {
    return new Response("Missing required booking fields", { status: 400 });
  }

  const booking = createPrototypeBookingRequest({
    requestId,
    quote,
    contact: { name, phone, email },
    operationalData: {
      hotelOrPickup: hotelOrPickup || undefined,
      guestNote: guestNote || undefined,
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
  const { product, offer, pax, quote, requestId } =
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
                <label className="full">
                  <span>Khách sạn / điểm đến / ghi chú đón</span>
                  <input name="usage" />
                </label>
                <label className="full">
                  <span>Ghi chú</span>
                  <textarea name="note" rows={4} />
                </label>
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
