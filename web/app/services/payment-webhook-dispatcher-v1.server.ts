import type { PaymentProviderRegistryV1 } from "../providers/payment-provider-registry-v1";
import type { PaymentEventApplyResultV1 } from "../domain/payment-contract-v1";
import {
  processPaymentWebhookV1,
  type PaymentVerifiedEventRecorderV1,
} from "./payment-webhook-processor-v1.server";
import type { PaymentWebhookPrepareContextV1 } from "../providers/payment-provider-contract-v1";

export type DispatchPaymentWebhookInputV1 = {
  /**
   * Must come from a trusted route/config boundary, never from webhook body or
   * an untrusted provider header.
   */
  providerId: string;
  registry: PaymentProviderRegistryV1;
  request: Request;
  recorder: PaymentVerifiedEventRecorderV1;
  context: PaymentWebhookPrepareContextV1;
};

/**
 * OFFLINE DISPATCH CONTRACT ONLY.
 *
 * Resolves exactly one pre-registered provider adapter before the webhook body
 * is processed. Unknown or malformed provider ids fail before verification or
 * persistence can run.
 */
export async function dispatchPaymentWebhookV1(
  input: DispatchPaymentWebhookInputV1,
): Promise<PaymentEventApplyResultV1> {
  const adapter = input.registry.resolve(input.providerId);

  return processPaymentWebhookV1({
    request: input.request,
    adapter,
    recorder: input.recorder,
    context: input.context,
  });
}
