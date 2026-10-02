import {
  createPaymentProviderBundleRegistryV1,
  createPaymentProviderBundleV1,
  PaymentProviderBundleErrorV1,
} from "../app/providers/payment-provider-bundle-v1.ts";

function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}\nexpected: ${String(expected)}\nactual: ${String(actual)}`);
}

function throwsCode(fn, code, message) {
  try {
    fn();
  } catch (error) {
    if (!(error instanceof PaymentProviderBundleErrorV1)) throw error;
    equal(error.code, code, message);
    return;
  }
  throw new Error(`${message}\nexpected throw: ${code}`);
}

const webhook = {
  id: "mockpay",
  async verifyWebhook() {
    throw new Error("not invoked by bundle test");
  },
};
const operations = {
  id: "mockpay",
  async createCheckout() {
    throw new Error("not invoked by bundle test");
  },
  async createRefund() {
    throw new Error("not invoked by bundle test");
  },
};

const bundle = createPaymentProviderBundleV1({ webhook, operations });
equal(bundle.id, "mockpay", "bundle id must be canonical provider id");
equal(bundle.webhook, webhook, "bundle must preserve webhook adapter");
equal(bundle.operations, operations, "bundle must preserve operations adapter");
equal(Object.isFrozen(bundle), true, "bundle must be immutable");

throwsCode(
  () => createPaymentProviderBundleV1({ webhook, operations: { ...operations, id: "otherpay" } }),
  "PAYMENT_PROVIDER_BUNDLE_ID_MISMATCH",
  "webhook and outbound operations may not use different provider ids",
);

const another = createPaymentProviderBundleV1({
  webhook: { ...webhook, id: "anotherpay" },
  operations: { ...operations, id: "anotherpay" },
});
const registry = createPaymentProviderBundleRegistryV1([bundle, another]);
equal(registry.resolve("mockpay"), bundle, "registry must return exact bundle");
equal(registry.has("mockpay"), true, "registered provider must be discoverable");
equal(registry.has("missingpay"), false, "unknown provider must not be discoverable");
equal(registry.ids().join(","), "anotherpay,mockpay", "provider ids must be stable and sorted");
equal(Object.isFrozen(registry), true, "bundle registry must be immutable");

throwsCode(
  () => registry.resolve("missingpay"),
  "PAYMENT_PROVIDER_BUNDLE_NOT_REGISTERED",
  "unknown provider must fail closed",
);
throwsCode(
  () => createPaymentProviderBundleRegistryV1([bundle, bundle]),
  "PAYMENT_PROVIDER_BUNDLE_DUPLICATE",
  "duplicate provider bundle must fail closed",
);
throwsCode(
  () => createPaymentProviderBundleRegistryV1([{ ...bundle, id: "otherpay" }]),
  "PAYMENT_PROVIDER_BUNDLE_ID_MISMATCH",
  "tampered bundle identity must fail closed",
);

console.log("payment-provider-bundle-v1: ok");
