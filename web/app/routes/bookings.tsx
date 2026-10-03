import {
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import { Brand } from "../components/Brand";
import { BottomNav } from "../components/BottomNav";
import { cloudflareRequestContext } from "../cloudflare-context";
import {
  getProductById,
  money,
} from "../domain/catalog";
import type {
  BookingState,
  PaymentStatus,
} from "../domain/commerce";
import { findOffer } from "../domain/offer";
import { formatServiceDate } from "../domain/service-date";
import {
  readManageBookingSessionCookie,
} from "../repositories/postgres-booking-session.server";
import {
  readManagedBookingBySession,
} from "../repositories/postgres-booking-read.server";
import {
  manageBookingExchangeConfigured,
} from "../services/manage-booking-exchange.server";

export function meta() {
  return [
    { title: "Đặt chỗ của tôi | My Phu Quoc" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export async function loader({
  request,
  context,
}: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareRequestContext);
  const rawSession = readManageBookingSessionCookie(
    request.headers.get("cookie"),
  );

  if (!rawSession) {
    return {
      access: "none" as const,
      booking: null,
    };
  }

  if (
    !manageBookingExchangeConfigured(runtime.env) ||
    !runtime.manageBookingDatabase
  ) {
    return {
      access: "runtime_unavailable" as const,
      booking: null,
    };
  }

  try {
    const booking = await readManagedBookingBySession(
      runtime.manageBookingDatabase,
      rawSession,
    );
    if (!booking) {
      return {
        access: "invalid_or_expired" as const,
        booking: null,
      };
    }

    return {
      access: "ok" as const,
      booking,
    };
  } catch {
    // Never expose database, session or record-validation detail to a guest.
    return {
      access: "runtime_unavailable" as const,
      booking: null,
    };
  }
}

function bookingStateLabel(state: BookingState) {
  const labels: Record<BookingState, string> = {
    draft: "Đang tạo",
    pending_payment: "Chờ thanh toán",
    paid: "Đã thanh toán",
    pending_confirmation: "Chờ JoTrip xác nhận",
    confirmed: "Đã xác nhận",
    fulfilled: "Đã hoàn tất",
    cancel_requested: "Đang yêu cầu huỷ",
    cancelled: "Đã huỷ",
    refund_pending: "Đang hoàn tiền",
    refunded: "Đã hoàn tiền",
    failed: "Không hoàn tất",
    expired: "Đã hết hạn",
  };
  return labels[state];
}

function paymentLabel(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    unpaid: "Chưa thu tiền",
    authorized: "Đã giữ tiền",
    paid: "Đã thanh toán",
    partially_refunded: "Đã hoàn một phần",
    refunded: "Đã hoàn tiền",
    failed: "Thanh toán không thành công",
  };
  return labels[status];
}

export default function BookingsRoute() {
  const { access, booking } = useLoaderData<typeof loader>();

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
          <p>Trạng thái, thông tin sử dụng và voucher của đúng đặt chỗ đã được xác thực.</p>
        </section>

        {access === "ok" && booking ? (
          <ManagedBookingCard booking={booking} />
        ) : access === "invalid_or_expired" ? (
          <section className="booking-empty">
            <span>!</span>
            <h2>Phiên quản lý đã hết hạn</h2>
            <p>
              Liên kết hoặc phiên quản lý đặt chỗ không còn hiệu lực. Không có
              thông tin đặt chỗ nào được hiển thị.
            </p>
            <Link to="/">Về My Phu Quoc</Link>
          </section>
        ) : access === "runtime_unavailable" ? (
          <section className="booking-empty">
            <span>…</span>
            <h2>Chưa thể mở đặt chỗ lúc này</h2>
            <p>
              Hệ thống không thể xác thực phiên quản lý hiện tại. Không có
              thông tin đặt chỗ nào được hiển thị.
            </p>
            <Link to="/">Về My Phu Quoc</Link>
          </section>
        ) : (
          <section className="booking-empty">
            <span>▣</span>
            <h2>Chưa có đặt chỗ</h2>
            <p>
              Khi có đặt chỗ thật và một phiên quản lý hợp lệ, trạng thái,
              voucher và thông tin sử dụng sẽ xuất hiện tại đây. Tham số URL
              không thể tạo hoặc xác nhận một booking.
            </p>
            <Link to="/">Khám phá dịch vụ</Link>
          </section>
        )}

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

function ManagedBookingCard({
  booking,
}: {
  booking: NonNullable<Awaited<ReturnType<typeof loader>>["booking"]>;
}) {
  const product = getProductById(booking.productId);
  const offer = product
    ? findOffer(product.id, booking.offerId)
    : undefined;

  return (
    <section className="trip-day">
      <div className="trip-day-head">
        <div>
          <small>{formatServiceDate(booking.serviceDate)}</small>
          <strong>{product?.name ?? "Dịch vụ Phú Quốc"}</strong>
        </div>
        <span>{bookingStateLabel(booking.state)}</span>
      </div>

      <article className="booking-item">
        <div className="booking-time">
          <strong>{booking.pax}</strong>
          <span>khách</span>
        </div>
        <div className="booking-item-body">
          <div className="booking-type">
            {product?.type === "transfer"
              ? "XE"
              : product?.type === "ticket"
                ? "VÉ"
                : "TOUR"}
          </div>
          <h2>{offer?.label ?? product?.name ?? "Dịch vụ Phú Quốc"}</h2>
          <p>
            {booking.priceState === "estimated"
              ? "Giá đang lưu vẫn là giá tham khảo và cần được xác nhận lại."
              : "Giá của đặt chỗ đã được lưu trong hệ thống."}
          </p>

          <div className="order-meta">
            <div>
              <span>
                {booking.priceState === "estimated"
                  ? "Giá tham khảo"
                  : "Tổng"}
              </span>
              <b>{money(booking.total.amount)}</b>
            </div>
            <div>
              <span>Thanh toán</span>
              <b>{paymentLabel(booking.paymentStatus)}</b>
            </div>
            {booking.operationalData?.hotelOrPickup ? (
              <div>
                <span>Khách sạn / điểm đón</span>
                <b>{booking.operationalData.hotelOrPickup}</b>
              </div>
            ) : null}
            {booking.operationalData?.flightNumber ? (
              <div>
                <span>Chuyến bay</span>
                <b>{booking.operationalData.flightNumber}</b>
              </div>
            ) : null}
            {booking.operationalData?.luggageCount !== undefined ? (
              <div>
                <span>Hành lý ký gửi</span>
                <b>{booking.operationalData.luggageCount} kiện</b>
              </div>
            ) : null}
          </div>

          {booking.voucherRef ? (
            <div className="booking-actions">
              <span>Voucher</span>
              <span>{booking.voucherRef}</span>
            </div>
          ) : (
            <div className="booking-actions booking-actions--demo">
              <span>Chưa có voucher</span>
            </div>
          )}
        </div>
        <span className="status-pill">{bookingStateLabel(booking.state)}</span>
      </article>
    </section>
  );
}
