/**
 * Driver-neutral durable outbox delivery contract.
 *
 * Claiming and state transitions are PostgreSQL-backed. External network calls
 * must happen AFTER claimOutboxBatch returns, never inside the DB transaction.
 *
 * Safety:
 * - FOR UPDATE SKIP LOCKED avoids two workers claiming the same ready row;
 * - every claim receives an opaque lease token;
 * - stale workers cannot publish/retry after another worker has reclaimed;
 * - raw provider errors are never persisted, only stable allow-listed codes.
 */
import type { SqlTransactionManager } from "./postgres-booking-core.server";

export const OUTBOX_DELIVERY_ERROR_CODES = [
  "DELIVERY_AUTH_FAILED",
  "DELIVERY_NETWORK",
  "DELIVERY_RATE_LIMITED",
  "DELIVERY_REJECTED",
  "DELIVERY_TIMEOUT",
  "HANDLER_UNSUPPORTED_EVENT",
  "DELIVERY_FAILED",
] as const;

export type OutboxDeliveryErrorCode =
  (typeof OUTBOX_DELIVERY_ERROR_CODES)[number];

const ERROR_CODES = new Set<string>(OUTBOX_DELIVERY_ERROR_CODES);
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_LEASE_SECONDS = 60;
const MIN_LEASE_SECONDS = 30;
const MAX_LEASE_SECONDS = 15 * 60;
const DEFAULT_MAX_ATTEMPTS = 8;
const MAX_ATTEMPTS = 20;
const RETRY_SECONDS = [60, 5 * 60, 15 * 60, 60 * 60, 6 * 60 * 60, 12 * 60 * 60];

export type ClaimedOutboxEvent = {
  id: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  payload: unknown;
  attempts: number;
  leaseToken: string;
  leasedAt: string;
  leaseExpiresAt: string;
};

function safePositiveInteger(
  value: number | undefined,
  fallback: number,
  max: number,
) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new Error("OUTBOX_OPTION_INVALID");
  }
  return value;
}

function safeLeaseSeconds(value: number | undefined) {
  if (value === undefined) return DEFAULT_LEASE_SECONDS;
  if (
    !Number.isSafeInteger(value) ||
    value < MIN_LEASE_SECONDS ||
    value > MAX_LEASE_SECONDS
  ) {
    throw new Error("OUTBOX_LEASE_SECONDS_INVALID");
  }
  return value;
}

function iso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("OUTBOX_RECORD_INVALID");
  }
  return date.toISOString();
}

function rowToClaim(row: {
  id: string;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | string;
  payload: unknown;
  attempts: number | string;
  lease_token: string;
  leased_at: Date | string;
  lease_expires_at: Date | string;
}): ClaimedOutboxEvent {
  const aggregateVersion = Number(row.aggregate_version);
  const attempts = Number(row.attempts);
  if (
    !row.id ||
    !row.event_name ||
    !row.aggregate_type ||
    !row.aggregate_id ||
    !row.lease_token ||
    !Number.isSafeInteger(aggregateVersion) ||
    aggregateVersion <= 0 ||
    !Number.isSafeInteger(attempts) ||
    attempts <= 0
  ) {
    throw new Error("OUTBOX_RECORD_INVALID");
  }
  return {
    id: row.id,
    eventName: row.event_name,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    aggregateVersion,
    payload: row.payload,
    attempts,
    leaseToken: row.lease_token,
    leasedAt: iso(row.leased_at),
    leaseExpiresAt: iso(row.lease_expires_at),
  };
}

export function sanitizeOutboxDeliveryErrorCode(
  code: string | undefined,
): OutboxDeliveryErrorCode {
  return code && ERROR_CODES.has(code)
    ? (code as OutboxDeliveryErrorCode)
    : "DELIVERY_FAILED";
}

export function outboxRetryDelaySeconds(attempts: number) {
  if (!Number.isSafeInteger(attempts) || attempts <= 0) {
    throw new Error("OUTBOX_ATTEMPTS_INVALID");
  }
  return RETRY_SECONDS[Math.min(attempts - 1, RETRY_SECONDS.length - 1)];
}

export async function claimOutboxBatch(
  database: SqlTransactionManager,
  options: {
    limit?: number;
    leaseSeconds?: number;
    now?: Date;
  } = {},
): Promise<ClaimedOutboxEvent[]> {
  const limit = safePositiveInteger(options.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const leaseSeconds = safeLeaseSeconds(options.leaseSeconds);
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("OUTBOX_NOW_INVALID");

  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(
    now.getTime() + leaseSeconds * 1000,
  ).toISOString();

  return database.transaction(async (tx) => {
    const result = await tx.query<{
      id: string;
      event_name: string;
      aggregate_type: string;
      aggregate_id: string;
      aggregate_version: number | string;
      payload: unknown;
      attempts: number | string;
      lease_token: string;
      leased_at: Date | string;
      lease_expires_at: Date | string;
    }>(
      `with candidates as (
         select id
           from outbox_events
          where (
                 status = 'pending'
                 and (next_attempt_at is null or next_attempt_at <= $1)
                )
             or (
                 status = 'processing'
                 and lease_expires_at <= $1
                )
          order by created_at asc, id asc
          for update skip locked
          limit $2
       )
       update outbox_events o
          set status = 'processing',
              attempts = o.attempts + 1,
              lease_token = $3,
              leased_at = $1,
              lease_expires_at = $4,
              next_attempt_at = null
         from candidates c
        where o.id = c.id
       returning o.id, o.event_name, o.aggregate_type, o.aggregate_id,
                 o.aggregate_version, o.payload, o.attempts, o.lease_token,
                 o.leased_at, o.lease_expires_at`,
      [now.toISOString(), limit, leaseToken, leaseExpiresAt],
    );

    return result.rows.map(rowToClaim);
  });
}

export async function markOutboxPublished(
  database: SqlTransactionManager,
  eventId: string,
  leaseToken: string,
  now = new Date(),
) {
  if (!eventId || !leaseToken || !Number.isFinite(now.getTime())) {
    throw new Error("OUTBOX_ACK_INPUT_INVALID");
  }

  return database.transaction(async (tx) => {
    const result = await tx.query<{ id: string }>(
      `update outbox_events
          set status = 'published',
              published_at = $3,
              next_attempt_at = null,
              last_error = null,
              lease_token = null,
              leased_at = null,
              lease_expires_at = null
        where id = $1
          and status = 'processing'
          and lease_token = $2
       returning id`,
      [eventId, leaseToken, now.toISOString()],
    );
    return Boolean(result.rows[0]);
  });
}

export async function scheduleOutboxRetry(
  database: SqlTransactionManager,
  input: {
    eventId: string;
    leaseToken: string;
    errorCode?: string;
    maxAttempts?: number;
    now?: Date;
  },
): Promise<
  | { outcome: "lease_lost" }
  | {
      outcome: "retry_scheduled" | "failed_terminal";
      attempts: number;
      errorCode: OutboxDeliveryErrorCode;
      nextAttemptAt?: string;
    }
> {
  const {
    eventId,
    leaseToken,
    errorCode,
  } = input;
  const maxAttempts = safePositiveInteger(
    input.maxAttempts,
    DEFAULT_MAX_ATTEMPTS,
    MAX_ATTEMPTS,
  );
  const now = input.now ?? new Date();
  if (!eventId || !leaseToken || !Number.isFinite(now.getTime())) {
    throw new Error("OUTBOX_RETRY_INPUT_INVALID");
  }
  const safeErrorCode = sanitizeOutboxDeliveryErrorCode(errorCode);

  return database.transaction(async (tx) => {
    const current = await tx.query<{
      attempts: number | string;
    }>(
      `select attempts
         from outbox_events
        where id = $1
          and status = 'processing'
          and lease_token = $2
        for update`,
      [eventId, leaseToken],
    );
    const row = current.rows[0];
    if (!row) return { outcome: "lease_lost" as const };

    const attempts = Number(row.attempts);
    if (!Number.isSafeInteger(attempts) || attempts <= 0) {
      throw new Error("OUTBOX_RECORD_INVALID");
    }

    const terminal = attempts >= maxAttempts;
    const nextAttemptAt = terminal
      ? undefined
      : new Date(
          now.getTime() + outboxRetryDelaySeconds(attempts) * 1000,
        ).toISOString();

    const updated = await tx.query<{ id: string }>(
      `update outbox_events
          set status = $3,
              next_attempt_at = $4,
              last_error = $5,
              lease_token = null,
              leased_at = null,
              lease_expires_at = null
        where id = $1
          and status = 'processing'
          and lease_token = $2
       returning id`,
      [
        eventId,
        leaseToken,
        terminal ? "failed" : "pending",
        nextAttemptAt ?? null,
        safeErrorCode,
      ],
    );
    if (!updated.rows[0]) return { outcome: "lease_lost" as const };

    return terminal
      ? {
          outcome: "failed_terminal" as const,
          attempts,
          errorCode: safeErrorCode,
        }
      : {
          outcome: "retry_scheduled" as const,
          attempts,
          errorCode: safeErrorCode,
          nextAttemptAt,
        };
  });
}
