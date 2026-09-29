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
  optionId?: string;
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
  optionId?: string;
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

export type Booking = {
  id: string;
  customerId?: string;
  guestEmail: string;
  productType: ProductType;
  productId: string;
  offerId: string;
  quoteId: string;
  state: BookingState;
  paymentStatus: PaymentStatus;
  serviceDate: string;
  pax: number;
  total: Money;
  voucherRef?: string;
  createdAt: string;
  updatedAt: string;
};

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
