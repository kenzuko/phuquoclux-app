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
import { createPrototypeQuote } from "../services/quote.server";

function parseSelection(request: Request) {
  const url = new URL(request.url);
  return {
    pax: Math.max(1, Math.min(20, Number(url.searchParams.get("pax")) || 2)),
    optionId: url.searchParams.get("option") ?? undefined,
    serviceDate: url.searchParams.get("date") ?? undefined,
  };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const type = params.type;
  if (!isProductType(type)) throw new Response("Not found", { status: 404 });

  const selection = parseSelection(request);
  const product = products[type];
  const quote = await createPrototypeQuote({
    type,
    optionId: selection.optionId,
    pax: selection.pax,
    serviceDate: selection.serviceDate,
  });
  const option =
    product.options.find((item) => item.id === quote.optionId) ??
    product.options[0];

  return { product, option, pax: selection.pax, quote };
}

export async function action({ params, request }: ActionFunctionArgs) {
  const type = params.type;
  if (!isProductType(type)) throw new Response("Not found", { status: 404 });

  const selection = parseSelection(request);
  const quote = await createPrototypeQuote({
    type,
    optionId: selection.optionId,
    pax: selection.pax,
    serviceDate: selection.serviceDate,
  });
  assertQuoteBookable(quote);

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!name || !phone || !email) {
    return new Response("Missing required contact fields", { status: 400 });
  }

  const next = new URLSearchParams({
    demo: "request",
    type,
    quote: quote.id,
    state: quote.availabilitySnapshot.state,
  });

  return redirect(`/bookings?${next.toString()}`);
}

export default function CheckoutRoute() {
  const { product, option, pax, quote } = useLoaderData<typeof loader>();
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
          to={`/product/${product.type}?pax=${pax}&option=${option.id}`}
        >
          ← Quay lại dịch vụ
        </Link>

        <div className="checkout-grid">
          <Form className="checkout-form" method="post">
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
              <div><span>Lựa chọn</span><b>{option.label}</b></div>
              <div><span>Ngày sử dụng</span><b>{quote.serviceDate}</b></div>
              <div><span>Số khách</span><b>{pax}</b></div>
              <div><span>Tình trạng</span><b>Cần xác nhận</b></div>
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
                và chính sách của offer cho phép.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
