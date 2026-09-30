import type { DomainEvent } from "../domain/integration";

export type OutboxStatus = "pending" | "published" | "failed";

export type OutboxRecord = {
  event: DomainEvent;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt?: string;
  publishedAt?: string;
  lastError?: string;
};

export interface OutboxRepository {
  enqueue(event: DomainEvent): Promise<void>;
  claimBatch(limit: number, now: string): Promise<OutboxRecord[]>;
  markPublished(eventId: string, publishedAt: string): Promise<void>;
  markFailed(
    eventId: string,
    attempts: number,
    nextAttemptAt: string,
    lastError: string,
  ): Promise<void>;
}

export interface WebhookReceiptRepository {
  hasProcessed(provider: string, providerEventId: string): Promise<boolean>;
  recordProcessed(
    provider: string,
    providerEventId: string,
    processedAt: string,
  ): Promise<void>;
}
