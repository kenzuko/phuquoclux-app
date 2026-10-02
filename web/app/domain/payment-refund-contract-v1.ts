import type { Currency, PaymentStatus } from "./commerce";
import type { BeginRefundInputV1 } from "./payment-contract-v1";

export type PaymentRefundRequestV1 = BeginRefundInputV1;

export type PaymentRefundCommandV1 = {
  outcome: "created" | "replayed";
  refundRequestId: string;
  bookingId: string;
  bookingState: "refund_pending";
  bookingVersion: number;
  paymentStatus: Extract<PaymentStatus, "paid" | "partially_refunded">;
  intentId: string;
  intentVersion: number;
  attemptId: string;
  provider: string;
  providerReference: string;
  amount: number;
  currency: Currency;
};
