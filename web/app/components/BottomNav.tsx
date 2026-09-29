import { NavLink } from "react-router";
import {
  appendTripIntent,
  homeUrl,
  mapUrl,
  type TripIntent,
} from "../domain/trip-intent";

type Item = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

export function BottomNav({ intent }: { intent?: TripIntent }) {
  const homeTo = intent ? homeUrl(intent) : "/";
  const mapTo = intent ? mapUrl(intent) : "/map";
  const tripTo = intent
    ? `/trip?${appendTripIntent(new URLSearchParams(), intent).toString()}`
    : "/trip";

  const items: Item[] = [
    { to: homeTo, label: "Khám phá", icon: "⌂", end: true },
    { to: mapTo, label: "Bản đồ", icon: "⌖" },
    { to: tripTo, label: "Hành trình", icon: "≋" },
    { to: "/bookings", label: "Đặt chỗ", icon: "▣" },
  ];

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
