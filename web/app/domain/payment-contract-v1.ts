import type { BookingState, Currency, PaymentStatus } from "./commerce";

export type PaymentIntentStatusV1 =
  | "pending"
  | "authorized"
  | "paid"
  | "refund_pending"
  | "partially_refunded"
  | "refunded"
  | "failed";

export type PaymentAttemptStatusV1 =
  | "created"
  | "authorized"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed";

export type VerifiedPaymentEventStatusV1 = Exclude<
  PaymentAttemptStatusV1,
  "created"
>;

export type CreatePaymentIntentAttemptInputV1 = {
  intentId: string;
  attemptId: string;
  bookingId: string;
  quoteId: string;
  provider: string;
  requestKey: string;
  amount: number;
  currency: Currency;
};

export type VerifiedPaymentEventInputV1 = {
  attemptId: string;
  bookingId: string;
  quoteId: string;
  provider: string;
  providerEventId: string;
  providerReference?: string;
  payloadHash: string;
  status: VerifiedPaymentEventStatusV1;
  amount: number;
  currency: Currency;
  occurredAt: string;
};

export type PaymentEventApplyResultV1 = {
  outcome: "processed" | "replayed";
  bookingId: string;
  bookingState: BookingState;
  bookingVersion: number;
  paymentStatus: PaymentStatus;
};

export type BeginRefundInputV1 = {
  bookingId: string;
  expectedBookingVersion: number;
};
