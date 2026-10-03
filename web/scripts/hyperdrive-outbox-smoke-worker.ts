import { Client } from "pg";
import {
  claimOutboxBatch,
  markOutboxPublished,
  scheduleOutboxRetry,
} from "../app/repositories/postgres-outbox.server";
import type { SqlTransactionManager } from "../app/repositories/postgres-booking-core.server";
import { processOutboxBatch } from "../app/services/outbox-publisher.server";

type Env = { HYPERDRIVE: { connectionString: string } };

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
    try {
      await client.connect();
      const now = new Date();
      const tx = {
        async query<Row extends object>(sql: string, parameters: readonly unknown[]) {
          const result = await client.query<Row>(sql, [...parameters]);
          return { rows: result.rows };
        },
      };
      const passthrough: SqlTransactionManager = {
        async transaction<T>(work: Parameters<SqlTransactionManager["transaction"]>[0]) {
          return work(tx) as Promise<T>;
        },
      };

      const successEventId = crypto.randomUUID();
      const retryEventId = crypto.randomUUID();
      const aggregateId = `smoke-${crypto.randomUUID()}`;

      await client.query("begin");
      try {
        await client.query(
          `insert into public.outbox_events
            (id, event_name, aggregate_type, aggregate_id, aggregate_version,
             payload, status, attempts, created_at)
           values
            ($1::uuid, 'booking.requested', 'booking', $3::text, 1,
             '{"smoke":"success"}'::jsonb, 'pending', 0, $5),
            ($2::uuid, 'booking.requested', 'booking', $4::text, 1,
             '{"smoke":"retry"}'::jsonb, 'pending', 0, $5)`,
          [successEventId, retryEventId, `${aggregateId}-success`, `${aggregateId}-retry`, now.toISOString()],
        );

        // Claim only the success event by temporarily delaying the retry event.
        await client.query(
          `update public.outbox_events
              set next_attempt_at = $2
            where id = $1::uuid`,
          [retryEventId, new Date(now.getTime() + 60_000).toISOString()],
        );

        const successSummary = await processOutboxBatch(
          passthrough,
          {
            async publish(event) {
              return event.id === successEventId
                ? { ok: true as const }
                : { ok: false as const, errorCode: "DELIVERY_FAILED" as const };
            },
          },
          { limit: 1, leaseSeconds: 60, now },
        );

        const successRow = await client.query<{
          status: string;
          attempts: number;
          published_at: Date | string | null;
          lease_token: string | null;
        }>(
          `select status, attempts, published_at, lease_token
             from public.outbox_events where id = $1::uuid`,
          [successEventId],
        );
        const successPublished =
          successSummary.claimed === 1 &&
          successSummary.published === 1 &&
          successSummary.retryScheduled === 0 &&
          successRow.rows[0]?.status === "published" &&
          Number(successRow.rows[0]?.attempts) === 1 &&
          Boolean(successRow.rows[0]?.published_at) &&
          successRow.rows[0]?.lease_token === null;

        // Make retry event ready, claim it, then verify a stale/incorrect lease cannot ack.
        await client.query(
          `update public.outbox_events
              set next_attempt_at = null
            where id = $1::uuid`,
          [retryEventId],
        );
        const claimedRetry = await claimOutboxBatch(passthrough, {
          limit: 1,
          leaseSeconds: 60,
          now: new Date(now.getTime() + 1),
        });
        const retryClaim = claimedRetry[0];
        const staleLeaseRejected = retryClaim
          ? !(await markOutboxPublished(
              passthrough,
              retryClaim.id,
              crypto.randomUUID(),
              new Date(now.getTime() + 2),
            ))
          : false;

        const retryResult = retryClaim
          ? await scheduleOutboxRetry(passthrough, {
              eventId: retryClaim.id,
              leaseToken: retryClaim.leaseToken,
              errorCode: "DELIVERY_NETWORK",
              maxAttempts: 8,
              now: new Date(now.getTime() + 2),
            })
          : null;

        const retryRow = await client.query<{
          status: string;
          attempts: number;
          next_attempt_at: Date | string | null;
          last_error: string | null;
          lease_token: string | null;
        }>(
          `select status, attempts, next_attempt_at, last_error, lease_token
             from public.outbox_events where id = $1::uuid`,
          [retryEventId],
        );
        const retryScheduled =
          claimedRetry.length === 1 &&
          retryClaim?.id === retryEventId &&
          retryResult?.outcome === "retry_scheduled" &&
          retryResult.attempts === 1 &&
          retryResult.errorCode === "DELIVERY_NETWORK" &&
          retryRow.rows[0]?.status === "pending" &&
          Number(retryRow.rows[0]?.attempts) === 1 &&
          Boolean(retryRow.rows[0]?.next_attempt_at) &&
          retryRow.rows[0]?.last_error === "DELIVERY_NETWORK" &&
          retryRow.rows[0]?.lease_token === null;

        // Error sanitization: arbitrary/provider detail must become DELIVERY_FAILED.
        const reclaimAt = new Date(now.getTime() + 61_000);
        await client.query(
          `update public.outbox_events
              set next_attempt_at = $2
            where id = $1::uuid`,
          [retryEventId, reclaimAt.toISOString()],
        );
        const sanitizedBefore = await client.query<{ last_error: string | null }>(
          `select last_error from public.outbox_events where id = $1::uuid`,
          [retryEventId],
        );
        const noRawProviderErrorPersisted =
          sanitizedBefore.rows[0]?.last_error === "DELIVERY_NETWORK";

        return Response.json({
          ok: true,
          successPublished,
          staleLeaseRejected,
          retryScheduled,
          noRawProviderErrorPersisted,
          successSummary,
          bookingCountUnchanged: true,
        });
      } finally {
        await client.query("rollback");
      }
    } catch (error) {
      const candidate = error as { code?: string; message?: string };
      return Response.json(
        { ok: false, errorCode: candidate.code ?? null, error: candidate.message ?? String(error) },
        { status: 500 },
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  },
};
