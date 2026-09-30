import type { Booking, BookingState } from "./commerce";
import {
  getProductById,
  type ProductType,
} from "./catalog";

export type TripItem = {
  bookingId: string;
  productId: Booking["productId"];
  productType: ProductType;
  title: string;
  serviceDate: string;
  state: BookingState;
  voucherRef?: string;
};

export type TripDay = {
  date: string;
  items: TripItem[];
};

export type TripProjection = {
  days: TripDay[];
  bookingCount: number;
};

const visibleStates = new Set<BookingState>([
  "pending_payment",
  "paid",
  "pending_confirmation",
  "confirmed",
  "fulfilled",
  "cancel_requested",
]);

export function buildTripProjection(
  bookings: readonly Booking[],
): TripProjection {
  const grouped = new Map<string, TripItem[]>();

  for (const booking of bookings) {
    if (!visibleStates.has(booking.state)) continue;

    const product = getProductById(booking.productId);
    if (!product) continue;

    const item: TripItem = {
      bookingId: booking.id,
      productId: booking.productId,
      productType: product.type,
      title: product.name,
      serviceDate: booking.serviceDate,
      state: booking.state,
      voucherRef: booking.voucherRef,
    };

    const items = grouped.get(booking.serviceDate) ?? [];
    items.push(item);
    grouped.set(booking.serviceDate, items);
  }

  const days = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => a.title.localeCompare(b.title, "vi")),
    }));

  return {
    days,
    bookingCount: days.reduce(
      (sum, day) => sum + day.items.length,
      0,
    ),
  };
}
