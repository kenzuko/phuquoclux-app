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
              <b>Đã nhận yêu cầu prototype</b>
              <p>
                Chưa phải booking xác nhận và chưa có giao dịch tiền thật.
                {bookingId ? ` Request #${bookingId.slice(0, 8)}.` : ""}
                {quoteId ? ` Quote #${quoteId.slice(0, 8)}.` : ""}
                {bookingState ? ` State: ${bookingState}.` : ""}
              </p>
            </div>
          </div>
        ) : null}

        <section className="trip-day">
          <div className="trip-day-head">
            <div><small>DEMO</small><strong>Luồng sau mua</strong></div>
            <span>Phú Quốc</span>
          </div>

          {demoRequest ? (
            <BookingItem
              time="--:--"
              type="REQUEST"
              title="Yêu cầu đang chờ xác nhận"
              copy="Availability provider chưa được nối. Khi có xác nhận thật, booking mới chuyển sang trạng thái Confirmed."
              status="Chờ xác nhận"
            />
          ) : null}

          <BookingItem
            time="08:00"
            type="TRANSFER"
            title="Ví dụ: Xe riêng từ khách sạn"
            copy="Điểm đón sẽ hiển thị sau khi booking thực tế được xác nhận."
            status="Ví dụ"
          />
          <BookingItem
            time="09:00"
            type="EXPERIENCE"
            title="Ví dụ: Tour 3 đảo bằng cano"
            copy="Voucher và thông tin vận hành sẽ nằm trực tiếp trong booking đã xác nhận."
            status="Demo confirmed"
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
          <button type="button">
            <span>?</span>
            <div><b>Cần hỗ trợ?</b><small>JoTrip hỗ trợ booking của bạn</small></div>
          </button>
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
