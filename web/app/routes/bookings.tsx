import { Link, useSearchParams } from "react-router";
import { Brand } from "../components/Brand";
import { BottomNav } from "../components/BottomNav";
import { getProductById } from "../domain/catalog";

export function meta() {
  return [
    { title: "Đặt chỗ của tôi | PhuQuocLux" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

function userState(value: string | null) {
  if (value === "pending_confirmation") return "Chờ xác nhận";
  if (value === "pending_payment") return "Chờ thanh toán";
  if (value === "confirmed") return "Đã xác nhận";
  return "Đang xử lý";
}

export default function BookingsRoute() {
  const [params] = useSearchParams();
  const demoRequest = params.get("demo") === "request";
  const quoteId = params.get("quote");
  const bookingId = params.get("booking");
  const bookingState = params.get("state");
  const product = getProductById(params.get("product") ?? undefined);

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <Link className="header-link" to="/">Khám phá thêm</Link>
      </header>

      <main className="bookings-main">
        <section className="bookings-intro">
          <p className="eyebrow">ĐẶT CHỖ CỦA TÔI</p>
          <h1>
            Mọi thứ cần cho chuyến đi,
            <br />
            <span>nằm ở đây.</span>
          </h1>
          <p>Voucher, giờ đón, điểm gặp và hỗ trợ sau khi đặt.</p>
        </section>

        {demoRequest ? (
          <>
            <div className="booking-status-banner booking-status-banner--request">
              <span>…</span>
              <div>
                <b>Đã nhận yêu cầu</b>
                <p>
                  Đây là bản thử nghiệm, chưa phải đặt chỗ đã xác nhận và chưa có giao dịch tiền thật.
                  {bookingId ? ` Mã yêu cầu #${bookingId.slice(0, 8)}.` : ""}
                  {quoteId ? ` Mã giá #${quoteId.slice(0, 8)}.` : ""}
                </p>
              </div>
            </div>

            <section className="trip-day">
              <div className="trip-day-head">
                <div>
                  <small>BẢN THỬ NGHIỆM</small>
                  <strong>Yêu cầu vừa gửi</strong>
                </div>
                <span>Phú Quốc</span>
              </div>

              <BookingItem
                type={product?.type === "transfer" ? "XE" : product?.type === "ticket" ? "VÉ" : "TOUR"}
                title={product?.name ?? "Dịch vụ Phú Quốc"}
                copy="JoTrip sẽ kiểm tra tình trạng dịch vụ. Chỉ sau khi có xác nhận thật, đặt chỗ mới chuyển sang trạng thái đã xác nhận."
                status={userState(bookingState)}
              />
            </section>
          </>
        ) : (
          <section className="booking-empty">
            <span>▣</span>
            <h2>Chưa có đặt chỗ</h2>
            <p>
              Khi có đặt chỗ thật, voucher, giờ đón và thông tin sử dụng sẽ xuất hiện tại đây.
            </p>
            <Link to="/">Khám phá dịch vụ</Link>
          </section>
        )}

        <section className="booking-tools">
          <Link to="/map">
            <span>⌖</span>
            <div><b>Mở bản đồ</b><small>Xem dịch vụ quanh bạn</small></div>
          </Link>
          <Link to="/">
            <span>＋</span>
            <div><b>Đặt thêm dịch vụ</b><small>Tour, vé, xe và hơn nữa</small></div>
          </Link>
          <div className="booking-tool-static">
            <span>?</span>
            <div><b>Hỗ trợ JoTrip</b><small>Kênh hỗ trợ sẽ được nối ở bước sau</small></div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function BookingItem({
  type,
  title,
  copy,
  status,
}: {
  type: string;
  title: string;
  copy: string;
  status: string;
}) {
  return (
    <article className="booking-item">
      <div className="booking-time">
        <strong>--:--</strong>
        <span>Chưa có giờ</span>
      </div>
      <div className="booking-item-body">
        <div className="booking-type">{type}</div>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="booking-actions booking-actions--demo">
          <span>Chờ cập nhật</span>
          <span>Chưa có voucher</span>
        </div>
      </div>
      <span className="status-pill">{status}</span>
    </article>
  );
}
