import type {
  BindPaymentProviderReferenceInputV1,
  BindPaymentProviderReferenceResultV1,
  PaymentCheckoutAttemptRequestV1,
  PaymentCheckoutAttemptResultV1,
} from "../domain/payment-checkout-contract-v1";
import type { PaymentAttemptStatusV1 } from "../domain/payment-contract-v1";
import type { SqlTransactionManager } from "./postgres-booking-core.server";
import { createPaymentIntentAttemptV1 } from "./postgres-payment-contract-v1.server";

const UUID_V1 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_ID_V1 = /^[a-z0-9][a-z0-9._-]{0,63}$/;

type ExistingAttemptRow = {
  attempt_id: string;
  intent_id: string;
  booking_id: string;
  quote_id: string;
  booking_version: number | string;
  provider: string;
  provider_reference: string | null;
  attempt_status: PaymentAttemptStatusV1;
  amount: number | string;
  currency: string;
};

function fail(code: string): never {
  throw new Error(code);
}

function assertUuid(value: string, code: string) {
  if (!UUID_V1.test(value)) fail(code);
}

function assertProvider(value: string) {
  if (!PROVIDER_ID_V1.test(value)) fail("PAYMENT_PROVIDER_INVALID");
}

function assertMoney(amount: number, currency: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || currency !== "VND") {
    fail("PAYMENT_AMOUNT_INVALID");
  }
}

function asPositiveVersion(value: number | string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail("PAYMENT_BOOKING_RECORD_INVALID");
  }
  return parsed;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

async function readAttemptByRequestKey(
  database: SqlTransactionManager,
  requestKey: string,
): Promise<ExistingAttemptRow | undefined> {
  assertUuid(requestKey, "PAYMENT_REQUEST_KEY_INVALID");
  return database.transaction(async (tx) => {
    const result = await tx.query<ExistingAttemptRow>(
      `select a.id as attempt_id, i.id as intent_id,
              i.booking_id, i.quote_id, b.version as booking_version,
              a.provider, a.provider_reference,
              a.status as attempt_status, a.amount, a.currency
         from payment_attempts_v1 a
         join payment_intents_v1 i on i.id=a.intent_id
         join bookings b on b.id=i.booking_id
        where a.request_key=$1`,
      [requestKey],
    );
    return result.rows[0];
  });
}

function replayResult(
  row: ExistingAttemptRow,
  input: PaymentCheckoutAttemptRequestV1,
): PaymentCheckoutAttemptResultV1 {
  if (
    row.booking_id !== input.bookingId ||
    row.quote_id !== input.quoteId ||
    row.provider !== input.provider ||
    Number(row.amount) !== input.amount ||
    row.currency !== input.currency
  ) {
    fail("PAYMENT_REQUEST_REPLAY_MISMATCH");
  }

  return {
    outcome: "replayed",
    intentId: row.intent_id,
    attemptId: row.attempt_id,
    bookingId: row.booking_id,
    bookingVersion: asPositiveVersion(row.booking_version),
    provider: row.provider,
    ...(row.provider_reference
      ? { providerReference: row.provider_reference }
      : {}),
    attemptStatus: row.attempt_status,
  };
}

/**
 * Idempotent checkout-attempt creation around Payment Contract V1.
 *
 * `requestKey` is the retry identity. A retry may regenerate proposed intent
 * and attempt UUIDs, but the existing canonical IDs win when the commercial
 * identity matches exactly. A mismatched reuse of the same request key fails
 * closed.
 */
export async function createOrReplayPaymentIntentAttemptV1(
  database: SqlTransactionManager,
  input: PaymentCheckoutAttemptRequestV1,
  now = new Date(),
): Promise<PaymentCheckoutAttemptResultV1> {
  assertUuid(input.requestKey, "PAYMENT_REQUEST_KEY_INVALID");
  assertProvider(input.provider);
  assertMoney(input.amount, input.currency);

  const existing = await readAttemptByRequestKey(database, input.requestKey);
  if (existing) return replayResult(existing, input);

  try {
    const created = await createPaymentIntentAttemptV1(database, input, now);
    return {
      outcome: "created",
      ...created,
      provider: input.provider,
      attemptStatus: "created",
    };
  } catch (error) {
    const canRecover =
      errorMessage(error) === "PAYMENT_INTENT_ALREADY_EXISTS" ||
      isUniqueViolation(error);
    if (!canRecover) throw error;

    const raced = await readAttemptByRequestKey(database, input.requestKey);
    if (!raced) throw error;
    return replayResult(raced, input);
  }
}

function validateBindInput(input: BindPaymentProviderReferenceInputV1) {
  assertUuid(input.attemptId, "PAYMENT_ATTEMPT_ID_INVALID");
  assertUuid(input.bookingId, "PAYMENT_BOOKING_ID_INVALID");
  assertUuid(input.quoteId, "PAYMENT_QUOTE_ID_INVALID");
  assertProvider(input.provider);
  assertMoney(input.amount, input.currency);
  if (
    !input.providerReference ||
    input.providerReference.length > 300 ||
    input.providerReference.trim() !== input.providerReference
  ) {
    fail("PAYMENT_PROVIDER_REFERENCE_INVALID");
  }
}

/**
 * Attaches the provider's stable payment/session reference to a known attempt.
 * Exact replays are idempotent. Cross-attempt reuse or identity drift fails
 * closed. No secret, redirect URL, guest PII or raw provider payload is stored.
 */
export async function bindPaymentProviderReferenceV1(
  database: SqlTransactionManager,
  input: BindPaymentProviderReferenceInputV1,
  now = new Date(),
): Promise<BindPaymentProviderReferenceResultV1> {
  validateBindInput(input);
  if (!Number.isFinite(now.getTime())) fail("PAYMENT_TIME_INVALID");

  try {
    return await database.transaction(async (tx) => {
      const result = await tx.query<ExistingAttemptRow>(
        `select a.id as attempt_id, i.id as intent_id,
                i.booking_id, i.quote_id, b.version as booking_version,
                a.provider, a.provider_reference,
                a.status as attempt_status, a.amount, a.currency
           from payment_attempts_v1 a
           join payment_intents_v1 i on i.id=a.intent_id
           join bookings b on b.id=i.booking_id
          where a.id=$1
          for update of a`,
        [input.attemptId],
      );
      const row = result.rows[0];
      if (!row) fail("PAYMENT_ATTEMPT_NOT_FOUND");

      if (
        row.booking_id !== input.bookingId ||
        row.quote_id !== input.quoteId ||
        row.provider !== input.provider ||
        Number(row.amount) !== input.amount ||
        row.currency !== input.currency
      ) {
        fail("PAYMENT_PROVIDER_REFERENCE_IDENTITY_MISMATCH");
      }

      if (row.provider_reference) {
        if (row.provider_reference !== input.providerReference) {
          fail("PAYMENT_PROVIDER_REFERENCE_MISMATCH");
        }
        return {
          outcome: "replayed" as const,
          intentId: row.intent_id,
          attemptId: row.attempt_id,
          bookingId: row.booking_id,
          provider: row.provider,
          providerReference: row.provider_reference,
          attemptStatus: row.attempt_status,
        };
      }

      const collision = await tx.query<{ id: string }>(
        `select id
           from payment_attempts_v1
          where provider=$1 and provider_reference=$2 and id<>$3`,
        [input.provider, input.providerReference, input.attemptId],
      );
      if (collision.rows.length) {
        fail("PAYMENT_PROVIDER_REFERENCE_ALREADY_BOUND");
      }

      await tx.query(
        `update payment_attempts_v1
            set provider_reference=$2, updated_at=$3
          where id=$1`,
        [input.attemptId, input.providerReference, now.toISOString()],
      );

      return {
        outcome: "attached" as const,
        intentId: row.intent_id,
        attemptId: row.attempt_id,
        bookingId: row.booking_id,
        provider: row.provider,
        providerReference: input.providerReference,
        attemptStatus: row.attempt_status,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      fail("PAYMENT_PROVIDER_REFERENCE_ALREADY_BOUND");
    }
    throw error;
  }
}
