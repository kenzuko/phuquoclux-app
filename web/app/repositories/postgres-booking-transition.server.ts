/**
 * Durable optimistic booking-state transition writer.
 *
 * Every non-payment transition:
 * - requires expected state + expected version;
 * - increments version atomically;
 * - writes booking_events in the same transaction;
 * - writes a PII-free outbox event in the same transaction.
 *
 * Payment-coupled states are deliberately rejected until the payment writer
 * owns state + payment_status changes together.
 */
import {
  assertBookingTransition,
  type BookingState,
} from "../domain/commerce";
import type { SqlTransactionManager } from "./postgres-booking-core.server";

export const BOOKING_TRANSITION_REASON_CODES = [
  "OPS_CONFIRMED",
  "PROVIDER_CONFIRMED",
  "CUSTOMER_CANCEL_REQUESTED",
  "OPS_CANCELLED",
  "PROVIDER_REJECTED",
  "SERVICE_FULFILLED",
  "PAYMENT_REQUIRED",
  "BOOKING_EXPIRED",
  "SYSTEM_FAILURE",
  "OPS_RESTORED",
] as const;

export type BookingTransitionReasonCode =
  (typeof BOOKING_TRANSITION_REASON_CODES)[number];

export type BookingTransitionSource =
  | "ops"
  | "provider"
  | "customer"
  | "system";

const REASON_CODES = new Set<string>(BOOKING_TRANSITION_REASON_CODES);
const PAYMENT_COUPLED_STATES = new Set<BookingState>([
  "paid",
  "refund_pending",
  "refunded",
]);

export type DurableBookingTransitionInput = {
  bookingId: string;
  expectedFrom: BookingState;
  expectedVersion: number;
  toState: BookingState;
  reasonCode: BookingTransitionReasonCode;
  source: BookingTransitionSource;
};

export type DurableBookingTransitionResult =
  | {
      outcome: "updated";
      bookingId: string;
      state: BookingState;
      version: number;
      updatedAt: string;
    }
  | {
      outcome: "conflict";
      bookingId: string;
      currentState: BookingState;
      currentVersion: number;
    }
  | {
      outcome: "not_found";
      bookingId: string;
    };

function validateInput(input: DurableBookingTransitionInput) {
  if (!input.bookingId) {
    throw new Error("BOOKING_TRANSITION_BOOKING_ID_REQUIRED");
  }
  if (
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion <= 0
  ) {
    throw new Error("BOOKING_TRANSITION_VERSION_INVALID");
  }
  if (!REASON_CODES.has(input.reasonCode)) {
    throw new Error("BOOKING_TRANSITION_REASON_INVALID");
  }

  assertBookingTransition(input.expectedFrom, input.toState);

  if (
    PAYMENT_COUPLED_STATES.has(input.expectedFrom) ||
    PAYMENT_COUPLED_STATES.has(input.toState)
  ) {
    throw new Error(
      "BOOKING_PAYMENT_TRANSITION_REQUIRES_PAYMENT_CONTRACT",
    );
  }
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
    throw new Error("BOOKING_TRANSITION_RECORD_INVALID");
  }
  return value as BookingState;
}

export async function transitionBookingState(
  database: SqlTransactionManager,
  input: DurableBookingTransitionInput,
  now = new Date(),
): Promise<DurableBookingTransitionResult> {
  validateInput(input);
  if (!Number.isFinite(now.getTime())) {
    throw new Error("BOOKING_TRANSITION_TIME_INVALID");
  }

  return database.transaction(async (tx) => {
    const updated = await tx.query<{
      id: string;
      state: string;
      version: number | string;
      updated_at: Date | string;
    }>(
      `update bookings
          set state = $4,
              version = version + 1,
              updated_at = $5
        where id = $1
          and state = $2
          and version = $3
       returning id, state, version, updated_at`,
      [
        input.bookingId,
        input.expectedFrom,
        input.expectedVersion,
        input.toState,
        now.toISOString(),
      ],
    );

    const row = updated.rows[0];
    if (!row) {
      const current = await tx.query<{
        state: string;
        version: number | string;
      }>(
        `select state, version
           from bookings
          where id = $1`,
        [input.bookingId],
      );
      const existing = current.rows[0];
      if (!existing) {
        return {
          outcome: "not_found" as const,
          bookingId: input.bookingId,
        };
      }
      const currentVersion = Number(existing.version);
      if (!Number.isSafeInteger(currentVersion) || currentVersion <= 0) {
        throw new Error("BOOKING_TRANSITION_RECORD_INVALID");
      }
      return {
        outcome: "conflict" as const,
        bookingId: input.bookingId,
        currentState: asBookingState(existing.state),
        currentVersion,
      };
    }

    const newVersion = Number(row.version);
    if (
      !Number.isSafeInteger(newVersion) ||
      newVersion !== input.expectedVersion + 1
    ) {
      throw new Error("BOOKING_TRANSITION_VERSION_INVALID_AFTER_UPDATE");
    }

    const eventId = crypto.randomUUID();
    await tx.query(
      `insert into booking_events
        (id, booking_id, from_state, to_state, version, reason, payload,
         created_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        eventId,
        input.bookingId,
        input.expectedFrom,
        input.toState,
        newVersion,
        input.reasonCode,
        JSON.stringify({ source: input.source }),
        now.toISOString(),
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
        newVersion,
        JSON.stringify({
          bookingId: input.bookingId,
          fromState: input.expectedFrom,
          toState: input.toState,
          version: newVersion,
          reasonCode: input.reasonCode,
          source: input.source,
        }),
        now.toISOString(),
      ],
    );

    const updatedAt =
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString();
    if (!Number.isFinite(new Date(updatedAt).getTime())) {
      throw new Error("BOOKING_TRANSITION_RECORD_INVALID");
    }

    return {
      outcome: "updated" as const,
      bookingId: row.id,
      state: asBookingState(row.state),
      version: newVersion,
      updatedAt,
    };
  });
}
