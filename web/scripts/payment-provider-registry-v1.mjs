import {
  createPaymentProviderRegistryV1,
  PaymentProviderRegistryErrorV1,
} from "../app/providers/payment-provider-registry-v1.ts";
import { dispatchPaymentWebhookV1 } from "../app/services/payment-webhook-dispatcher-v1.server.ts";

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

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

function normalizedEvent() {
  return {
    attemptId: "11111111-1111-4111-8111-111111111111",
    bookingId: "22222222-2222-4222-8222-222222222222",
    quoteId: "33333333-3333-4333-8333-333333333333",
    providerEventId: "evt-001",
    providerReference: "pay-001",
    status: "paid",
    amount: 6500000,
    currency: "VND",
    occurredAt: "2026-10-02T07:30:00.000Z",
  };
}

async function run() {
  const alpha = {
    id: "alpha_pay",
    async verifyWebhook() {
      return normalizedEvent();
    },
  };
  const mock = {
    id: "mockpay",
    async verifyWebhook() {
      return normalizedEvent();
    },
  };

  const registry = createPaymentProviderRegistryV1([mock, alpha]);
  equal(registry.has("mockpay"), true, "registered provider must be visible");
  equal(registry.has("missing"), false, "unknown provider must not be visible");
  equal(registry.has(" MockPay "), false, "invalid provider id must fail closed");
  equal(
    registry.ids().join(","),
    "alpha_pay,mockpay",
    "registry ids must be stable and sorted",
  );
  ok(Object.isFrozen(registry.ids()), "registry id list must be immutable");
  equal(registry.resolve("mockpay"), mock, "registry must resolve exact adapter");

  await rejectsCode(
    () => Promise.resolve(registry.resolve(" MockPay ")),
    "PAYMENT_PROVIDER_ID_INVALID",
    "malformed provider id must be rejected",
  );
  await rejectsCode(
    () => Promise.resolve(registry.resolve("missing")),
    "PAYMENT_PROVIDER_NOT_REGISTERED",
    "unknown provider must be rejected",
  );
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentProviderRegistryV1([
          mock,
          {
            id: "mockpay",
            async verifyWebhook() {
              return normalizedEvent();
            },
          },
        ]),
      ),
    "PAYMENT_PROVIDER_DUPLICATE_REGISTRATION",
    "duplicate provider registration must be rejected",
  );

  let verifyCalls = 0;
  let recorderCalls = 0;
  let rawBodySeen = "";
  const strictMock = {
    id: "mockpay",
    async verifyWebhook(input) {
      verifyCalls += 1;
      rawBodySeen = new TextDecoder().decode(input.rawBody);
      return normalizedEvent();
    },
  };
  const strictRegistry = createPaymentProviderRegistryV1([strictMock]);
  const receivedAt = "2026-10-02T07:31:00.000Z";
  let recordedEvent;
  let recordedReceivedAt;
  const recorder = async (event, timestamp) => {
    recorderCalls += 1;
    recordedEvent = event;
    recordedReceivedAt = timestamp.toISOString();
    return {
      outcome: "processed",
      bookingId: event.bookingId,
      bookingState: "paid",
      bookingVersion: 2,
      paymentStatus: "paid",
    };
  };

  const untrustedBody = JSON.stringify({
    provider: "evilpay",
    note: "body/header must not select adapter",
  });
  const result = await dispatchPaymentWebhookV1({
    providerId: "mockpay",
    registry: strictRegistry,
    request: new Request("https://example.invalid/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-provider": "evilpay",
      },
      body: untrustedBody,
    }),
    recorder,
    context: {
      requestId: "req-registry-001",
      receivedAt,
      policy: { acceptedContentTypes: ["application/json"] },
    },
  });

  equal(verifyCalls, 1, "selected adapter must verify exactly once");
  equal(recorderCalls, 1, "verified event must persist exactly once");
  equal(rawBodySeen, untrustedBody, "adapter must receive exact original body");
  equal(
    recordedEvent.provider,
    "mockpay",
    "provider identity must come from registered adapter, not body/header",
  );
  equal(
    recordedReceivedAt,
    receivedAt,
    "dispatcher must preserve stable receive time",
  );
  equal(result.outcome, "processed", "dispatcher must pass through result");

  verifyCalls = 0;
  recorderCalls = 0;
  await rejectsCode(
    () =>
      dispatchPaymentWebhookV1({
        providerId: "evilpay",
        registry: strictRegistry,
        request: new Request("https://example.invalid/webhook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider: "mockpay" }),
        }),
        recorder,
        context: {
          requestId: "req-registry-002",
          receivedAt,
        },
      }),
    "PAYMENT_PROVIDER_NOT_REGISTERED",
    "unregistered trusted-boundary provider must fail before body processing",
  );
  equal(verifyCalls, 0, "unknown provider must not invoke any adapter");
  equal(recorderCalls, 0, "unknown provider must not reach persistence");

  console.log("payment-provider-registry-v1: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
