import type { Currency } from "./commerce";
import type {
  CreatePaymentIntentAttemptInputV1,
  PaymentAttemptStatusV1,
} from "./payment-contract-v1";

export type PaymentCheckoutAttemptRequestV1 =
  CreatePaymentIntentAttemptInputV1;

export type PaymentCheckoutAttemptResultV1 = {
  outcome: "created" | "replayed";
  intentId: string;
  attemptId: string;
  bookingId: string;
  bookingVersion: number;
  provider: string;
  providerReference?: string;
  attemptStatus: PaymentAttemptStatusV1;
};

export type BindPaymentProviderReferenceInputV1 = {
  attemptId: string;
  bookingId: string;
  quoteId: string;
  provider: string;
  providerReference: string;
  amount: number;
  currency: Currency;
};

export type BindPaymentProviderReferenceResultV1 = {
  outcome: "attached" | "replayed";
  intentId: string;
  attemptId: string;
  bookingId: string;
  provider: string;
  providerReference: string;
  attemptStatus: PaymentAttemptStatusV1;
};
