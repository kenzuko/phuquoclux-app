import type { PaymentProviderRegistryV1 } from "../providers/payment-provider-registry-v1";
import type { PaymentWebhookPrepareContextV1 } from "../providers/payment-provider-contract-v1";
import {
  dispatchPaymentWebhookV1,
  type DispatchPaymentWebhookInputV1,
} from "./payment-webhook-dispatcher-v1.server";
import type { PaymentVerifiedEventRecorderV1 } from "./payment-webhook-processor-v1.server";
import type { PaymentEventApplyResultV1 } from "../domain/payment-contract-v1";

export class PaymentRuntimeGateErrorV1 extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PaymentRuntimeGateErrorV1";
    this.code = code;
  }
}

export type PaymentWebhookRuntimeConfigV1 = {
  commerceMode?: "prototype" | "live";
  webhookEnabled?: boolean;
  providerId?: string;
  registry?: PaymentProviderRegistryV1;
  recorder?: PaymentVerifiedEventRecorderV1;
};

export type PaymentWebhookRuntimeV1 = Readonly<{
  providerId: string;
  registry: PaymentProviderRegistryV1;
  recorder: PaymentVerifiedEventRecorderV1;
}>;

function fail(code: string): never {
  throw new PaymentRuntimeGateErrorV1(code);
}

/**
 * Creates an explicit capability object for payment webhook execution.
 *
 * One flag can never activate payment processing by itself. The application
 * must be in live commerce mode, webhook activation must be explicit, a
 * provider must already be registered, and a reviewed persistence recorder
 * must be injected.
 *
 * This remains an offline contract until a later reviewed runtime route wires
 * real provider/database dependencies into it.
 */
export function createPaymentWebhookRuntimeV1(
  config: PaymentWebhookRuntimeConfigV1,
): PaymentWebhookRuntimeV1 {
  if (config.commerceMode !== "live") {
    fail("PAYMENT_RUNTIME_COMMERCE_NOT_LIVE");
  }
  if (config.webhookEnabled !== true) {
    fail("PAYMENT_RUNTIME_WEBHOOK_DISABLED");
  }
  if (!config.registry) {
    fail("PAYMENT_RUNTIME_REGISTRY_MISSING");
  }
  if (!config.providerId) {
    fail("PAYMENT_RUNTIME_PROVIDER_MISSING");
  }
  if (typeof config.recorder !== "function") {
    fail("PAYMENT_RUNTIME_RECORDER_MISSING");
  }

  // Resolution is deliberately performed while creating the capability so an
  // unknown/malformed provider cannot produce a seemingly ready runtime.
  config.registry.resolve(config.providerId);

  return Object.freeze({
    providerId: config.providerId,
    registry: config.registry,
    recorder: config.recorder,
  });
}

export type HandlePaymentWebhookRuntimeInputV1 = Pick<
  DispatchPaymentWebhookInputV1,
  "request" | "context"
>;

export async function handlePaymentWebhookRuntimeV1(
  runtime: PaymentWebhookRuntimeV1,
  input: HandlePaymentWebhookRuntimeInputV1,
): Promise<PaymentEventApplyResultV1> {
  return dispatchPaymentWebhookV1({
    providerId: runtime.providerId,
    registry: runtime.registry,
    recorder: runtime.recorder,
    request: input.request,
    context: input.context as PaymentWebhookPrepareContextV1,
  });
}
