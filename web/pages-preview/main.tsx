import { createRoot } from "react-dom/client";
import {
  createHashRouter,
  Link,
  Outlet,
  RouterProvider,
  useParams,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router";
import HomeRoute, { loader as loadHome } from "../app/routes/home";
import MapRoute, { loader as loadMap } from "../app/routes/map";
import ProductRoute, { loader as loadProduct } from "../app/routes/product";
import TripRoute, { loader as loadTrip } from "../app/routes/trip";
import { Brand } from "../app/components/Brand";
import { BottomNav } from "../app/components/BottomNav";
import { getProductBySlug, money } from "../app/domain/catalog";
import { getOffer, offerSupportsPax } from "../app/domain/offer";
import { priceOffer, unitQuantitiesFromSearch } from "../app/domain/pricing";
import { normalizeServiceDate } from "../app/domain/service-date";
import "../app/styles/app.css";
import "../app/styles/myphuquoc-brand.css";
import "./preview.css";

// Only public domain/UI functions execute in this site. React Router server
// actions, Cloudflare bindings, payments and guest-data collection are absent.
const previewContext = {
  get() {
    return {
      env: {
        COMMERCE_MODE: "prototype",
        MAP_STYLE_URL: "https://tiles.openfreemap.org/styles/liberty",
      },
      requestId: "static-ui-preview",
    };
  },
} as unknown as LoaderFunctionArgs["context"];

function withPreviewContext(
  loader: (args: LoaderFunctionArgs) => Promise<unknown>,
) {
  return (args: LoaderFunctionArgs) => loader({ ...args, context: previewContext });
}

function PreviewLayout() {
  return (
    <>
      <div className="pages-preview-bar" role="note">
        <strong>MY PHU QUOC - XEM THỬ</strong>
        <span>
          Bản xem thử được tạo từ nhánh main. Giá và vị trí phải xác minh trước khi bán.
          Thời tiết, xác nhận đặt chỗ và thanh toán chưa kết nối.
        </span>
        <a href="https://github.com/kenzuko/phuquoclux-app/tree/main" target="_blank" rel="noreferrer">
          Xem mã
        </a>
      </div>
      <Outlet />
    </>
  );
}

function PreviewCheckout() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const product = getProductBySlug(slug);
  if (!product) return <NotFound />;
  const paxRaw = Number(params.get("pax")) || 2;
  const pax = Math.max(1, Math.min(20, Math.floor(paxRaw)));
  const requestedOffer = params.get("offer") ?? params.get("option") ?? undefined;
  const offer = getOffer(product.id, requestedOffer);
  const validParty = offer ? offerSupportsPax(offer, pax) : false;
  let illustration: string | null = null;

  if (offer && validParty) {
    const units = unitQuantitiesFromSearch(offer, params, pax);
    const priced = priceOffer(offer, pax, units);
    illustration = money(priced.totalAmount);
  }

  const date = normalizeServiceDate(params.get("date") ?? undefined);
  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <span className="secure-label">Không thu tiền</span>
      </header>
      <main id="main-content" className="checkout-main pages-checkout">
        <Link
          to={`/product/${product.slug}?${params.toString()}`}
          className="back-link"
        >
          ← Quay lại dịch vụ
        </Link>
        <section className="pages-checkout-card">
          <p className="eyebrow">BẢN XEM THỬ</p>
          <h1>Kiểm tra lựa chọn</h1>
          <p>
            Trang này chỉ để đánh giá cách chọn sản phẩm trên giao diện mới.
            Không thu thập thông tin khách, không gửi yêu cầu đặt chỗ hoặc xác nhận tình trạng.
          </p>
          <dl>
            <div><dt>Dịch vụ</dt><dd>{product.name}</dd></div>
            <div><dt>Lựa chọn</dt><dd>{offer?.label ?? "Chưa có lựa chọn hợp lệ"}</dd></div>
            <div><dt>Ngày sử dụng</dt><dd>{date}</dd></div>
            <div><dt>Số khách</dt><dd>{pax}</dd></div>
            <div>
              <dt>Giá mô phỏng</dt>
              <dd>{illustration ? `${illustration} - chỉ tham khảo` : "Cần điều chỉnh lựa chọn"}</dd>
            </div>
          </dl>
          <div className="pages-checkout-disabled" role="status">
            Chức năng gửi đơn đã khóa trên GitHub Pages. Chỉ khi có dữ liệu
            nhà cung cấp, giá thật, backend và quy trình thanh toán mới mở đặt chỗ.
          </div>
          <Link className="pages-checkout-back" to="/map">Tiếp tục khám phá</Link>
        </section>
      </main>
    </div>
  );
}

function PreviewBookings() {
  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <Link className="header-link" to="/">Khám phá thêm</Link>
      </header>
      <main id="main-content" className="bookings-main">
        <section className="bookings-intro">
          <p className="eyebrow">ĐẶT CHỖ</p>
          <h1>Đặt chỗ của tôi</h1>
          <p>Khi hệ thống vận hành thật, voucher, giờ đón và thay đổi đặt chỗ sẽ nằm ở đây.</p>
        </section>
        <section className="booking-empty">
          <span>▣</span>
          <h2>Chưa có đặt chỗ</h2>
          <p>
            Đây là GitHub Pages preview. Không có tài khoản, booking, trạng thái
            xác nhận hay dữ liệu khách hàng giả.
          </p>
          <Link to="/map">Khám phá dịch vụ</Link>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function NotFound() {
  return (
    <main className="pages-error" id="main-content">
      <h1>Trang này chưa có trong bản xem thử</h1>
      <p>Quay lại bản đồ để tiếp tục khám phá Phú Quốc.</p>
      <Link to="/map">Mở bản đồ</Link>
    </main>
  );
}

const router = createHashRouter([
  {
    path: "/",
    element: <PreviewLayout />,
    children: [
      { index: true, loader: withPreviewContext(loadHome), element: <HomeRoute /> },
      { path: "map", loader: withPreviewContext(loadMap), element: <MapRoute /> },
      { path: "product/:slug", loader: withPreviewContext(loadProduct), element: <ProductRoute /> },
      { path: "checkout/:slug", element: <PreviewCheckout /> },
      { path: "trip", loader: loadTrip, element: <TripRoute /> },
      { path: "bookings", element: <PreviewBookings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const host = document.getElementById("root");
if (!host) throw new Error("Missing React preview root");
createRoot(host).render(<RouterProvider router={router} />);
