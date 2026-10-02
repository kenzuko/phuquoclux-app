import type {
  PaymentCheckoutAttemptRequestV1,
  PaymentCheckoutAttemptResultV1,
} from "../domain/payment-checkout-contract-v1";
import type { PaymentRefundCommandV1 } from "../domain/payment-refund-contract-v1";
import type { Currency } from "../domain/commerce";

const UUID_V1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_ID_V1 = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export class PaymentProviderOperationsErrorV1 extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PaymentProviderOperationsErrorV1";
    this.code = code;
  }
}

function fail(code: string): never {
  throw new PaymentProviderOperationsErrorV1(code);
}

function assertUuid(value: string, code: string) {
  if (!UUID_V1.test(value)) fail(code);
}

function assertProvider(value: string) {
  if (!PROVIDER_ID_V1.test(value)) fail("PAYMENT_PROVIDER_INVALID");
}

function assertMoney(amount: number, currency: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || currency !== "VND") {
    fail("PAYMENT_PROVIDER_AMOUNT_INVALID");
  }
}

function assertToken(value: string, code: string, maxLength: number) {
  if (!value || value.length > maxLength || value.trim() !== value) fail(code);
}

function assertHttpsUrl(value: string, code: string) {
  assertToken(value, code, 2048);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(code);
  }
  if (parsed.protocol !== "https:") fail(code);
}

function assertIso(value: string, code: string) {
  assertToken(value, code, 80);
  if (!Number.isFinite(Date.parse(value))) fail(code);
}

export type PaymentProviderCheckoutCallV1 = {
  idempotencyKey: string;
  intentId: string;
  attemptId: string;
  bookingId: string;
  quoteId: string;
  amount: number;
  currency: Currency;
  returnUrl: string;
  cancelUrl: string;
};

export type PaymentProviderCheckoutResponseV1 = {
  providerReference: string;
  redirectUrl?: string;
  clientToken?: string;
  expiresAt?: string;
};

export type PaymentProviderRefundCallV1 = {
  idempotencyKey: string;
  intentId: string;
  attemptId: string;
  bookingId: string;
  providerReference: string;
  amount: number;
  currency: Currency;
};

export type PaymentProviderRefundResponseV1 = {
  providerRefundReference?: string;
  acceptedAt?: string;
};

export interface PaymentProviderOperationsAdapterV1 {
  readonly id: string;
  createCheckout(
    input: PaymentProviderCheckoutCallV1,
  ): Promise<PaymentProviderCheckoutResponseV1>;
  createRefund(
    input: PaymentProviderRefundCallV1,
  ): Promise<PaymentProviderRefundResponseV1>;
}

export type ExecutePaymentProviderCheckoutInputV1 = {
  request: PaymentCheckoutAttemptRequestV1;
  attempt: PaymentCheckoutAttemptResultV1;
  returnUrl: string;
  cancelUrl: string;
};

export type ExecutePaymentProviderCheckoutResultV1 =
  PaymentProviderCheckoutResponseV1 & {
    provider: string;
  };

function prepareCheckoutCall(
  adapter: PaymentProviderOperationsAdapterV1,
  input: ExecutePaymentProviderCheckoutInputV1,
): PaymentProviderCheckoutCallV1 {
  assertProvider(adapter.id);
  assertProvider(input.request.provider);
  if (adapter.id !== input.request.provider || adapter.id !== input.attempt.provider) {
    fail("PAYMENT_PROVIDER_CHECKOUT_PROVIDER_MISMATCH");
  }
  if (input.request.bookingId !== input.attempt.bookingId) {
    fail("PAYMENT_PROVIDER_CHECKOUT_IDENTITY_MISMATCH");
  }

  assertUuid(input.request.requestKey, "PAYMENT_PROVIDER_CHECKOUT_REQUEST_KEY_INVALID");
  assertUuid(input.attempt.intentId, "PAYMENT_PROVIDER_CHECKOUT_INTENT_ID_INVALID");
  assertUuid(input.attempt.attemptId, "PAYMENT_PROVIDER_CHECKOUT_ATTEMPT_ID_INVALID");
  assertUuid(input.request.bookingId, "PAYMENT_PROVIDER_CHECKOUT_BOOKING_ID_INVALID");
  assertUuid(input.request.quoteId, "PAYMENT_PROVIDER_CHECKOUT_QUOTE_ID_INVALID");
  assertMoney(input.request.amount, input.request.currency);
  assertHttpsUrl(input.returnUrl, "PAYMENT_PROVIDER_CHECKOUT_RETURN_URL_INVALID");
  assertHttpsUrl(input.cancelUrl, "PAYMENT_PROVIDER_CHECKOUT_CANCEL_URL_INVALID");

  return {
    idempotencyKey: input.request.requestKey,
    intentId: input.attempt.intentId,
    attemptId: input.attempt.attemptId,
    bookingId: input.request.bookingId,
    quoteId: input.request.quoteId,
    amount: input.request.amount,
    currency: input.request.currency,
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
  };
}

function validateCheckoutResponse(
  response: PaymentProviderCheckoutResponseV1,
  existingReference?: string,
) {
  assertToken(
    response.providerReference,
    "PAYMENT_PROVIDER_CHECKOUT_REFERENCE_INVALID",
    300,
  );
  if (existingReference && response.providerReference !== existingReference) {
    fail("PAYMENT_PROVIDER_CHECKOUT_REFERENCE_MISMATCH");
  }
  if (response.redirectUrl !== undefined) {
    assertHttpsUrl(
      response.redirectUrl,
      "PAYMENT_PROVIDER_CHECKOUT_REDIRECT_URL_INVALID",
    );
  }
  if (response.clientToken !== undefined) {
    if (!response.clientToken || response.clientToken.length > 8192) {
      fail("PAYMENT_PROVIDER_CHECKOUT_CLIENT_TOKEN_INVALID");
    }
  }
  if (response.expiresAt !== undefined) {
    assertIso(response.expiresAt, "PAYMENT_PROVIDER_CHECKOUT_EXPIRES_AT_INVALID");
  }
}

export async function executePaymentProviderCheckoutV1(
  adapter: PaymentProviderOperationsAdapterV1,
  input: ExecutePaymentProviderCheckoutInputV1,
): Promise<ExecutePaymentProviderCheckoutResultV1> {
  const call = prepareCheckoutCall(adapter, input);
  let response: PaymentProviderCheckoutResponseV1;
  try {
    response = await adapter.createCheckout(call);
  } catch {
    fail("PAYMENT_PROVIDER_CHECKOUT_FAILED");
  }
  validateCheckoutResponse(response, input.attempt.providerReference);
  return { provider: adapter.id, ...response };
}

function prepareRefundCall(
  adapter: PaymentProviderOperationsAdapterV1,
  command: PaymentRefundCommandV1,
): PaymentProviderRefundCallV1 {
  assertProvider(adapter.id);
  assertProvider(command.provider);
  if (adapter.id !== command.provider) {
    fail("PAYMENT_PROVIDER_REFUND_PROVIDER_MISMATCH");
  }
  assertUuid(command.refundRequestId, "PAYMENT_PROVIDER_REFUND_REQUEST_ID_INVALID");
  assertUuid(command.intentId, "PAYMENT_PROVIDER_REFUND_INTENT_ID_INVALID");
  assertUuid(command.attemptId, "PAYMENT_PROVIDER_REFUND_ATTEMPT_ID_INVALID");
  assertUuid(command.bookingId, "PAYMENT_PROVIDER_REFUND_BOOKING_ID_INVALID");
  assertToken(
    command.providerReference,
    "PAYMENT_PROVIDER_REFUND_REFERENCE_INVALID",
    300,
  );
  assertMoney(command.amount, command.currency);

  return {
    idempotencyKey: command.refundRequestId,
    intentId: command.intentId,
    attemptId: command.attemptId,
    bookingId: command.bookingId,
    providerReference: command.providerReference,
    amount: command.amount,
    currency: command.currency,
  };
}

function validateRefundResponse(response: PaymentProviderRefundResponseV1) {
  if (response.providerRefundReference !== undefined) {
    assertToken(
      response.providerRefundReference,
      "PAYMENT_PROVIDER_REFUND_RESULT_REFERENCE_INVALID",
      300,
    );
  }
  if (response.acceptedAt !== undefined) {
    assertIso(response.acceptedAt, "PAYMENT_PROVIDER_REFUND_ACCEPTED_AT_INVALID");
  }
}

export async function executePaymentProviderRefundV1(
  adapter: PaymentProviderOperationsAdapterV1,
  command: PaymentRefundCommandV1,
): Promise<PaymentProviderRefundResponseV1 & { provider: string }> {
  const call = prepareRefundCall(adapter, command);
  let response: PaymentProviderRefundResponseV1;
  try {
    response = await adapter.createRefund(call);
  } catch {
    fail("PAYMENT_PROVIDER_REFUND_FAILED");
  }
  validateRefundResponse(response);
  return { provider: adapter.id, ...response };
}
