/**
 * Provider-neutral outbox publishing loop.
 *
 * This module owns orchestration only. Concrete email/SMS/Ops/provider
 * integrations are intentionally absent. A publisher may return only a stable
 * allow-listed failure code; arbitrary exception text is never persisted.
 */
import type { SqlTransactionManager } from "../repositories/postgres-booking-core.server";
import {
  claimOutboxBatch,
  markOutboxPublished,
  scheduleOutboxRetry,
  type ClaimedOutboxEvent,
  type OutboxDeliveryErrorCode,
} from "../repositories/postgres-outbox.server";

export type OutboxPublishResult =
  | { ok: true }
  | { ok: false; errorCode: OutboxDeliveryErrorCode };

export interface OutboxPublisher {
  publish(event: ClaimedOutboxEvent): Promise<OutboxPublishResult>;
}

export type OutboxProcessSummary = {
  claimed: number;
  published: number;
  retryScheduled: number;
  failedTerminal: number;
  leaseLost: number;
};

export async function processOutboxBatch(
  database: SqlTransactionManager,
  publisher: OutboxPublisher,
  options: {
    limit?: number;
    leaseSeconds?: number;
    maxAttempts?: number;
    now?: Date;
  } = {},
): Promise<OutboxProcessSummary> {
  const claimed = await claimOutboxBatch(database, {
    limit: options.limit,
    leaseSeconds: options.leaseSeconds,
    now: options.now,
  });

  const summary: OutboxProcessSummary = {
    claimed: claimed.length,
    published: 0,
    retryScheduled: 0,
    failedTerminal: 0,
    leaseLost: 0,
  };

  // Publish outside PostgreSQL transactions. The lease is the concurrency
  // boundary while the external provider call is in flight.
  for (const event of claimed) {
    let result: OutboxPublishResult;
    try {
      result = await publisher.publish(event);
    } catch {
      result = { ok: false, errorCode: "DELIVERY_FAILED" };
    }

    if (result.ok) {
      const acknowledged = await markOutboxPublished(
        database,
        event.id,
        event.leaseToken,
        options.now ?? new Date(),
      );
      if (acknowledged) summary.published += 1;
      else summary.leaseLost += 1;
      continue;
    }

    const retry = await scheduleOutboxRetry(database, {
      eventId: event.id,
      leaseToken: event.leaseToken,
      errorCode: result.errorCode,
      maxAttempts: options.maxAttempts,
      now: options.now ?? new Date(),
    });
    if (retry.outcome === "lease_lost") summary.leaseLost += 1;
    if (retry.outcome === "retry_scheduled") summary.retryScheduled += 1;
    if (retry.outcome === "failed_terminal") summary.failedTerminal += 1;
  }

  return summary;
}
