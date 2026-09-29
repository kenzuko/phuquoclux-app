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

export async function loader({ params, request }: LoaderFunctionArgs) {
  if (!isProductType(params.type)) throw new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const pax = Math.max(1, Number(url.searchParams.get("pax")) || 2);
  const product = products[params.type];
  const option =
    product.options.find((item) => item.id === url.searchParams.get("option")) ??
    product.options[0];
  const quantity = product.type === "transfer" ? 1 : pax;
  const total = product.fromPrice * option.multiplier * quantity;

  return { product, option, pax, total };
}

export async function action({ params, request }: ActionFunctionArgs) {
  if (!isProductType(params.type)) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!name || !phone || !email) {
    return new Response("Missing required contact fields", { status: 400 });
  }

  return redirect(`/bookings?demo=confirmed&type=${params.type}`);
}

export default function CheckoutRoute() {
  const { product, option, pax, total } = useLoaderData<typeof loader>();

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <span className="secure-label">Checkout prototype</span>
      </header>

      <main className="checkout-main">
        <Link className="back-link" to={`/product/${product.type}`}>← Quay lại dịch vụ</Link>

        <div className="checkout-grid">
          <Form className="checkout-form" method="post">
            <section className="checkout-section">
              <p className="section-kicker">NGƯỜI ĐẶT</p>
              <h1>Thông tin liên hệ</h1>
              <p>Mass checkout: không bắt buộc tạo tài khoản trước.</p>
              <div className="form-grid">
                <label><span>Họ và tên</span><input name="name" required autoComplete="name" /></label>
                <label><span>Số điện thoại</span><input name="phone" required autoComplete="tel" /></label>
                <label className="full"><span>Email</span><input name="email" required type="email" autoComplete="email" /></label>
              </div>
            </section>

            <section className="checkout-section">
              <p className="section-kicker">THÔNG TIN SỬ DỤNG</p>
              <h2>Thông tin vận hành</h2>
              <div className="form-grid">
                <label className="full"><span>Khách sạn / điểm đến / ghi chú đón</span><input name="usage" /></label>
                <label className="full"><span>Ghi chú</span><textarea name="note" rows={4} /></label>
              </div>
            </section>

            <section className="checkout-section">
              <p className="section-kicker">THANH TOÁN</p>
              <h2>Prototype - chưa thu tiền</h2>
              <div className="prototype-warning">
                Flow này chỉ xác minh UX và action/redirect của React Router.
                Payment provider sẽ được nối sau Quote + Availability.
              </div>
            </section>

            <button className="checkout-submit" type="submit">Xác nhận prototype</button>
          </Form>

          <aside className="order-summary">
            <p className="section-kicker">ĐƠN CỦA BẠN</p>
            <h2>{product.name}</h2>
            <div className="order-meta">
              <div><span>Lựa chọn</span><b>{option.label}</b></div>
              <div><span>Số khách</span><b>{pax}</b></div>
            </div>
            <div className="order-line total"><span>Tổng</span><strong>{money(total)}</strong></div>
            <div className="support-note">
              <b>JoTrip đứng sau vận hành</b>
              <p>Booking, voucher và hỗ trợ sau mua được gom về một chỗ.</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
