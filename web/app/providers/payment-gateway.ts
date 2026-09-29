import type { Booking } from "../domain/commerce";
import type {
  PaymentCheckout,
  PaymentRecord,
} from "../domain/payment";

export type PaymentGatewayContext = {
  requestId: string;
  now: string;
};

export type CreatePaymentInput = {
  booking: Booking;
  returnUrl: string;
  cancelUrl: string;
};

export type RefundInput = {
  payment: PaymentRecord;
  amount?: number;
  reason?: string;
};

export type VerifiedPaymentWebhook = {
  providerEventId: string;
  paymentReference?: string;
  bookingId?: string;
  status:
    | "authorized"
    | "paid"
    | "partially_refunded"
    | "refunded"
    | "failed";
  occurredAt: string;
};

export interface PaymentGateway {
  readonly id: string;

  createCheckout(
    input: CreatePaymentInput,
    context: PaymentGatewayContext,
  ): Promise<PaymentCheckout>;

  verifyWebhook(
    request: Request,
    context: PaymentGatewayContext,
  ): Promise<VerifiedPaymentWebhook>;

  refund?(
    input: RefundInput,
    context: PaymentGatewayContext,
  ): Promise<PaymentRecord>;
}
