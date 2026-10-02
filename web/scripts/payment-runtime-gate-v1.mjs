import {
  createPaymentWebhookRuntimeV1,
  handlePaymentWebhookRuntimeV1,
  PaymentRuntimeGateErrorV1,
} from "../app/services/payment-runtime-gate-v1.server.ts";
import { createPaymentProviderRegistryV1 } from "../app/providers/payment-provider-registry-v1.ts";

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}\nexpected: ${String(expected)}\nactual: ${String(actual)}`,
    );
  }
}

async function rejectsCode(fn, expectedCode, message) {
  try {
    await fn();
  } catch (error) {
    equal(error?.code, expectedCode, message);
    return;
  }
  throw new Error(`${message}\nexpected rejection: ${expectedCode}`);
}

function event() {
  return {
    attemptId: "11111111-1111-4111-8111-111111111111",
    bookingId: "22222222-2222-4222-8222-222222222222",
    quoteId: "33333333-3333-4333-8333-333333333333",
    providerEventId: "evt-runtime-001",
    providerReference: "pay-runtime-001",
    status: "paid",
    amount: 6500000,
    currency: "VND",
    occurredAt: "2026-10-02T07:45:00.000Z",
  };
}

async function run() {
  const adapter = {
    id: "mockpay",
    async verifyWebhook() {
      return event();
    },
  };
  const registry = createPaymentProviderRegistryV1([adapter]);
  const recorder = async (verified) => ({
    outcome: "processed",
    bookingId: verified.bookingId,
    bookingState: "paid",
    bookingVersion: 2,
    paymentStatus: "paid",
  });

  await rejectsCode(
    () => Promise.resolve(createPaymentWebhookRuntimeV1({})),
    "PAYMENT_RUNTIME_COMMERCE_NOT_LIVE",
    "empty runtime config must fail closed",
  );
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentWebhookRuntimeV1({
          commerceMode: "prototype",
          webhookEnabled: true,
          providerId: "mockpay",
          registry,
          recorder,
        }),
      ),
    "PAYMENT_RUNTIME_COMMERCE_NOT_LIVE",
    "webhook flag alone must never activate prototype commerce",
  );
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentWebhookRuntimeV1({
          commerceMode: "live",
          providerId: "mockpay",
          registry,
          recorder,
        }),
      ),
    "PAYMENT_RUNTIME_WEBHOOK_DISABLED",
    "live commerce without explicit webhook activation must fail closed",
  );
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentWebhookRuntimeV1({
          commerceMode: "live",
          webhookEnabled: true,
          providerId: "mockpay",
          recorder,
        }),
      ),
    "PAYMENT_RUNTIME_REGISTRY_MISSING",
    "runtime without provider registry must fail closed",
  );
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentWebhookRuntimeV1({
          commerceMode: "live",
          webhookEnabled: true,
          registry,
          recorder,
        }),
      ),
    "PAYMENT_RUNTIME_PROVIDER_MISSING",
    "runtime without trusted provider mapping must fail closed",
  );
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentWebhookRuntimeV1({
          commerceMode: "live",
          webhookEnabled: true,
          providerId: "mockpay",
          registry,
        }),
      ),
    "PAYMENT_RUNTIME_RECORDER_MISSING",
    "runtime without persistence recorder must fail closed",
  );
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentWebhookRuntimeV1({
          commerceMode: "live",
          webhookEnabled: true,
          providerId: "missingpay",
          registry,
          recorder,
        }),
      ),
    "PAYMENT_PROVIDER_NOT_REGISTERED",
    "runtime must reject a provider that is not explicitly registered",
  );

  const runtime = createPaymentWebhookRuntimeV1({
    commerceMode: "live",
    webhookEnabled: true,
    providerId: "mockpay",
    registry,
    recorder,
  });
  equal(Object.isFrozen(runtime), true, "runtime capability must be immutable");
  equal(runtime.providerId, "mockpay", "runtime must keep trusted provider id");

  let recorderCalls = 0;
  let recordedProvider = "";
  const trackedRuntime = createPaymentWebhookRuntimeV1({
    commerceMode: "live",
    webhookEnabled: true,
    providerId: "mockpay",
    registry,
    recorder: async (verified) => {
      recorderCalls += 1;
      recordedProvider = verified.provider;
      return recorder(verified);
    },
  });

  const result = await handlePaymentWebhookRuntimeV1(trackedRuntime, {
    request: new Request("https://example.invalid/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-provider": "evilpay",
      },
      body: JSON.stringify({ provider: "evilpay" }),
    }),
    context: {
      requestId: "req-runtime-001",
      receivedAt: "2026-10-02T07:46:00.000Z",
      policy: { acceptedContentTypes: ["application/json"] },
    },
  });

  equal(recorderCalls, 1, "ready runtime must persist exactly once");
  equal(
    recordedProvider,
    "mockpay",
    "ready runtime must keep registered provider identity despite body/header hints",
  );
  equal(result.outcome, "processed", "runtime must return processor result");

  console.log("payment-runtime-gate-v1: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
