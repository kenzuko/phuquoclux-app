import type { PaymentProviderAdapterV1 } from "./payment-provider-contract-v1";

const PROVIDER_ID_V1 = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export class PaymentProviderRegistryErrorV1 extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PaymentProviderRegistryErrorV1";
    this.code = code;
  }
}

function assertProviderId(providerId: string) {
  if (!PROVIDER_ID_V1.test(providerId)) {
    throw new PaymentProviderRegistryErrorV1("PAYMENT_PROVIDER_ID_INVALID");
  }
}

export type PaymentProviderRegistryV1 = {
  resolve(providerId: string): PaymentProviderAdapterV1;
  has(providerId: string): boolean;
  ids(): readonly string[];
};

/**
 * OFFLINE REGISTRY CONTRACT ONLY.
 *
 * Provider selection must come from a trusted route/config boundary and then
 * resolve through this explicit registry. Webhook body/header fields must never
 * be allowed to select which adapter verifies the request.
 */
export function createPaymentProviderRegistryV1(
  adapters: readonly PaymentProviderAdapterV1[],
): PaymentProviderRegistryV1 {
  const entries = new Map<string, PaymentProviderAdapterV1>();

  for (const adapter of adapters) {
    assertProviderId(adapter.id);
    if (entries.has(adapter.id)) {
      throw new PaymentProviderRegistryErrorV1(
        "PAYMENT_PROVIDER_DUPLICATE_REGISTRATION",
      );
    }
    entries.set(adapter.id, adapter);
  }

  const ids = Object.freeze(Array.from(entries.keys()).sort());

  return Object.freeze({
    resolve(providerId: string) {
      assertProviderId(providerId);
      const adapter = entries.get(providerId);
      if (!adapter) {
        throw new PaymentProviderRegistryErrorV1(
          "PAYMENT_PROVIDER_NOT_REGISTERED",
        );
      }
      return adapter;
    },

    has(providerId: string) {
      if (!PROVIDER_ID_V1.test(providerId)) return false;
      return entries.has(providerId);
    },

    ids() {
      return ids;
    },
  });
}
