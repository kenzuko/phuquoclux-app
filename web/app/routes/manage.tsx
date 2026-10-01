import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Brand } from "../components/Brand";

type ExchangeState = "working" | "unavailable" | "invalid";

export function meta() {
  return [
    { title: "Mở đặt chỗ | PhuQuocLux" },
    { name: "robots", content: "noindex,nofollow" },
    { name: "referrer", content: "no-referrer" },
  ];
}

export default function ManageBookingExchangePage() {
  const [state, setState] = useState<ExchangeState>("working");

  useEffect(() => {
    let cancelled = false;

    async function exchange() {
      const rawToken = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";

      // Remove the bearer capability from the current history entry before any
      // network request. Fragments are never sent to the server, but this also
      // keeps the token out of the visible URL after hydration.
      window.history.replaceState(null, "", "/manage");

      if (!/^[0-9a-f]{64}$/.test(rawToken)) {
        if (!cancelled) setState("invalid");
        return;
      }

      try {
        const response = await fetch("/manage/exchange", {
          method: "POST",
          credentials: "same-origin",
          redirect: "error",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({ token: rawToken }),
        });

        if (response.status === 204) {
          // The HttpOnly cookie has been stored by the browser. Replace rather
          // than push so /manage is not kept as a useful history destination.
          window.location.replace("/bookings");
          return;
        }

        if (!cancelled) setState("unavailable");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    }

    void exchange();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="topbar topbar--border">
        <Brand />
        <span className="secure-label">Liên kết bảo mật</span>
      </header>
      <main id="main-content" className="bookings-main">
        <section className="booking-empty" aria-live="polite">
          <span>{state === "working" ? "…" : "!"}</span>
          {state === "working" ? (
            <>
              <h1>Đang mở đặt chỗ của bạn</h1>
              <p>Liên kết đang được kiểm tra. Trang sẽ tự chuyển tiếp khi hợp lệ.</p>
            </>
          ) : (
            <>
              <h1>Liên kết chưa thể sử dụng</h1>
              <p>
                Liên kết có thể đã hết hạn, không hợp lệ hoặc chức năng quản lý
                đặt chỗ chưa được mở. Không có thông tin đặt chỗ nào được hiển thị.
              </p>
              <Link to="/">Về PhuQuocLux</Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
