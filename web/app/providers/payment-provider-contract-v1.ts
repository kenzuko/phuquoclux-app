import type {
  VerifiedPaymentEventInputV1,
  VerifiedPaymentEventStatusV1,
} from "../domain/payment-contract-v1";

export const PAYMENT_WEBHOOK_MAX_BODY_BYTES_V1 = 64 * 1024;
const PAYMENT_WEBHOOK_MAX_CONFIG_BYTES_V1 = 1024 * 1024;
const PROVIDER_ID_V1 = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const UUID_V1 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_STATUSES_V1 = new Set<VerifiedPaymentEventStatusV1>([
  "authorized",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
]);

export class PaymentProviderContractErrorV1 extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number) {
    super(code);
    this.name = "PaymentProviderContractErrorV1";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type PaymentWebhookPreparePolicyV1 = {
  maxBodyBytes?: number;
  acceptedContentTypes?: readonly string[];
};

export type PaymentWebhookPrepareContextV1 = {
  requestId: string;
  receivedAt: string;
  policy?: PaymentWebhookPreparePolicyV1;
};

export type PreparedPaymentWebhookV1 = {
  requestId: string;
  receivedAt: string;
  rawBody: Uint8Array;
  payloadHash: string;
  headers: Readonly<Record<string, string>>;
  contentType?: string;
};

export type PaymentProviderWebhookInputV1 = Pick<
  PreparedPaymentWebhookV1,
  "requestId" | "receivedAt" | "rawBody" | "headers" | "contentType"
>;

export type NormalizedPaymentProviderEventV1 = Omit<
  VerifiedPaymentEventInputV1,
  "provider" | "payloadHash"
>;

export interface PaymentProviderAdapterV1 {
  readonly id: string;

  /**
   * Verify the provider signature against the exact raw bytes before parsing.
   * Secrets must be injected into the concrete adapter at runtime and must not
   * be returned, logged or persisted by this contract.
   */
  verifyWebhook(
    input: PaymentProviderWebhookInputV1,
  ): Promise<NormalizedPaymentProviderEventV1>;
}

function fail(code: string, httpStatus: number): never {
  throw new PaymentProviderContractErrorV1(code, httpStatus);
}

function assertToken(value: string, code: string, maxLength = 200) {
  if (!value || value.length > maxLength || value.trim() !== value) {
    fail(code, 422);
  }
}

function assertUuid(value: string, code: string) {
  if (!UUID_V1.test(value)) fail(code, 422);
}

function assertIsoTimestamp(value: string, code: string) {
  assertToken(value, code, 80);
  if (!Number.isFinite(Date.parse(value))) fail(code, 422);
}

function assertMoney(amount: number, currency: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || currency !== "VND") {
    fail("PAYMENT_WEBHOOK_AMOUNT_INVALID", 422);
  }
}

function normalizeContentType(value: string | null) {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeHeaders(headers: Headers) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    normalized[key.toLowerCase()] = value;
  }
  return Object.freeze(normalized);
}

function validatePreparePolicy(policy: PaymentWebhookPreparePolicyV1 | undefined) {
  const maxBodyBytes = policy?.maxBodyBytes ?? PAYMENT_WEBHOOK_MAX_BODY_BYTES_V1;
  if (
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes < 1 ||
    maxBodyBytes > PAYMENT_WEBHOOK_MAX_CONFIG_BYTES_V1
  ) {
    fail("PAYMENT_WEBHOOK_POLICY_INVALID", 500);
  }

  const acceptedContentTypes = policy?.acceptedContentTypes?.map((value) =>
    value.trim().toLowerCase(),
  );
  if (acceptedContentTypes?.some((value) => !value || value.includes(";"))) {
    fail("PAYMENT_WEBHOOK_POLICY_INVALID", 500);
  }

  return {
    maxBodyBytes,
    acceptedContentTypes: acceptedContentTypes
      ? new Set(acceptedContentTypes)
      : undefined,
  };
}

async function sha256Hex(rawBody: Uint8Array) {
  const bytes = rawBody.slice();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function preparePaymentWebhookV1(
  request: Request,
  context: PaymentWebhookPrepareContextV1,
): Promise<PreparedPaymentWebhookV1> {
  assertToken(context.requestId, "PAYMENT_WEBHOOK_REQUEST_ID_INVALID", 200);
  assertIsoTimestamp(context.receivedAt, "PAYMENT_WEBHOOK_RECEIVED_AT_INVALID");

  if (request.method.toUpperCase() !== "POST") {
    fail("PAYMENT_WEBHOOK_METHOD_NOT_ALLOWED", 405);
  }
  if (request.bodyUsed) {
    fail("PAYMENT_WEBHOOK_BODY_ALREADY_USED", 400);
  }

  const { maxBodyBytes, acceptedContentTypes } = validatePreparePolicy(
    context.policy,
  );
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      fail("PAYMENT_WEBHOOK_CONTENT_LENGTH_INVALID", 400);
    }
    if (parsedLength > maxBodyBytes) {
      fail("PAYMENT_WEBHOOK_BODY_TOO_LARGE", 413);
    }
  }

  const contentType = normalizeContentType(request.headers.get("content-type"));
  if (
    acceptedContentTypes &&
    (!contentType || !acceptedContentTypes.has(contentType))
  ) {
    fail("PAYMENT_WEBHOOK_CONTENT_TYPE_UNSUPPORTED", 415);
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.byteLength === 0) {
    fail("PAYMENT_WEBHOOK_BODY_EMPTY", 400);
  }
  if (rawBody.byteLength > maxBodyBytes) {
    fail("PAYMENT_WEBHOOK_BODY_TOO_LARGE", 413);
  }

  return {
    requestId: context.requestId,
    receivedAt: context.receivedAt,
    rawBody,
    payloadHash: await sha256Hex(rawBody),
    headers: normalizeHeaders(request.headers),
    contentType,
  };
}

export async function verifyPaymentWebhookV1(
  adapter: PaymentProviderAdapterV1,
  prepared: PreparedPaymentWebhookV1,
): Promise<VerifiedPaymentEventInputV1> {
  if (!PROVIDER_ID_V1.test(adapter.id)) {
    fail("PAYMENT_PROVIDER_INVALID", 500);
  }

  let event: NormalizedPaymentProviderEventV1;
  try {
    event = await adapter.verifyWebhook({
      requestId: prepared.requestId,
      receivedAt: prepared.receivedAt,
      rawBody: prepared.rawBody,
      headers: prepared.headers,
      contentType: prepared.contentType,
    });
  } catch {
    fail("PAYMENT_WEBHOOK_VERIFICATION_FAILED", 401);
  }

  assertUuid(event.attemptId, "PAYMENT_WEBHOOK_ATTEMPT_ID_INVALID");
  assertUuid(event.bookingId, "PAYMENT_WEBHOOK_BOOKING_ID_INVALID");
  assertUuid(event.quoteId, "PAYMENT_WEBHOOK_QUOTE_ID_INVALID");
  assertToken(event.providerEventId, "PAYMENT_WEBHOOK_EVENT_ID_INVALID", 200);
  if (event.providerReference !== undefined) {
    assertToken(
      event.providerReference,
      "PAYMENT_WEBHOOK_PROVIDER_REFERENCE_INVALID",
      300,
    );
  }
  if (!EVENT_STATUSES_V1.has(event.status)) {
    fail("PAYMENT_WEBHOOK_STATUS_INVALID", 422);
  }
  assertMoney(event.amount, event.currency);
  assertIsoTimestamp(event.occurredAt, "PAYMENT_WEBHOOK_OCCURRED_AT_INVALID");

  return {
    ...event,
    provider: adapter.id,
    payloadHash: prepared.payloadHash,
  };
}
