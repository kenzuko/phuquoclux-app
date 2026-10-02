import type { PaymentProviderAdapterV1 } from "./payment-provider-contract-v1";
import type { PaymentProviderOperationsAdapterV1 } from "./payment-provider-operations-v1";

const PROVIDER_ID_V1 = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export class PaymentProviderBundleErrorV1 extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PaymentProviderBundleErrorV1";
    this.code = code;
  }
}

export type PaymentProviderBundleV1 = Readonly<{
  id: string;
  webhook: PaymentProviderAdapterV1;
  operations: PaymentProviderOperationsAdapterV1;
}>;

export type PaymentProviderBundleRegistryV1 = Readonly<{
  resolve(providerId: string): PaymentProviderBundleV1;
  has(providerId: string): boolean;
  ids(): readonly string[];
}>;

function fail(code: string): never {
  throw new PaymentProviderBundleErrorV1(code);
}

function assertProviderId(providerId: string) {
  if (!PROVIDER_ID_V1.test(providerId)) fail("PAYMENT_PROVIDER_ID_INVALID");
}

export function createPaymentProviderBundleV1(input: {
  webhook: PaymentProviderAdapterV1;
  operations: PaymentProviderOperationsAdapterV1;
}): PaymentProviderBundleV1 {
  assertProviderId(input.webhook.id);
  assertProviderId(input.operations.id);
  if (input.webhook.id !== input.operations.id) {
    fail("PAYMENT_PROVIDER_BUNDLE_ID_MISMATCH");
  }

  return Object.freeze({
    id: input.webhook.id,
    webhook: input.webhook,
    operations: input.operations,
  });
}

export function createPaymentProviderBundleRegistryV1(
  bundles: readonly PaymentProviderBundleV1[],
): PaymentProviderBundleRegistryV1 {
  const entries = new Map<string, PaymentProviderBundleV1>();

  for (const bundle of bundles) {
    assertProviderId(bundle.id);
    if (
      bundle.webhook.id !== bundle.id ||
      bundle.operations.id !== bundle.id
    ) {
      fail("PAYMENT_PROVIDER_BUNDLE_ID_MISMATCH");
    }
    if (entries.has(bundle.id)) {
      fail("PAYMENT_PROVIDER_BUNDLE_DUPLICATE");
    }
    entries.set(bundle.id, bundle);
  }

  const ids = Object.freeze(Array.from(entries.keys()).sort());
  return Object.freeze({
    resolve(providerId: string) {
      assertProviderId(providerId);
      const bundle = entries.get(providerId);
      if (!bundle) fail("PAYMENT_PROVIDER_BUNDLE_NOT_REGISTERED");
      return bundle;
    },
    has(providerId: string) {
      return PROVIDER_ID_V1.test(providerId) && entries.has(providerId);
    },
    ids() {
      return ids;
    },
  });
}
