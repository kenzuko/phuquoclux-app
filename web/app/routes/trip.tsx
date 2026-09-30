import {
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import { BottomNav } from "../components/BottomNav";
import { Brand } from "../components/Brand";
import { mapUrl, tripIntentFromUrl } from "../domain/trip-intent";

export async function loader({ request }: LoaderFunctionArgs) {
  return {
    intent: tripIntentFromUrl(new URL(request.url)),
  };
}

export function meta() {
  return [
    { title: "Hành trình của tôi | PhuQuocLux" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export default function TripRoute() {
  const { intent } = useLoaderData<typeof loader>();

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <Link className="header-link" to="/bookings">
          Đặt chỗ
        </Link>
      </header>

      <main id="main-content" className="bookings-main">
        <section className="bookings-intro">
          <p className="eyebrow">HÀNH TRÌNH</p>
          <h1>
            Gom các đặt chỗ,
            <br />
            <span>thành một chuyến đi.</span>
          </h1>
          <p>
            Hành trình sẽ tự sắp xếp dịch vụ đã xác nhận theo ngày và giờ.
          </p>
        </section>

        <section className="booking-empty trip-empty">
          <span>≋</span>
          <h2>Chưa có hành trình</h2>
          <p>
            Khi bạn có đặt chỗ được xác nhận, PhuQuocLux sẽ gom giờ đón,
            voucher và dịch vụ trong ngày vào đây. Không cần tạo lịch thủ công.
          </p>
          <div className="trip-empty-actions">
            <Link to={mapUrl(intent)}>
              Khám phá trên bản đồ
            </Link>
            <Link className="secondary" to="/bookings">
              Xem đặt chỗ
            </Link>
          </div>
        </section>
      </main>

      <BottomNav intent={intent} />
    </div>
  );
}
