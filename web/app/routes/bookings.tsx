import { Link } from "react-router";
import { Brand } from "../components/Brand";
import { BottomNav } from "../components/BottomNav";

export function meta() {
  return [
    { title: "Đặt chỗ của tôi | PhuQuocLux" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

/**
 * Until PostgreSQL, idempotency and guest booking access are wired,
 * the server cannot truthfully display a guest booking. URL query params
 * are never a booking receipt and must not forge a confirmation banner.
 */
export default function BookingsRoute() {
  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <Link className="header-link" to="/">Khám phá thêm</Link>
      </header>

      <main id="main-content" className="bookings-main">
        <section className="bookings-intro">
          <p className="eyebrow">ĐẶT CHỖ CỦA TÔI</p>
          <h1>
            Mọi thứ cần cho chuyến đi,
            <br />
            <span>nằm ở đây.</span>
          </h1>
          <p>
            Khi đã có hệ thống đặt chỗ thật, voucher, giờ đón và hỗ trợ
            sau khi đặt sẽ nằm trong cùng một nơi.
          </p>
        </section>

        <section className="booking-empty">
          <span>▣</span>
          <h2>Chưa có đặt chỗ</h2>
          <p>
            PhuQuocLux hiện đang thử nghiệm giao diện. Hệ thống chưa nhận
            và chưa lưu yêu cầu đặt chỗ nên không có booking hay voucher
            để hiển thị. URL từ bản demo cũ không phải xác nhận đặt chỗ.
          </p>
          <Link to="/">Khám phá dịch vụ</Link>
        </section>

        <section className="booking-tools">
          <Link to="/map">
            <span>⌖</span>
            <div>
              <b>Mở bản đồ</b>
              <small>Xem dịch vụ quanh bạn</small>
            </div>
          </Link>
          <Link to="/">
            <span>＋</span>
            <div>
              <b>Khám phá thêm</b>
              <small>Tour, vé, xe và hơn nữa</small>
            </div>
          </Link>
          <div className="booking-tool-static">
            <span>?</span>
            <div>
              <b>Hỗ trợ JoTrip</b>
              <small>Kênh hỗ trợ sẽ được nối khi booking mở</small>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
