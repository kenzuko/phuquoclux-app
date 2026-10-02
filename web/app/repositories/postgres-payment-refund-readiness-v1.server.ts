import type { PaymentRefundCommandV1, PaymentRefundRequestV1 } from "../domain/payment-refund-contract-v1";
import type { PaymentAttemptStatusV1, PaymentIntentStatusV1 } from "../domain/payment-contract-v1";
import type { PaymentStatus } from "../domain/commerce";
import type { SqlTransactionManager } from "./postgres-booking-core.server";
import { beginRefundV1 } from "./postgres-payment-contract-v1.server";

const UUID_V1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(code: string): never {
  throw new Error(code);
}

function assertInput(input: PaymentRefundRequestV1) {
  if (!UUID_V1.test(input.bookingId)) fail("PAYMENT_BOOKING_ID_INVALID");
  if (!Number.isSafeInteger(input.expectedBookingVersion) || input.expectedBookingVersion <= 0) {
    fail("PAYMENT_REFUND_VERSION_INVALID");
  }
}

function asPositiveVersion(value: number | string, code: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) fail(code);
  return parsed;
}

function asRefundablePaymentStatus(value: string): Extract<PaymentStatus, "paid" | "partially_refunded"> {
  if (value !== "paid" && value !== "partially_refunded") {
    fail("PAYMENT_REFUND_PAYMENT_STATUS_INVALID");
  }
  return value;
}

type RefundStateRow = {
  intent_id: string;
  intent_status: PaymentIntentStatusV1;
  intent_version: number | string;
  intent_amount: number | string;
  intent_currency: string;
  booking_state: string;
  booking_version: number | string;
  payment_status: string;
};

type RefundAttemptRow = {
  attempt_id: string;
  provider: string;
  provider_reference: string | null;
  attempt_status: PaymentAttemptStatusV1;
  amount: number | string;
  currency: string;
};

async function readState(database: SqlTransactionManager, bookingId: string): Promise<RefundStateRow> {
  return database.transaction(async (tx) => {
    const result = await tx.query<RefundStateRow>(
      `select i.id as intent_id, i.status as intent_status,
              i.version as intent_version, i.amount as intent_amount,
              i.currency as intent_currency,
              b.state as booking_state, b.version as booking_version,
              b.payment_status
         from payment_intents_v1 i
         join bookings b on b.id=i.booking_id
        where i.booking_id=$1`,
      [bookingId],
    );
    const row = result.rows[0];
    if (!row) fail("PAYMENT_INTENT_NOT_FOUND");
    return row;
  });
}

async function readSingleRefundableAttempt(
  database: SqlTransactionManager,
  state: RefundStateRow,
): Promise<RefundAttemptRow> {
  return database.transaction(async (tx) => {
    const result = await tx.query<RefundAttemptRow>(
      `select id as attempt_id, provider, provider_reference,
              status as attempt_status, amount, currency
         from payment_attempts_v1
        where intent_id=$1
          and status in ('paid', 'partially_refunded')
        order by created_at desc`,
      [state.intent_id],
    );
    if (result.rows.length !== 1) {
      fail(result.rows.length === 0
        ? "PAYMENT_REFUND_ATTEMPT_NOT_FOUND"
        : "PAYMENT_REFUND_ATTEMPT_AMBIGUOUS");
    }
    const attempt = result.rows[0]!;
    if (!attempt.provider_reference) fail("PAYMENT_REFUND_PROVIDER_REFERENCE_MISSING");
    if (
      Number(attempt.amount) !== Number(state.intent_amount) ||
      attempt.currency !== state.intent_currency
    ) {
      fail("PAYMENT_REFUND_COMMERCIAL_INTEGRITY_MISMATCH");
    }
    return attempt;
  });
}

async function readExistingCommand(
  database: SqlTransactionManager,
  input: PaymentRefundRequestV1,
): Promise<Omit<PaymentRefundCommandV1, "outcome"> | undefined> {
  const state = await readState(database, input.bookingId);
  if (state.booking_state !== "refund_pending" || state.intent_status !== "refund_pending") {
    return undefined;
  }

  const bookingVersion = asPositiveVersion(state.booking_version, "PAYMENT_BOOKING_RECORD_INVALID");
  if (bookingVersion !== input.expectedBookingVersion + 1) {
    fail("PAYMENT_REFUND_VERSION_CONFLICT");
  }
  const intentVersion = asPositiveVersion(state.intent_version, "PAYMENT_INTENT_RECORD_INVALID");
  const paymentStatus = asRefundablePaymentStatus(state.payment_status);
  const attempt = await readSingleRefundableAttempt(database, state);

  return database.transaction(async (tx) => {
    const events = await tx.query<{ id: string }>(
      `select id
         from outbox_events
        where event_name='payment.refund_requested'
          and aggregate_type='payment_intent'
          and aggregate_id=$1
          and aggregate_version=$2
          and payload->>'bookingId'=$3`,
      [state.intent_id, intentVersion, input.bookingId],
    );
    if (events.rows.length !== 1) {
      fail(events.rows.length === 0
        ? "PAYMENT_REFUND_COMMAND_MISSING"
        : "PAYMENT_REFUND_COMMAND_AMBIGUOUS");
    }

    return {
      refundRequestId: events.rows[0]!.id,
      bookingId: input.bookingId,
      bookingState: "refund_pending" as const,
      bookingVersion,
      paymentStatus,
      intentId: state.intent_id,
      intentVersion,
      attemptId: attempt.attempt_id,
      provider: attempt.provider,
      providerReference: attempt.provider_reference!,
      amount: Number(state.intent_amount),
      currency: state.intent_currency as "VND",
    };
  });
}

async function assertRefundTargetReady(
  database: SqlTransactionManager,
  input: PaymentRefundRequestV1,
) {
  const state = await readState(database, input.bookingId);
  const bookingVersion = asPositiveVersion(state.booking_version, "PAYMENT_BOOKING_RECORD_INVALID");
  if (bookingVersion !== input.expectedBookingVersion) {
    fail("PAYMENT_REFUND_VERSION_CONFLICT");
  }
  await readSingleRefundableAttempt(database, state);
}

/**
 * Builds one durable outbound refund command around Payment Contract V1.
 *
 * The `payment.refund_requested` outbox event ID is the provider idempotency
 * identity. It is committed by `beginRefundV1` in the same transaction as the
 * booking/intent transition to `refund_pending`, so a crash after commit can
 * recover the exact same command without inventing a second provider refund.
 */
export async function prepareOrReplayPaymentRefundV1(
  database: SqlTransactionManager,
  input: PaymentRefundRequestV1,
  now = new Date(),
): Promise<PaymentRefundCommandV1> {
  assertInput(input);
  if (!Number.isFinite(now.getTime())) fail("PAYMENT_TIME_INVALID");

  const existing = await readExistingCommand(database, input);
  if (existing) return { outcome: "replayed", ...existing };

  await assertRefundTargetReady(database, input);

  try {
    await beginRefundV1(database, input, now);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "PAYMENT_REFUND_VERSION_CONFLICT") {
      throw error;
    }
    const raced = await readExistingCommand(database, input);
    if (!raced) throw error;
    return { outcome: "replayed", ...raced };
  }

  const created = await readExistingCommand(database, input);
  if (!created) fail("PAYMENT_REFUND_COMMAND_MISSING");
  return { outcome: "created", ...created };
}
