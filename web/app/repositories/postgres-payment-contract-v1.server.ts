/**
 * Payment Contract V1 - OFFLINE / PROVIDER-NEUTRAL ONLY.
 *
 * This module deliberately has no public route, Worker binding or concrete
 * payment provider. Its schema lives under db/contracts, not db/migrations.
 * It is exercised only against disposable PostgreSQL until a production
 * payment target/provider is selected and separately activated.
 */
import type {
  BeginRefundInputV1,
  CreatePaymentIntentAttemptInputV1,
  PaymentAttemptStatusV1,
  PaymentEventApplyResultV1,
  PaymentIntentStatusV1,
  VerifiedPaymentEventInputV1,
} from "../domain/payment-contract-v1";
import type { BookingState, PaymentStatus } from "../domain/commerce";
import type { SqlTransaction, SqlTransactionManager } from "./postgres-booking-core.server";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const EVENT_STATUSES = new Set([
  "authorized",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
]);

function positiveMoney(amount: number, currency: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || currency !== "VND") {
    throw new Error("PAYMENT_AMOUNT_INVALID");
  }
}

function validProvider(provider: string) {
  if (!PROVIDER_ID.test(provider)) {
    throw new Error("PAYMENT_PROVIDER_INVALID");
  }
}

function validDate(value: string, code: string) {
  if (!Number.isFinite(new Date(value).getTime())) throw new Error(code);
}

function asPositiveVersion(value: number | string, code: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(code);
  return parsed;
}

function asBookingState(value: string): BookingState {
  const states = new Set<BookingState>([
    "draft",
    "pending_payment",
    "paid",
    "pending_confirmation",
    "confirmed",
    "fulfilled",
    "cancel_requested",
    "cancelled",
    "refund_pending",
    "refunded",
    "failed",
    "expired",
  ]);
  if (!states.has(value as BookingState)) {
    throw new Error("PAYMENT_BOOKING_RECORD_INVALID");
  }
  return value as BookingState;
}

function asPaymentStatus(value: string): PaymentStatus {
  const states = new Set<PaymentStatus>([
    "unpaid",
    "authorized",
    "paid",
    "partially_refunded",
    "refunded",
    "failed",
  ]);
  if (!states.has(value as PaymentStatus)) {
    throw new Error("PAYMENT_BOOKING_RECORD_INVALID");
  }
  return value as PaymentStatus;
}

function assertAttemptTransition(
  from: PaymentAttemptStatusV1,
  to: VerifiedPaymentEventInputV1["status"],
) {
  const allowed: Record<PaymentAttemptStatusV1, ReadonlySet<string>> = {
    created: new Set(["authorized", "paid", "failed"]),
    authorized: new Set(["authorized", "paid", "failed"]),
    paid: new Set(["partially_refunded", "refunded"]),
    partially_refunded: new Set(["partially_refunded", "refunded"]),
    refunded: new Set([]),
    failed: new Set([]),
  };
  if (!allowed[from].has(to)) {
    throw new Error(`PAYMENT_ATTEMPT_TRANSITION_INVALID:${from}->${to}`);
  }
}

function targetForEvent(
  eventStatus: VerifiedPaymentEventInputV1["status"],
  bookingState: BookingState,
  paymentStatus: PaymentStatus,
): {
  bookingState: BookingState;
  paymentStatus: PaymentStatus;
  intentStatus: PaymentIntentStatusV1;
  reason: string | null;
} {
  if (
    eventStatus === "authorized" &&
    bookingState === "pending_payment" &&
    (paymentStatus === "unpaid" || paymentStatus === "authorized")
  ) {
    return {
      bookingState,
      paymentStatus: "authorized",
      intentStatus: "authorized",
      reason: null,
    };
  }
  if (
    eventStatus === "paid" &&
    bookingState === "pending_payment" &&
    (paymentStatus === "unpaid" || paymentStatus === "authorized")
  ) {
    return {
      bookingState: "paid",
      paymentStatus: "paid",
      intentStatus: "paid",
      reason: "PAYMENT_CAPTURED",
    };
  }
  if (
    eventStatus === "failed" &&
    bookingState === "pending_payment" &&
    (paymentStatus === "unpaid" || paymentStatus === "authorized")
  ) {
    return {
      bookingState: "failed",
      paymentStatus: "failed",
      intentStatus: "failed",
      reason: "PAYMENT_FAILED",
    };
  }
  if (
    eventStatus === "partially_refunded" &&
    bookingState === "refund_pending" &&
    (paymentStatus === "paid" || paymentStatus === "partially_refunded")
  ) {
    return {
      bookingState,
      paymentStatus: "partially_refunded",
      intentStatus: "partially_refunded",
      reason: null,
    };
  }
  if (
    eventStatus === "refunded" &&
    bookingState === "refund_pending" &&
    (paymentStatus === "paid" || paymentStatus === "partially_refunded")
  ) {
    return {
      bookingState: "refunded",
      paymentStatus: "refunded",
      intentStatus: "refunded",
      reason: "PAYMENT_REFUNDED",
    };
  }
  throw new Error(
    `PAYMENT_EVENT_BOOKING_STATE_INVALID:${bookingState}:${paymentStatus}:${eventStatus}`,
  );
}

async function appendBookingStateEvent(
  tx: SqlTransaction,
  input: {
    bookingId: string;
    fromState: BookingState;
    toState: BookingState;
    version: number;
    reason: string;
    now: string;
  },
) {
  await tx.query(
    `insert into booking_events
      (id, booking_id, from_state, to_state, version, reason, payload, created_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      crypto.randomUUID(),
      input.bookingId,
      input.fromState,
      input.toState,
      input.version,
      input.reason,
      JSON.stringify({ source: "payment_contract_v1" }),
      input.now,
    ],
  );

  await tx.query(
    `insert into outbox_events
      (id, event_name, aggregate_type, aggregate_id, aggregate_version,
       payload, status, created_at)
     values ($1, 'booking.state_changed', 'booking', $2, $3,
             $4::jsonb, 'pending', $5)`,
    [
      crypto.randomUUID(),
      input.bookingId,
      input.version,
      JSON.stringify({
        bookingId: input.bookingId,
        fromState: input.fromState,
        toState: input.toState,
        version: input.version,
        reasonCode: input.reason,
        source: "payment_contract_v1",
      }),
      input.now,
    ],
  );
}

async function appendPaymentOutbox(
  tx: SqlTransaction,
  input: {
    eventName: "payment.status_changed" | "payment.refund_requested";
    intentId: string;
    intentVersion: number;
    bookingId: string;
    paymentStatus?: PaymentStatus;
    eventStatus?: string;
    now: string;
  },
) {
  await tx.query(
    `insert into outbox_events
      (id, event_name, aggregate_type, aggregate_id, aggregate_version,
       payload, status, created_at)
     values ($1, $2, 'payment_intent', $3, $4, $5::jsonb, 'pending', $6)`,
    [
      crypto.randomUUID(),
      input.eventName,
      input.intentId,
      input.intentVersion,
      JSON.stringify({
        paymentIntentId: input.intentId,
        bookingId: input.bookingId,
        intentVersion: input.intentVersion,
        ...(input.paymentStatus
          ? { paymentStatus: input.paymentStatus }
          : {}),
        ...(input.eventStatus ? { eventStatus: input.eventStatus } : {}),
      }),
      input.now,
    ],
  );
}

export async function createPaymentIntentAttemptV1(
  database: SqlTransactionManager,
  input: CreatePaymentIntentAttemptInputV1,
  now = new Date(),
) {
  validProvider(input.provider);
  positiveMoney(input.amount, input.currency);
  if (!Number.isFinite(now.getTime())) throw new Error("PAYMENT_TIME_INVALID");

  return database.transaction(async (tx) => {
    const bookingResult = await tx.query<{
      id: string;
      quote_id: string;
      state: string;
      version: number | string;
      payment_status: string;
      total_amount: number | string;
      currency: string;
      quote_status: string;
      quote_price_state: string;
      quote_total_amount: number | string;
      quote_currency: string;
    }>(
      `select b.id, b.quote_id, b.state, b.version, b.payment_status,
              b.total_amount, b.currency,
              q.status as quote_status, q.price_state as quote_price_state,
              q.total_amount as quote_total_amount,
              q.currency as quote_currency
         from bookings b
         join quotes q on q.id=b.quote_id
        where b.id=$1
        for update of b`,
      [input.bookingId],
    );
    const booking = bookingResult.rows[0];
    if (!booking) throw new Error("PAYMENT_BOOKING_NOT_FOUND");
    if (booking.quote_id !== input.quoteId) {
      throw new Error("PAYMENT_QUOTE_MISMATCH");
    }
    if (
      booking.state !== "pending_payment" ||
      booking.payment_status !== "unpaid" ||
      booking.quote_status !== "accepted" ||
      booking.quote_price_state !== "final"
    ) {
      throw new Error("PAYMENT_BOOKING_NOT_READY");
    }
    const bookingAmount = Number(booking.total_amount);
    const quoteAmount = Number(booking.quote_total_amount);
    if (
      bookingAmount !== input.amount ||
      quoteAmount !== input.amount ||
      booking.currency !== input.currency ||
      booking.quote_currency !== input.currency
    ) {
      throw new Error("PAYMENT_COMMERCIAL_INTEGRITY_MISMATCH");
    }

    const existing = await tx.query<{ id: string }>(
      `select id from payment_intents_v1 where booking_id=$1`,
      [input.bookingId],
    );
    if (existing.rows.length) throw new Error("PAYMENT_INTENT_ALREADY_EXISTS");

    const timestamp = now.toISOString();
    await tx.query(
      `insert into payment_intents_v1
        (id, booking_id, quote_id, status, version, amount, currency,
         created_at, updated_at)
       values ($1, $2, $3, 'pending', 1, $4, $5, $6, $6)`,
      [
        input.intentId,
        input.bookingId,
        input.quoteId,
        input.amount,
        input.currency,
        timestamp,
      ],
    );
    await tx.query(
      `insert into payment_attempts_v1
        (id, intent_id, provider, request_key, status, amount, currency,
         created_at, updated_at)
       values ($1, $2, $3, $4, 'created', $5, $6, $7, $7)`,
      [
        input.attemptId,
        input.intentId,
        input.provider,
        input.requestKey,
        input.amount,
        input.currency,
        timestamp,
      ],
    );

    return {
      intentId: input.intentId,
      attemptId: input.attemptId,
      bookingId: input.bookingId,
      bookingVersion: asPositiveVersion(
        booking.version,
        "PAYMENT_BOOKING_RECORD_INVALID",
      ),
    };
  });
}

export async function recordVerifiedPaymentEventV1(
  database: SqlTransactionManager,
  input: VerifiedPaymentEventInputV1,
  now = new Date(),
): Promise<PaymentEventApplyResultV1> {
  validProvider(input.provider);
  positiveMoney(input.amount, input.currency);
  if (!EVENT_STATUSES.has(input.status)) {
    throw new Error("PAYMENT_EVENT_STATUS_INVALID");
  }
  if (!input.providerEventId || input.providerEventId.length > 200) {
    throw new Error("PAYMENT_PROVIDER_EVENT_ID_INVALID");
  }
  if (!SHA256_HEX.test(input.payloadHash)) {
    throw new Error("PAYMENT_PAYLOAD_HASH_INVALID");
  }
  validDate(input.occurredAt, "PAYMENT_OCCURRED_AT_INVALID");
  if (!Number.isFinite(now.getTime())) throw new Error("PAYMENT_TIME_INVALID");

  return database.transaction(async (tx) => {
    const receivedAt = now.toISOString();
    const claim = await tx.query<{ provider_event_id: string }>(
      `insert into payment_receipts_v1
        (provider, provider_event_id, attempt_id, payload_hash, event_status,
         received_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (provider, provider_event_id) do nothing
       returning provider_event_id`,
      [
        input.provider,
        input.providerEventId,
        input.attemptId,
        input.payloadHash,
        input.status,
        receivedAt,
      ],
    );

    if (!claim.rows.length) {
      const replay = await tx.query<{
        attempt_id: string;
        payload_hash: string;
        event_status: string;
        result_payment_status: string | null;
        result_booking_state: string | null;
        result_booking_version: number | string | null;
      }>(
        `select attempt_id, payload_hash, event_status, result_payment_status,
                result_booking_state, result_booking_version
           from payment_receipts_v1
          where provider=$1 and provider_event_id=$2`,
        [input.provider, input.providerEventId],
      );
      const receipt = replay.rows[0];
      if (!receipt || receipt.payload_hash !== input.payloadHash) {
        throw new Error("PAYMENT_RECEIPT_REPLAY_MISMATCH");
      }
      if (
        receipt.attempt_id !== input.attemptId ||
        receipt.event_status !== input.status
      ) {
        throw new Error("PAYMENT_RECEIPT_REPLAY_MISMATCH");
      }
      if (
        !receipt.result_payment_status ||
        !receipt.result_booking_state ||
        receipt.result_booking_version === null
      ) {
        throw new Error("PAYMENT_RECEIPT_INCOMPLETE");
      }
      return {
        outcome: "replayed" as const,
        bookingId: input.bookingId,
        bookingState: asBookingState(receipt.result_booking_state),
        bookingVersion: asPositiveVersion(
          receipt.result_booking_version,
          "PAYMENT_RECEIPT_INCOMPLETE",
        ),
        paymentStatus: asPaymentStatus(receipt.result_payment_status),
      };
    }

    const rows = await tx.query<{
      attempt_id: string;
      attempt_provider: string;
      provider_reference: string | null;
      attempt_status: PaymentAttemptStatusV1;
      attempt_amount: number | string;
      attempt_currency: string;
      intent_id: string;
      intent_status: PaymentIntentStatusV1;
      intent_version: number | string;
      intent_booking_id: string;
      intent_quote_id: string;
      intent_amount: number | string;
      intent_currency: string;
      booking_state: string;
      booking_version: number | string;
      booking_payment_status: string;
      booking_total_amount: number | string;
      booking_currency: string;
      booking_quote_id: string;
      quote_total_amount: number | string;
      quote_currency: string;
      quote_price_state: string;
    }>(
      `select a.id as attempt_id, a.provider as attempt_provider,
              a.provider_reference, a.status as attempt_status,
              a.amount as attempt_amount, a.currency as attempt_currency,
              i.id as intent_id, i.status as intent_status,
              i.version as intent_version, i.booking_id as intent_booking_id,
              i.quote_id as intent_quote_id, i.amount as intent_amount,
              i.currency as intent_currency,
              b.state as booking_state, b.version as booking_version,
              b.payment_status as booking_payment_status,
              b.total_amount as booking_total_amount,
              b.currency as booking_currency, b.quote_id as booking_quote_id,
              q.total_amount as quote_total_amount, q.currency as quote_currency,
              q.price_state as quote_price_state
         from payment_attempts_v1 a
         join payment_intents_v1 i on i.id=a.intent_id
         join bookings b on b.id=i.booking_id
         join quotes q on q.id=i.quote_id
        where a.id=$1
        for update of a, i, b`,
      [input.attemptId],
    );
    const row = rows.rows[0];
    if (!row) throw new Error("PAYMENT_ATTEMPT_NOT_FOUND");

    if (
      row.attempt_provider !== input.provider ||
      row.intent_booking_id !== input.bookingId ||
      row.intent_quote_id !== input.quoteId ||
      row.booking_quote_id !== input.quoteId ||
      row.quote_price_state !== "final"
    ) {
      throw new Error("PAYMENT_IDENTITY_INTEGRITY_MISMATCH");
    }
    if (
      Number(row.attempt_amount) !== input.amount ||
      Number(row.intent_amount) !== input.amount ||
      Number(row.booking_total_amount) !== input.amount ||
      Number(row.quote_total_amount) !== input.amount ||
      row.attempt_currency !== input.currency ||
      row.intent_currency !== input.currency ||
      row.booking_currency !== input.currency ||
      row.quote_currency !== input.currency
    ) {
      throw new Error("PAYMENT_COMMERCIAL_INTEGRITY_MISMATCH");
    }
    if (
      row.provider_reference &&
      input.providerReference &&
      row.provider_reference !== input.providerReference
    ) {
      throw new Error("PAYMENT_PROVIDER_REFERENCE_MISMATCH");
    }

    assertAttemptTransition(row.attempt_status, input.status);
    const currentBookingState = asBookingState(row.booking_state);
    const currentPaymentStatus = asPaymentStatus(row.booking_payment_status);
    const target = targetForEvent(
      input.status,
      currentBookingState,
      currentPaymentStatus,
    );
    const bookingVersion = asPositiveVersion(
      row.booking_version,
      "PAYMENT_BOOKING_RECORD_INVALID",
    );
    const intentVersion = asPositiveVersion(
      row.intent_version,
      "PAYMENT_INTENT_RECORD_INVALID",
    );
    const nextIntentVersion = intentVersion + 1;

    await tx.query(
      `update payment_attempts_v1
          set provider_reference=coalesce(provider_reference, $2),
              status=$3,
              updated_at=$4
        where id=$1`,
      [
        input.attemptId,
        input.providerReference ?? null,
        input.status,
        receivedAt,
      ],
    );
    await tx.query(
      `update payment_intents_v1
          set status=$2, version=version+1, updated_at=$3
        where id=$1 and version=$4`,
      [row.intent_id, target.intentStatus, receivedAt, intentVersion],
    );

    let nextBookingVersion = bookingVersion;
    if (target.bookingState !== currentBookingState) {
      nextBookingVersion += 1;
      const updated = await tx.query<{ id: string }>(
        `update bookings
            set state=$2, payment_status=$3, version=version+1, updated_at=$4
          where id=$1 and version=$5 and state=$6 and payment_status=$7
          returning id`,
        [
          input.bookingId,
          target.bookingState,
          target.paymentStatus,
          receivedAt,
          bookingVersion,
          currentBookingState,
          currentPaymentStatus,
        ],
      );
      if (!updated.rows.length) throw new Error("PAYMENT_BOOKING_CONFLICT");
      await appendBookingStateEvent(tx, {
        bookingId: input.bookingId,
        fromState: currentBookingState,
        toState: target.bookingState,
        version: nextBookingVersion,
        reason: target.reason ?? "PAYMENT_STATE_CHANGED",
        now: receivedAt,
      });
    } else if (target.paymentStatus !== currentPaymentStatus) {
      const updated = await tx.query<{ id: string }>(
        `update bookings
            set payment_status=$2, updated_at=$3
          where id=$1 and version=$4 and state=$5 and payment_status=$6
          returning id`,
        [
          input.bookingId,
          target.paymentStatus,
          receivedAt,
          bookingVersion,
          currentBookingState,
          currentPaymentStatus,
        ],
      );
      if (!updated.rows.length) throw new Error("PAYMENT_BOOKING_CONFLICT");
    }

    await appendPaymentOutbox(tx, {
      eventName: "payment.status_changed",
      intentId: row.intent_id,
      intentVersion: nextIntentVersion,
      bookingId: input.bookingId,
      paymentStatus: target.paymentStatus,
      eventStatus: input.status,
      now: receivedAt,
    });

    await tx.query(
      `update payment_receipts_v1
          set result_payment_status=$3,
              result_booking_state=$4,
              result_booking_version=$5,
              processed_at=$6
        where provider=$1 and provider_event_id=$2`,
      [
        input.provider,
        input.providerEventId,
        target.paymentStatus,
        target.bookingState,
        nextBookingVersion,
        receivedAt,
      ],
    );

    return {
      outcome: "processed" as const,
      bookingId: input.bookingId,
      bookingState: target.bookingState,
      bookingVersion: nextBookingVersion,
      paymentStatus: target.paymentStatus,
    };
  });
}

export async function beginRefundV1(
  database: SqlTransactionManager,
  input: BeginRefundInputV1,
  now = new Date(),
) {
  if (
    !Number.isSafeInteger(input.expectedBookingVersion) ||
    input.expectedBookingVersion <= 0
  ) {
    throw new Error("PAYMENT_REFUND_VERSION_INVALID");
  }
  if (!Number.isFinite(now.getTime())) throw new Error("PAYMENT_TIME_INVALID");

  return database.transaction(async (tx) => {
    const rows = await tx.query<{
      intent_id: string;
      intent_status: PaymentIntentStatusV1;
      intent_version: number | string;
      booking_state: string;
      booking_version: number | string;
      payment_status: string;
    }>(
      `select i.id as intent_id, i.status as intent_status,
              i.version as intent_version, b.state as booking_state,
              b.version as booking_version, b.payment_status
         from payment_intents_v1 i
         join bookings b on b.id=i.booking_id
        where i.booking_id=$1
        for update of i, b`,
      [input.bookingId],
    );
    const row = rows.rows[0];
    if (!row) throw new Error("PAYMENT_INTENT_NOT_FOUND");
    const bookingVersion = asPositiveVersion(
      row.booking_version,
      "PAYMENT_BOOKING_RECORD_INVALID",
    );
    const intentVersion = asPositiveVersion(
      row.intent_version,
      "PAYMENT_INTENT_RECORD_INVALID",
    );
    const bookingState = asBookingState(row.booking_state);
    const paymentStatus = asPaymentStatus(row.payment_status);

    if (bookingVersion !== input.expectedBookingVersion) {
      throw new Error("PAYMENT_REFUND_VERSION_CONFLICT");
    }
    if (
      !["paid", "cancelled"].includes(bookingState) ||
      !["paid", "partially_refunded"].includes(paymentStatus) ||
      !["paid", "partially_refunded"].includes(row.intent_status)
    ) {
      throw new Error("PAYMENT_REFUND_STATE_INVALID");
    }

    const timestamp = now.toISOString();
    const nextBookingVersion = bookingVersion + 1;
    const nextIntentVersion = intentVersion + 1;

    const bookingUpdate = await tx.query<{ id: string }>(
      `update bookings
          set state='refund_pending', version=version+1, updated_at=$2
        where id=$1 and version=$3 and state=$4 and payment_status=$5
        returning id`,
      [
        input.bookingId,
        timestamp,
        bookingVersion,
        bookingState,
        paymentStatus,
      ],
    );
    if (!bookingUpdate.rows.length) throw new Error("PAYMENT_BOOKING_CONFLICT");

    await tx.query(
      `update payment_intents_v1
          set status='refund_pending', version=version+1, updated_at=$2
        where id=$1 and version=$3`,
      [row.intent_id, timestamp, intentVersion],
    );

    await appendBookingStateEvent(tx, {
      bookingId: input.bookingId,
      fromState: bookingState,
      toState: "refund_pending",
      version: nextBookingVersion,
      reason: "REFUND_REQUESTED",
      now: timestamp,
    });
    await appendPaymentOutbox(tx, {
      eventName: "payment.refund_requested",
      intentId: row.intent_id,
      intentVersion: nextIntentVersion,
      bookingId: input.bookingId,
      now: timestamp,
    });

    return {
      bookingId: input.bookingId,
      bookingState: "refund_pending" as const,
      bookingVersion: nextBookingVersion,
      paymentStatus,
    };
  });
}
