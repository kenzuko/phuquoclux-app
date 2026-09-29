import { Link, useSearchParams } from "react-router";
import { Brand } from "../components/Brand";

export default function BookingsRoute() {
  const [params] = useSearchParams();
  const demoConfirmed = params.get("demo") === "confirmed";

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

        {demoConfirmed ? (
          <div className="booking-status-banner">
            <span>✓</span>
            <div><b>Prototype booking đã được tạo</b><p>Chưa có giao dịch tiền thật.</p></div>
          </div>
        ) : null}

        <section className="trip-day">
          <div className="trip-day-head">
            <div><small>12 OCT</small><strong>Thứ Hai</strong></div>
            <span>Phú Quốc</span>
          </div>

          <BookingItem
            time="08:00"
            type="TRANSFER"
            title="Xe riêng từ khách sạn"
            copy="Điểm đón sẽ hiển thị sau khi booking được xác nhận."
            status="Sắp tới"
          />
          <BookingItem
            time="09:00"
            type="EXPERIENCE"
            title="Tour 3 đảo bằng cano"
            copy="Voucher và thông tin vận hành nằm trực tiếp trong booking."
            status="Đã xác nhận"
            confirmed
          />
        </section>

        <section className="booking-tools">
          <Link to="/"><span>⌖</span><div><b>Mở bản đồ</b><small>Xem dịch vụ quanh bạn</small></div></Link>
          <Link to="/"><span>＋</span><div><b>Đặt thêm dịch vụ</b><small>Tour, vé, xe và hơn nữa</small></div></Link>
          <button type="button"><span>?</span><div><b>Cần hỗ trợ?</b><small>JoTrip hỗ trợ booking của bạn</small></div></button>
        </section>
      </main>
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
        <div className="booking-actions">
          <button type="button">{confirmed ? "Mở voucher" : "Xem điểm đón"}</button>
          <button type="button">Liên hệ hỗ trợ</button>
        </div>
      </div>
      <span className={confirmed ? "status-pill confirmed" : "status-pill"}>{status}</span>
    </article>
  );
}
