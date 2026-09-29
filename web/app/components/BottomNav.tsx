import { NavLink } from "react-router";

const items = [
  { to: "/", label: "Khám phá", icon: "⌂", end: true },
  { to: "/map", label: "Bản đồ", icon: "⌖" },
  { to: "/bookings", label: "Đặt chỗ", icon: "▣" },
  { to: "/?saved=1", label: "Đã lưu", icon: "♡" },
  { to: "/?me=1", label: "Tôi", icon: "☺" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính">
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "is-active" : undefined)}
        >
          <span>{item.icon}</span>
          <b>{item.label}</b>
        </NavLink>
      ))}
    </nav>
  );
}
