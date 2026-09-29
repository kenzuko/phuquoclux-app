import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import "./cloudflare-context";
import "./styles/app.css";

export function meta() {
  return [
    { title: "PhuQuocLux | Phú Quốc" },
    {
      name: "description",
      content:
        "Khám phá và đặt dịch vụ du lịch Phú Quốc trên bản đồ, vận hành bởi JoTrip.",
    },
  ];
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f7f9f6" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const title =
    status === 404
      ? "Không tìm thấy trang này"
      : status === 503
        ? "Dịch vụ này chưa sẵn sàng"
        : "Có lỗi khi tải trang";
  const copy =
    status === 404
      ? "Liên kết có thể đã thay đổi hoặc nội dung chưa được mở."
      : status === 503
        ? "PhuQuocLux đang giữ an toàn giao dịch thay vì tiếp tục với dữ liệu chưa đủ."
        : "Bạn có thể quay lại trang chính và thử lại.";

  return (
    <main className="error-page">
      <div className="error-card">
        <span>{status}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
        <div>
          <Link to="/">Về trang chính</Link>
          <Link to="/map">Mở bản đồ</Link>
        </div>
      </div>
    </main>
  );
}
