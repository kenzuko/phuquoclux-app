import {
  executePaymentProviderCheckoutV1,
  executePaymentProviderRefundV1,
  PaymentProviderOperationsErrorV1,
} from "../app/providers/payment-provider-operations-v1.ts";

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nexpected: ${String(expected)}\nactual: ${String(actual)}`);
  }
}

async function rejectsCode(fn, code, message) {
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof PaymentProviderOperationsErrorV1)) throw error;
    equal(error.code, code, message);
    equal(error.message, code, `${message}: error message must be generic`);
    return;
  }
  throw new Error(`${message}\nexpected rejection: ${code}`);
}

const requestKey = "11111111-1111-4111-8111-111111111111";
const intentId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const bookingId = "44444444-4444-4444-8444-444444444444";
const quoteId = "55555555-5555-4555-8555-555555555555";
const refundRequestId = "66666666-6666-4666-8666-666666666666";

function checkoutInput(overrides = {}) {
  return {
    request: {
      intentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      attemptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      bookingId,
      quoteId,
      provider: "mockpay",
      requestKey,
      amount: 6500000,
      currency: "VND",
      ...(overrides.request ?? {}),
    },
    attempt: {
      outcome: "replayed",
      intentId,
      attemptId,
      bookingId,
      bookingVersion: 1,
      provider: "mockpay",
      attemptStatus: "created",
      ...(overrides.attempt ?? {}),
    },
    returnUrl: overrides.returnUrl ?? "https://app.example.invalid/payment/return",
    cancelUrl: overrides.cancelUrl ?? "https://app.example.invalid/payment/cancel",
  };
}

function refundCommand(overrides = {}) {
  return {
    outcome: "created",
    refundRequestId,
    bookingId,
    bookingState: "refund_pending",
    bookingVersion: 3,
    paymentStatus: "paid",
    intentId,
    intentVersion: 3,
    attemptId,
    provider: "mockpay",
    providerReference: "pay-ref-001",
    amount: 6500000,
    currency: "VND",
    ...overrides,
  };
}

async function run() {
  let checkoutCall;
  let refundCall;
  const adapter = {
    id: "mockpay",
    async createCheckout(input) {
      checkoutCall = input;
      return {
        providerReference: "pay-ref-001",
        redirectUrl: "https://checkout.example.invalid/session/001",
        expiresAt: "2026-10-02T11:00:00.000Z",
      };
    },
    async createRefund(input) {
      refundCall = input;
      return {
        providerRefundReference: "refund-ref-001",
        acceptedAt: "2026-10-02T10:00:00.000Z",
      };
    },
  };

  const checkout = await executePaymentProviderCheckoutV1(
    adapter,
    checkoutInput(),
  );
  equal(checkout.provider, "mockpay", "checkout result must use adapter provider id");
  equal(checkout.providerReference, "pay-ref-001", "checkout provider reference must be preserved");
  equal(checkoutCall.idempotencyKey, requestKey, "checkout must pass requestKey as exact idempotency key");
  equal(checkoutCall.intentId, intentId, "checkout must use canonical stored intent id, not proposed retry id");
  equal(checkoutCall.attemptId, attemptId, "checkout must use canonical stored attempt id, not proposed retry id");
  equal(checkoutCall.bookingId, bookingId, "checkout booking identity must be preserved");
  equal(checkoutCall.quoteId, quoteId, "checkout quote identity must be preserved");

  await rejectsCode(
    () => executePaymentProviderCheckoutV1(
      { ...adapter, id: "otherpay" },
      checkoutInput(),
    ),
    "PAYMENT_PROVIDER_CHECKOUT_PROVIDER_MISMATCH",
    "checkout may not dispatch to a different provider",
  );
  await rejectsCode(
    () => executePaymentProviderCheckoutV1(
      adapter,
      checkoutInput({ returnUrl: "http://unsafe.example.invalid/return" }),
    ),
    "PAYMENT_PROVIDER_CHECKOUT_RETURN_URL_INVALID",
    "checkout return URL must be https",
  );
  await rejectsCode(
    () => executePaymentProviderCheckoutV1(
      adapter,
      checkoutInput({
        attempt: { providerReference: "already-bound-ref" },
      }),
    ),
    "PAYMENT_PROVIDER_CHECKOUT_REFERENCE_MISMATCH",
    "replayed checkout may not replace an already-bound provider reference",
  );

  const leakingCheckoutAdapter = {
    ...adapter,
    async createCheckout() {
      throw new Error("sdk secret=super-sensitive-token signature mismatch");
    },
  };
  await rejectsCode(
    () => executePaymentProviderCheckoutV1(
      leakingCheckoutAdapter,
      checkoutInput(),
    ),
    "PAYMENT_PROVIDER_CHECKOUT_FAILED",
    "provider checkout exceptions must be collapsed to a generic error",
  );

  const refund = await executePaymentProviderRefundV1(
    adapter,
    refundCommand(),
  );
  equal(refund.provider, "mockpay", "refund result must use adapter provider id");
  equal(refund.providerRefundReference, "refund-ref-001", "refund provider reference must be preserved");
  equal(refundCall.idempotencyKey, refundRequestId, "refund must pass refundRequestId as exact idempotency key");
  equal(refundCall.intentId, intentId, "refund intent identity must be preserved");
  equal(refundCall.attemptId, attemptId, "refund attempt identity must be preserved");
  equal(refundCall.providerReference, "pay-ref-001", "refund must target the bound original payment reference");
  equal(refundCall.amount, 6500000, "refund amount must be preserved");
  equal(refundCall.currency, "VND", "refund currency must be preserved");

  await rejectsCode(
    () => executePaymentProviderRefundV1(
      { ...adapter, id: "otherpay" },
      refundCommand(),
    ),
    "PAYMENT_PROVIDER_REFUND_PROVIDER_MISMATCH",
    "refund may not dispatch to a different provider",
  );

  const leakingRefundAdapter = {
    ...adapter,
    async createRefund() {
      throw new Error("provider api key leaked-in-sdk-error");
    },
  };
  await rejectsCode(
    () => executePaymentProviderRefundV1(
      leakingRefundAdapter,
      refundCommand(),
    ),
    "PAYMENT_PROVIDER_REFUND_FAILED",
    "provider refund exceptions must be collapsed to a generic error",
  );

  await rejectsCode(
    () => executePaymentProviderRefundV1(
      {
        ...adapter,
        async createRefund() {
          return { providerRefundReference: " bad-ref " };
        },
      },
      refundCommand(),
    ),
    "PAYMENT_PROVIDER_REFUND_RESULT_REFERENCE_INVALID",
    "refund result references must be normalized safe tokens",
  );

  console.log("payment-provider-operations-v1: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
