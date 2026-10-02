import { createHash } from "node:crypto";
import {
  PaymentProviderContractErrorV1,
} from "../app/providers/payment-provider-contract-v1.ts";
import {
  processPaymentWebhookV1,
} from "../app/services/payment-webhook-processor-v1.server.ts";

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

async function expectContractError(run, code, message) {
  try {
    await run();
  } catch (error) {
    ok(
      error instanceof PaymentProviderContractErrorV1,
      `${message}: expected PaymentProviderContractErrorV1`,
    );
    equal(error.code, code, message);
    return;
  }
  throw new Error(`${message}: expected rejection`);
}

const RAW_BODY = JSON.stringify({
  event: "paid",
  providerEventId: "evt_processor_001",
});
const RECEIVED_AT = "2026-10-02T03:00:00.000Z";
const OCCURRED_AT = "2026-10-02T02:59:58.000Z";

function verifiedEvent() {
  return {
    attemptId: "11111111-1111-4111-8111-111111111111",
    bookingId: "22222222-2222-4222-8222-222222222222",
    quoteId: "33333333-3333-4333-8333-333333333333",
    providerEventId: "evt_processor_001",
    providerReference: "payment_ref_001",
    status: "paid",
    amount: 6500000,
    currency: "VND",
    occurredAt: OCCURRED_AT,
  };
}

async function run() {
  let adapterCalls = 0;
  let recorderCalls = 0;
  let recordedEvent;
  let recordedAt;

  const adapter = {
    id: "synthetic.test",
    async verifyWebhook(input) {
      adapterCalls += 1;
      equal(
        input.headers["x-test-signature"],
        "valid",
        "adapter must receive normalized request headers",
      );
      equal(
        new TextDecoder().decode(input.rawBody),
        RAW_BODY,
        "adapter must receive exact raw webhook bytes",
      );
      return verifiedEvent();
    },
  };

  const recorder = async (event, receivedAt) => {
    recorderCalls += 1;
    recordedEvent = event;
    recordedAt = receivedAt;
    return {
      outcome: "processed",
      bookingId: event.bookingId,
      bookingState: "paid",
      bookingVersion: 4,
      paymentStatus: "paid",
    };
  };

  const request = new Request("https://offline.invalid/payment-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-test-signature": "valid",
    },
    body: RAW_BODY,
  });

  const result = await processPaymentWebhookV1({
    request,
    adapter,
    recorder,
    context: {
      requestId: "req-payment-processor-001",
      receivedAt: RECEIVED_AT,
      policy: {
        acceptedContentTypes: ["application/json"],
      },
    },
  });

  equal(adapterCalls, 1, "valid webhook must call adapter exactly once");
  equal(recorderCalls, 1, "verified webhook must call recorder exactly once");
  equal(result.outcome, "processed", "processor must return recorder outcome");
  equal(result.bookingState, "paid", "processor must preserve recorder result");
  equal(
    recordedEvent.provider,
    "synthetic.test",
    "processor must bind verified event to adapter id",
  );
  equal(
    recordedEvent.payloadHash,
    createHash("sha256").update(RAW_BODY).digest("hex"),
    "processor must pass exact raw-body SHA-256 to persistence boundary",
  );
  equal(
    recordedEvent.providerEventId,
    "evt_processor_001",
    "processor must preserve provider event identity",
  );
  equal(
    recordedAt.toISOString(),
    RECEIVED_AT,
    "processor must use stable prepared receive time for persistence",
  );

  let failedRecorderCalls = 0;
  const signatureFailureAdapter = {
    id: "synthetic.test",
    async verifyWebhook() {
      throw new Error("provider-specific-secret-error-must-not-escape");
    },
  };

  await expectContractError(
    () =>
      processPaymentWebhookV1({
        request: new Request("https://offline.invalid/payment-webhook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: RAW_BODY,
        }),
        adapter: signatureFailureAdapter,
        recorder: async () => {
          failedRecorderCalls += 1;
          throw new Error("recorder must not run");
        },
        context: {
          requestId: "req-payment-processor-002",
          receivedAt: RECEIVED_AT,
        },
      }),
    "PAYMENT_WEBHOOK_VERIFICATION_FAILED",
    "signature failure must fail closed before persistence",
  );
  equal(
    failedRecorderCalls,
    0,
    "signature failure must never reach payment persistence",
  );

  let oversizedAdapterCalls = 0;
  let oversizedRecorderCalls = 0;
  await expectContractError(
    () =>
      processPaymentWebhookV1({
        request: new Request("https://offline.invalid/payment-webhook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "12345",
        }),
        adapter: {
          id: "synthetic.test",
          async verifyWebhook() {
            oversizedAdapterCalls += 1;
            return verifiedEvent();
          },
        },
        recorder: async () => {
          oversizedRecorderCalls += 1;
          throw new Error("recorder must not run");
        },
        context: {
          requestId: "req-payment-processor-003",
          receivedAt: RECEIVED_AT,
          policy: { maxBodyBytes: 4 },
        },
      }),
    "PAYMENT_WEBHOOK_BODY_TOO_LARGE",
    "oversized webhook must be rejected before verification",
  );
  equal(
    oversizedAdapterCalls,
    0,
    "oversized webhook must never invoke provider adapter",
  );
  equal(
    oversizedRecorderCalls,
    0,
    "oversized webhook must never reach payment persistence",
  );

  let invalidProviderAdapterCalls = 0;
  await expectContractError(
    () =>
      processPaymentWebhookV1({
        request: new Request("https://offline.invalid/payment-webhook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: RAW_BODY,
        }),
        adapter: {
          id: "INVALID PROVIDER",
          async verifyWebhook() {
            invalidProviderAdapterCalls += 1;
            return verifiedEvent();
          },
        },
        recorder: async () => {
          throw new Error("recorder must not run");
        },
        context: {
          requestId: "req-payment-processor-004",
          receivedAt: RECEIVED_AT,
        },
      }),
    "PAYMENT_PROVIDER_INVALID",
    "invalid provider id must fail before adapter execution",
  );
  equal(
    invalidProviderAdapterCalls,
    0,
    "invalid provider id must never run provider verification",
  );

  const replayResult = await processPaymentWebhookV1({
    request: new Request("https://offline.invalid/payment-webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-signature": "valid",
      },
      body: RAW_BODY,
    }),
    adapter,
    recorder: async (event) => ({
      outcome: "replayed",
      bookingId: event.bookingId,
      bookingState: "paid",
      bookingVersion: 4,
      paymentStatus: "paid",
    }),
    context: {
      requestId: "req-payment-processor-005",
      receivedAt: RECEIVED_AT,
    },
  });
  equal(
    replayResult.outcome,
    "replayed",
    "processor must preserve idempotent replay outcome from recorder",
  );

  console.log("payment webhook processor v1: ok");
}

await run();
