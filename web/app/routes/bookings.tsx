import { Link, useSearchParams } from "react-router";
import { Brand } from "../components/Brand";
import { BottomNav } from "../components/BottomNav";

export default function BookingsRoute() {
  const [params] = useSearchParams();
  const demoRequest = params.get("demo") === "request";
  const quoteId = params.get("quote");
  const bookingId = params.get("booking");
  const bookingState = params.get("state");

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
          <div className="booking-status-banner booking-status-banner--request">
            <span>…</span>
            <div>
              <b>Đã nhận yêu cầu</b>
              <p>
                Đây là bản thử nghiệm, chưa phải đặt chỗ đã xác nhận và chưa có giao dịch tiền thật.
                {bookingId ? ` Mã yêu cầu #${bookingId.slice(0, 8)}.` : ""}
                {quoteId ? ` Mã giá #${quoteId.slice(0, 8)}.` : ""}
                {bookingState ? ` Trạng thái hệ thống: ${bookingState}.` : ""}
              </p>
            </div>
          </div>
        ) : null}

        <section className="trip-day">
          <div className="trip-day-head">
            <div><small>BẢN THỬ NGHIỆM</small><strong>Sau khi đặt</strong></div>
            <span>Phú Quốc</span>
          </div>

          {demoRequest ? (
            <BookingItem
              time="--:--"
              type="YÊU CẦU"
              title="Yêu cầu đang chờ xác nhận"
              copy="JoTrip sẽ kiểm tra tình trạng dịch vụ. Chỉ sau khi có xác nhận thật, đặt chỗ mới chuyển sang trạng thái đã xác nhận."
              status="Chờ xác nhận"
            />
          ) : null}

          <BookingItem
            time="08:00"
            type="TRANSFER"
            title="Xe riêng từ khách sạn"
            copy="Điểm đón sẽ hiển thị sau khi đặt chỗ thực tế được xác nhận."
            status="Ví dụ"
          />
          <BookingItem
            time="09:00"
            type="EXPERIENCE"
            title="Tour 3 đảo bằng cano"
            copy="Voucher và hướng dẫn sử dụng sẽ nằm trực tiếp trong đặt chỗ đã xác nhận."
            status="Ví dụ đã xác nhận"
            confirmed
          />
        </section>

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
  time,
  type,
  title,
  copy,
  status,
  confirmed = false,
}: {
  time: string;
  type: string;
  title: string;
  copy: string;
  status: string;
  confirmed?: boolean;
}) {
  return (
    <article className="booking-item">
      <div className="booking-time"><strong>{time}</strong><span>Giờ</span></div>
      <div className="booking-item-body">
        <div className="booking-type">{type}</div>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="booking-actions booking-actions--demo">
          <span>{confirmed ? "Voucher demo" : "Trạng thái demo"}</span>
          <span>Hỗ trợ sẽ nối sau</span>
        </div>
      </div>
      <span className={confirmed ? "status-pill confirmed" : "status-pill"}>{status}</span>
    </article>
  );
}
