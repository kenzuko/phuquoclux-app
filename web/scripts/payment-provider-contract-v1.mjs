import assert from "node:assert/strict";
import {
  PaymentProviderContractErrorV1,
  preparePaymentWebhookV1,
  verifyPaymentWebhookV1,
} from "../app/providers/payment-provider-contract-v1.ts";

const rawBody = '{"status":"paid", "note":"raw bytes stay exact"}';
const ids = {
  attemptId: "11111111-1111-4111-8111-111111111111",
  bookingId: "22222222-2222-4222-8222-222222222222",
  quoteId: "33333333-3333-4333-8333-333333333333",
};

async function expectCode(operation, code, status) {
  try {
    await operation();
    assert.fail(`expected ${code}`);
  } catch (error) {
    assert.ok(error instanceof PaymentProviderContractErrorV1, String(error));
    assert.equal(error.code, code);
    assert.equal(error.httpStatus, status);
  }
}

function normalizedEvent(overrides = {}) {
  return {
    ...ids,
    providerEventId: "evt_001",
    providerReference: "pay_001",
    status: "paid",
    amount: 1250000,
    currency: "VND",
    occurredAt: "2026-10-02T02:40:00.000Z",
    ...overrides,
  };
}

const adapter = {
  id: "synthetic-provider",
  async verifyWebhook(input) {
    assert.equal(input.headers["x-test-signature"], "valid");
    assert.equal(new TextDecoder().decode(input.rawBody), rawBody);
    return normalizedEvent();
  },
};

const request = new Request("https://example.invalid/webhooks/payment", {
  method: "POST",
  headers: {
    "content-type": "application/json; charset=utf-8",
    "x-test-signature": "valid",
  },
  body: rawBody,
});
const prepared = await preparePaymentWebhookV1(request, {
  requestId: "req-payment-webhook-001",
  receivedAt: "2026-10-02T02:40:01.000Z",
  policy: { acceptedContentTypes: ["application/json"] },
});

assert.equal(request.bodyUsed, true, "raw request body must be consumed once");
assert.equal(prepared.contentType, "application/json");
assert.match(prepared.payloadHash, /^[0-9a-f]{64}$/);
assert.equal(new TextDecoder().decode(prepared.rawBody), rawBody);

const verified = await verifyPaymentWebhookV1(adapter, prepared);
assert.equal(verified.provider, "synthetic-provider");
assert.equal(verified.payloadHash, prepared.payloadHash);
assert.equal(verified.providerEventId, "evt_001");
assert.equal(verified.status, "paid");
assert.equal("rawBody" in verified, false);
assert.equal("headers" in verified, false);

await expectCode(
  () =>
    preparePaymentWebhookV1(
      new Request("https://example.invalid/webhooks/payment", { method: "GET" }),
      {
        requestId: "req-get",
        receivedAt: "2026-10-02T02:40:01.000Z",
      },
    ),
  "PAYMENT_WEBHOOK_METHOD_NOT_ALLOWED",
  405,
);

await expectCode(
  () =>
    preparePaymentWebhookV1(
      new Request("https://example.invalid/webhooks/payment", {
        method: "POST",
        body: "123456789",
      }),
      {
        requestId: "req-large",
        receivedAt: "2026-10-02T02:40:01.000Z",
        policy: { maxBodyBytes: 8 },
      },
    ),
  "PAYMENT_WEBHOOK_BODY_TOO_LARGE",
  413,
);

await expectCode(
  () =>
    preparePaymentWebhookV1(
      new Request("https://example.invalid/webhooks/payment", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
      {
        requestId: "req-content-type",
        receivedAt: "2026-10-02T02:40:01.000Z",
        policy: { acceptedContentTypes: ["application/json"] },
      },
    ),
  "PAYMENT_WEBHOOK_CONTENT_TYPE_UNSUPPORTED",
  415,
);

const consumed = new Request("https://example.invalid/webhooks/payment", {
  method: "POST",
  body: "{}",
});
await consumed.text();
await expectCode(
  () =>
    preparePaymentWebhookV1(consumed, {
      requestId: "req-consumed",
      receivedAt: "2026-10-02T02:40:01.000Z",
    }),
  "PAYMENT_WEBHOOK_BODY_ALREADY_USED",
  400,
);

const preparedForFailures = await preparePaymentWebhookV1(
  new Request("https://example.invalid/webhooks/payment", {
    method: "POST",
    body: "{}",
  }),
  {
    requestId: "req-failures",
    receivedAt: "2026-10-02T02:40:01.000Z",
  },
);

await expectCode(
  () =>
    verifyPaymentWebhookV1(
      {
        id: "synthetic-provider",
        async verifyWebhook() {
          throw new Error("provider-specific signature details");
        },
      },
      preparedForFailures,
    ),
  "PAYMENT_WEBHOOK_VERIFICATION_FAILED",
  401,
);

await expectCode(
  () =>
    verifyPaymentWebhookV1(
      {
        id: "Synthetic Provider",
        async verifyWebhook() {
          return normalizedEvent();
        },
      },
      preparedForFailures,
    ),
  "PAYMENT_PROVIDER_INVALID",
  500,
);

await expectCode(
  () =>
    verifyPaymentWebhookV1(
      {
        id: "synthetic-provider",
        async verifyWebhook() {
          return normalizedEvent({ status: "created" });
        },
      },
      preparedForFailures,
    ),
  "PAYMENT_WEBHOOK_STATUS_INVALID",
  422,
);

await expectCode(
  () =>
    verifyPaymentWebhookV1(
      {
        id: "synthetic-provider",
        async verifyWebhook() {
          return normalizedEvent({ bookingId: "booking-not-a-uuid" });
        },
      },
      preparedForFailures,
    ),
  "PAYMENT_WEBHOOK_BOOKING_ID_INVALID",
  422,
);

await expectCode(
  () =>
    verifyPaymentWebhookV1(
      {
        id: "synthetic-provider",
        async verifyWebhook() {
          return normalizedEvent({ amount: 0 });
        },
      },
      preparedForFailures,
    ),
  "PAYMENT_WEBHOOK_AMOUNT_INVALID",
  422,
);

await expectCode(
  () =>
    verifyPaymentWebhookV1(
      {
        id: "synthetic-provider",
        async verifyWebhook() {
          return normalizedEvent({ currency: "USD" });
        },
      },
      preparedForFailures,
    ),
  "PAYMENT_WEBHOOK_AMOUNT_INVALID",
  422,
);

console.log("payment provider boundary v1: ok");
