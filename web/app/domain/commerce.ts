import type { ProductType } from "./catalog";

export type Currency = "VND";

export type Money = {
  amount: number;
  currency: Currency;
};

export type AvailabilityState =
  | "available"
  | "limited"
  | "request"
  | "sold_out"
  | "unknown";

export type AvailabilityRequest = {
  productId: string;
  offerId: string;
  serviceDate: string;
  pax: number;
};

export type AvailabilityResult = {
  state: AvailabilityState;
  checkedAt: string;
  source: "jotrip" | "supplier" | "provider_api" | "manual" | "cache";
  expiresAt?: string;
  note?: string;
};

export type QuoteLine = {
  code: string;
  label: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
};

export type QuoteStatus = "active" | "expired" | "accepted" | "void";

export type Quote = {
  id: string;
  status: QuoteStatus;
  productType: ProductType;
  productId: string;
  offerId: string;
  serviceDate: string;
  pax: number;
  lines: QuoteLine[];
  total: Money;
  createdAt: string;
  expiresAt: string;
  availabilitySnapshot: AvailabilityResult;
};

export type BookingState =
  | "draft"
  | "pending_payment"
  | "paid"
  | "pending_confirmation"
  | "confirmed"
  | "fulfilled"
  | "cancel_requested"
  | "cancelled"
  | "refund_pending"
  | "refunded"
  | "failed"
  | "expired";

export type PaymentStatus =
  | "unpaid"
  | "authorized"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed";

export type BookingContact = {
  name: string;
  email: string;
  phone: string;
};

export type BookingOperationalData = {
  hotelOrPickup?: string;
  flightNumber?: string;
  guestNote?: string;
};

export type Booking = {
  id: string;
  requestId: string;
  customerId?: string;
  contact: BookingContact;
  productType: ProductType;
  productId: string;
  offerId: string;
  quoteId: string;
  state: BookingState;
  paymentStatus: PaymentStatus;
  serviceDate: string;
  pax: number;
  total: Money;
  operationalData?: BookingOperationalData;
  voucherRef?: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingEvent = {
  id: string;
  bookingId: string;
  fromState: BookingState;
  toState: BookingState;
  reason?: string;
  createdAt: string;
};

const bookingTransitions: Record<BookingState, ReadonlySet<BookingState>> = {
  draft: new Set(["pending_payment", "pending_confirmation", "expired", "failed"]),
  pending_payment: new Set(["paid", "cancelled", "expired", "failed"]),
  paid: new Set(["pending_confirmation", "confirmed", "refund_pending", "failed"]),
  pending_confirmation: new Set(["confirmed", "cancelled", "refund_pending", "failed"]),
  confirmed: new Set(["fulfilled", "cancel_requested", "cancelled"]),
  fulfilled: new Set([]),
  cancel_requested: new Set(["cancelled", "confirmed"]),
  cancelled: new Set(["refund_pending", "refunded"]),
  refund_pending: new Set(["refunded", "failed"]),
  refunded: new Set([]),
  failed: new Set([]),
  expired: new Set([]),
};

export function canTransitionBooking(
  from: BookingState,
  to: BookingState,
) {
  return bookingTransitions[from].has(to);
}

export function assertBookingTransition(
  from: BookingState,
  to: BookingState,
) {
  if (!canTransitionBooking(from, to)) {
    throw new Error(`INVALID_BOOKING_TRANSITION:${from}->${to}`);
  }
}

export function assertQuoteBookable(quote: Quote, now = new Date()) {
  if (quote.status !== "active") {
    throw new Error("QUOTE_NOT_ACTIVE");
  }
  if (new Date(quote.expiresAt).getTime() <= now.getTime()) {
    throw new Error("QUOTE_EXPIRED");
  }
  if (!["available", "limited", "request"].includes(quote.availabilitySnapshot.state)) {
    throw new Error("NOT_BOOKABLE");
  }
}
