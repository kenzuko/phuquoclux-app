import type { Money, PaymentStatus } from "./commerce";

export type PaymentRecord = {
  id: string;
  bookingId: string;
  provider: string;
  providerReference?: string;
  status: PaymentStatus;
  amount: Money;
  createdAt: string;
  updatedAt: string;
};

export type PaymentCheckout = {
  paymentId: string;
  provider: string;
  redirectUrl?: string;
  clientToken?: string;
  expiresAt?: string;
};

export type PaymentWebhookEvent = {
  provider: string;
  providerEventId: string;
  receivedAt: string;
  rawBodyHash: string;
};
