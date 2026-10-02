import type {
  PaymentEventApplyResultV1,
  VerifiedPaymentEventInputV1,
} from "../domain/payment-contract-v1";
import type { SqlTransactionManager } from "../repositories/postgres-booking-core.server";
import { recordVerifiedPaymentEventV1 } from "../repositories/postgres-payment-contract-v1.server";
import {
  preparePaymentWebhookV1,
  verifyPaymentWebhookV1,
  type PaymentProviderAdapterV1,
  type PaymentWebhookPrepareContextV1,
} from "../providers/payment-provider-contract-v1";

/**
 * OFFLINE COMPOSITION BOUNDARY ONLY.
 *
 * This service intentionally has no route, Worker binding, provider secret,
 * production migration or provider selection. It only composes the already
 * reviewed webhook-verification contract with the verified-event recorder.
 */
export type PaymentVerifiedEventRecorderV1 = (
  event: VerifiedPaymentEventInputV1,
  receivedAt: Date,
) => Promise<PaymentEventApplyResultV1>;

export type ProcessPaymentWebhookInputV1 = {
  request: Request;
  adapter: PaymentProviderAdapterV1;
  recorder: PaymentVerifiedEventRecorderV1;
  context: PaymentWebhookPrepareContextV1;
};

export function createPostgresPaymentEventRecorderV1(
  database: SqlTransactionManager,
): PaymentVerifiedEventRecorderV1 {
  return (event, receivedAt) =>
    recordVerifiedPaymentEventV1(database, event, receivedAt);
}

export async function processPaymentWebhookV1(
  input: ProcessPaymentWebhookInputV1,
): Promise<PaymentEventApplyResultV1> {
  // Raw bytes are read exactly once here. The adapter receives those exact
  // bytes for signature verification before any event can reach persistence.
  const prepared = await preparePaymentWebhookV1(input.request, input.context);
  const verified = await verifyPaymentWebhookV1(input.adapter, prepared);

  // preparePaymentWebhookV1 already validates this timestamp. Reusing it for
  // persistence keeps receipt time stable across the full processing boundary.
  const receivedAt = new Date(prepared.receivedAt);
  return input.recorder(verified, receivedAt);
}
