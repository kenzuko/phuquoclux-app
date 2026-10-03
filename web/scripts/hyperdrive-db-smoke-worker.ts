import { Client } from "pg";
import type { PhuQuocLuxEnv } from "../app/cloudflare-context";
import type { Booking, Quote } from "../app/domain/commerce";
import {
  hashManageBookingToken,
  issueManageBookingAccess,
  redeemManageBookingAccess,
  revokeManageBookingAccess,
} from "../app/repositories/postgres-booking-access.server";
import {
  persistManualBookingRequest,
  type SqlTransactionManager,
} from "../app/repositories/postgres-booking-core.server";
import {
  hashManageBookingSessionToken,
  resolveManageBookingSession,
} from "../app/repositories/postgres-booking-session.server";
import { exchangeManageBookingRequest } from "../app/services/manage-booking-exchange.server";

type Env = {
  HYPERDRIVE: {
    connectionString: string;
  };
};

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });

    try {
      await client.connect();

      const identity = await client.query<{
        database_name: string;
        user_name: string;
      }>("select current_database() as database_name, current_user as user_name");

      const table = await client.query<{ bookings_table: string | null }>(
        "select to_regclass('public.bookings')::text as bookings_table",
      );

      const count = await client.query<{ booking_count: string }>(
        "select count(*)::text as booking_count from public.bookings",
      );

      let migrationLedgerDenied = false;
      let migrationLedgerErrorCode: string | null = null;

      try {
        await client.query("select count(*) from public.pql_schema_migrations");
      } catch (error) {
        const candidate = error as { code?: string; message?: string };
        migrationLedgerErrorCode = candidate.code ?? null;
        migrationLedgerDenied =
          candidate.code === "42501" ||
          /permission denied/i.test(candidate.message ?? "");
      }

      const smokeRequestId = crypto.randomUUID();
      let writeInserted = false;
      let writeVisibleInsideTransaction = false;

      await client.query("begin");
      try {
        const inserted = await client.query<{ request_id: string }>(
          `insert into public.idempotency_keys
            (request_id, scope, resource_type, resource_id, expires_at)
           values ($1::uuid, 'hyperdrive_smoke', 'smoke', 'rollback-only', now() + interval '5 minutes')
           returning request_id::text as request_id`,
          [smokeRequestId],
        );
        writeInserted = inserted.rows[0]?.request_id === smokeRequestId;

        const visible = await client.query<{ row_count: string }>(
          "select count(*)::text as row_count from public.idempotency_keys where request_id = $1::uuid",
          [smokeRequestId],
        );
        writeVisibleInsideTransaction = visible.rows[0]?.row_count === "1";
      } finally {
        await client.query("rollback");
      }

      const afterRollback = await client.query<{ row_count: string }>(
        "select count(*)::text as row_count from public.idempotency_keys where request_id = $1::uuid",
        [smokeRequestId],
      );
      const writeRolledBack = afterRollback.rows[0]?.row_count === "0";

      const writerNow = new Date();
      const writerCreatedAt = writerNow.toISOString();
      const writerExpiresAt = new Date(writerNow.getTime() + 10 * 60_000).toISOString();
      const writerServiceDate = new Date(writerNow.getTime() + 24 * 60 * 60_000)
        .toISOString()
        .slice(0, 10);
      const writerQuoteId = crypto.randomUUID();
      const writerBookingId = crypto.randomUUID();
      const writerRequestId = crypto.randomUUID();

      const writerQuote: Quote = {
        id: writerQuoteId,
        status: "active",
        priceState: "estimated",
        productType: "tour",
        productId: "tour-three-islands-cano",
        offerId: "tour-three-islands-cano:shared",
        serviceDate: writerServiceDate,
        pax: 1,
        lines: [
          {
            code: "guest",
            label: "Khách",
            quantity: 1,
            unitPrice: { amount: 850000, currency: "VND" },
            total: { amount: 850000, currency: "VND" },
          },
        ],
        total: { amount: 850000, currency: "VND" },
        createdAt: writerCreatedAt,
        expiresAt: writerExpiresAt,
        availabilitySnapshot: {
          state: "request",
          checkedAt: writerCreatedAt,
          source: "manual",
        },
      };

      const writerBooking: Booking = {
        id: writerBookingId,
        requestId: writerRequestId,
        contact: {
          name: "Hyperdrive Smoke",
          email: "hyperdrive-smoke@example.invalid",
          phone: "+84000000000",
        },
        productType: "tour",
        productId: "tour-three-islands-cano",
        offerId: "tour-three-islands-cano:shared",
        quoteId: writerQuoteId,
        state: "pending_confirmation",
        version: 1,
        paymentStatus: "unpaid",
        serviceDate: writerServiceDate,
        pax: 1,
        total: { amount: 850000, currency: "VND" },
        operationalData: { guestNote: "rollback-only smoke" },
        createdAt: writerCreatedAt,
        updatedAt: writerCreatedAt,
      };

      const fingerprintKey = await crypto.subtle.importKey(
        "raw",
        crypto.getRandomValues(new Uint8Array(32)),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );

      const txAdapter = {
        async query<Row extends object>(sql: string, parameters: readonly unknown[]) {
          const queryResult = await client.query<Row>(sql, [...parameters]);
          return { rows: queryResult.rows };
        },
      };

      async function seedCatalogRows() {
        await client.query(
          `insert into public.products
            (id, slug, product_type, name, status, payload)
           values
            ('tour-three-islands-cano', 'hyperdrive-smoke-tour', 'tour',
             'Hyperdrive Smoke Tour', 'active', '{}'::jsonb)
           on conflict (id) do nothing`,
        );
        await client.query(
          `insert into public.offers
            (id, product_id, provider_id, status, availability_mode,
             pricing_mode, price_amount, price_currency, price_basis,
             price_source, price_state, policy, constraints,
             operational_fields, required_operational_fields)
           values
            ('tour-three-islands-cano:shared', 'tour-three-islands-cano',
             'jotrip-manual-request', 'active', 'request', 'flat',
             850000, 'VND', 'per_person', 'prototype', 'estimated',
             '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)
           on conflict (id) do nothing`,
        );
      }

      let writerRowsVisibleInsideTransaction = false;
      const rollbackManager: SqlTransactionManager = {
        async transaction<T>(work: Parameters<SqlTransactionManager["transaction"]>[0]) {
          await client.query("begin");
          try {
            await seedCatalogRows();
            const result = await work(txAdapter);

            const visible = await client.query<{
              booking_count: string;
              quote_count: string;
              idempotency_count: string;
              outbox_count: string;
            }>(
              `select
                 (select count(*)::text from public.bookings where id = $1::uuid) as booking_count,
                 (select count(*)::text from public.quotes where id = $2::uuid) as quote_count,
                 (select count(*)::text from public.idempotency_keys where request_id = $3::uuid) as idempotency_count,
                 (select count(*)::text from public.outbox_events where aggregate_id = $4::text) as outbox_count`,
              [writerBookingId, writerQuoteId, writerRequestId, writerBookingId],
            );
            const row = visible.rows[0];
            writerRowsVisibleInsideTransaction =
              row?.booking_count === "1" &&
              row?.quote_count === "1" &&
              row?.idempotency_count === "1" &&
              row?.outbox_count === "1";

            return result as T;
          } finally {
            await client.query("rollback");
          }
        },
      };

      const writerResult = await persistManualBookingRequest(
        rollbackManager,
        {
          quote: writerQuote,
          booking: writerBooking,
          fingerprintKey,
        },
        writerNow,
      );

      const writerAfterRollback = await client.query<{
        booking_count: string;
        quote_count: string;
        idempotency_count: string;
        outbox_count: string;
      }>(
        `select
           (select count(*)::text from public.bookings where id = $1::uuid) as booking_count,
           (select count(*)::text from public.quotes where id = $2::uuid) as quote_count,
           (select count(*)::text from public.idempotency_keys where request_id = $3::uuid) as idempotency_count,
           (select count(*)::text from public.outbox_events where aggregate_id = $4::text) as outbox_count`,
        [writerBookingId, writerQuoteId, writerRequestId, writerBookingId],
      );
      const writerAfter = writerAfterRollback.rows[0];
      const writerRolledBackCleanly =
        writerAfter?.booking_count === "0" &&
        writerAfter?.quote_count === "0" &&
        writerAfter?.idempotency_count === "0" &&
        writerAfter?.outbox_count === "0";

      let guestAccessIssued = false;
      let guestAccessRawTokenNotPersisted = false;
      let guestAccessRedeemed = false;
      let guestExchangeStatus = 0;
      let guestCookieSecure = false;
      let guestSessionResolved = false;
      let guestSessionRawTokenNotPersisted = false;
      let guestParentRevocationInvalidatesSession = false;
      let guestFlowRowsVisibleInsideTransaction = false;

      await client.query("begin");
      try {
        await seedCatalogRows();
        const passthroughManager: SqlTransactionManager = {
          async transaction<T>(work: Parameters<SqlTransactionManager["transaction"]>[0]) {
            return work(txAdapter) as Promise<T>;
          },
        };

        const guestWriter = await persistManualBookingRequest(
          passthroughManager,
          {
            quote: writerQuote,
            booking: writerBooking,
            fingerprintKey,
          },
          writerNow,
        );
        if (guestWriter.outcome !== "created") {
          throw new Error("GUEST_FLOW_BOOKING_NOT_CREATED");
        }

        const accessExpiresAt = new Date(writerNow.getTime() + 60 * 60_000).toISOString();
        const issued = await issueManageBookingAccess(
          passthroughManager,
          writerBookingId,
          accessExpiresAt,
          writerNow,
        );
        guestAccessIssued = /^[0-9a-f]{64}$/.test(issued.rawToken);

        const expectedAccessHash = await hashManageBookingToken(issued.rawToken);
        const accessRow = await client.query<{ token_hash: string }>(
          `select token_hash
             from public.booking_access_tokens
            where booking_id = $1::uuid
            order by created_at desc
            limit 1`,
          [writerBookingId],
        );
        guestAccessRawTokenNotPersisted =
          Boolean(expectedAccessHash) &&
          accessRow.rows[0]?.token_hash === expectedAccessHash &&
          accessRow.rows[0]?.token_hash !== issued.rawToken;

        const redeemed = await redeemManageBookingAccess(
          passthroughManager,
          issued.rawToken,
          writerNow,
        );
        guestAccessRedeemed =
          redeemed?.bookingId === writerBookingId &&
          redeemed?.purpose === "manage_booking";

        const manageEnv: PhuQuocLuxEnv = {
          MANAGE_BOOKING_EXCHANGE_ENABLED: "true",
          MANAGE_BOOKING_CANONICAL_ORIGIN: "https://booking-smoke.invalid",
          MANAGE_BOOKING_SESSION_TTL_MINUTES: "30",
        };
        const exchangeResponse = await exchangeManageBookingRequest({
          request: new Request("https://booking-smoke.invalid/manage/exchange", {
            method: "POST",
          }),
          rawAccessToken: issued.rawToken,
          env: manageEnv,
          database: passthroughManager,
          now: writerNow,
        });
        guestExchangeStatus = exchangeResponse.status;
        const setCookie = exchangeResponse.headers.get("set-cookie") ?? "";
        guestCookieSecure =
          setCookie.startsWith("__Host-pql_manage=") &&
          /; Path=\//.test(setCookie) &&
          /; HttpOnly/.test(setCookie) &&
          /; Secure/.test(setCookie) &&
          /; SameSite=Lax/.test(setCookie);

        const rawSessionToken =
          setCookie.match(/__Host-pql_manage=([0-9a-f]{64})/)?.[1] ?? null;
        const expectedSessionHash = rawSessionToken
          ? await hashManageBookingSessionToken(rawSessionToken)
          : null;
        const sessionRow = await client.query<{
          id: string;
          session_hash: string;
        }>(
          `select id, session_hash
             from public.booking_access_sessions
            where booking_id = $1::uuid
            order by created_at desc
            limit 1`,
          [writerBookingId],
        );
        guestSessionRawTokenNotPersisted =
          Boolean(rawSessionToken && expectedSessionHash) &&
          sessionRow.rows[0]?.session_hash === expectedSessionHash &&
          sessionRow.rows[0]?.session_hash !== rawSessionToken;

        const resolved = rawSessionToken
          ? await resolveManageBookingSession(
              passthroughManager,
              rawSessionToken,
              writerNow,
            )
          : null;
        guestSessionResolved =
          resolved?.bookingId === writerBookingId &&
          resolved?.sessionId === sessionRow.rows[0]?.id;

        if (!redeemed) {
          throw new Error("GUEST_FLOW_ACCESS_REDEEM_FAILED");
        }
        const revoked = await revokeManageBookingAccess(
          passthroughManager,
          redeemed.grantId,
          writerBookingId,
          writerNow,
        );
        const afterParentRevoke = rawSessionToken
          ? await resolveManageBookingSession(
              passthroughManager,
              rawSessionToken,
              new Date(writerNow.getTime() + 1).toISOString() as unknown as Date,
            )
          : null;
        guestParentRevocationInvalidatesSession = revoked && afterParentRevoke === null;

        const visible = await client.query<{
          booking_count: string;
          access_count: string;
          session_count: string;
        }>(
          `select
             (select count(*)::text from public.bookings where id = $1::uuid) as booking_count,
             (select count(*)::text from public.booking_access_tokens where booking_id = $1::uuid) as access_count,
             (select count(*)::text from public.booking_access_sessions where booking_id = $1::uuid) as session_count`,
          [writerBookingId],
        );
        guestFlowRowsVisibleInsideTransaction =
          visible.rows[0]?.booking_count === "1" &&
          visible.rows[0]?.access_count === "1" &&
          visible.rows[0]?.session_count === "1";
      } finally {
        await client.query("rollback");
      }

      const guestAfterRollback = await client.query<{
        booking_count: string;
        quote_count: string;
        idempotency_count: string;
        outbox_count: string;
        access_count: string;
        session_count: string;
      }>(
        `select
           (select count(*)::text from public.bookings where id = $1::uuid) as booking_count,
           (select count(*)::text from public.quotes where id = $2::uuid) as quote_count,
           (select count(*)::text from public.idempotency_keys where request_id = $3::uuid) as idempotency_count,
           (select count(*)::text from public.outbox_events where aggregate_id = $4::text) as outbox_count,
           (select count(*)::text from public.booking_access_tokens where booking_id = $1::uuid) as access_count,
           (select count(*)::text from public.booking_access_sessions where booking_id = $1::uuid) as session_count`,
        [writerBookingId, writerQuoteId, writerRequestId, writerBookingId],
      );
      const guestAfter = guestAfterRollback.rows[0];
      const guestFlowRolledBackCleanly =
        guestAfter?.booking_count === "0" &&
        guestAfter?.quote_count === "0" &&
        guestAfter?.idempotency_count === "0" &&
        guestAfter?.outbox_count === "0" &&
        guestAfter?.access_count === "0" &&
        guestAfter?.session_count === "0";

      return Response.json({
        ok: true,
        database: identity.rows[0]?.database_name ?? null,
        user: identity.rows[0]?.user_name ?? null,
        bookingsTable: table.rows[0]?.bookings_table ?? null,
        bookingCount: count.rows[0]?.booking_count ?? null,
        migrationLedgerDenied,
        migrationLedgerErrorCode,
        writeInserted,
        writeVisibleInsideTransaction,
        writeRolledBack,
        writerOutcome: writerResult.outcome,
        writerRowsVisibleInsideTransaction,
        writerRolledBackCleanly,
        guestAccessIssued,
        guestAccessRawTokenNotPersisted,
        guestAccessRedeemed,
        guestExchangeStatus,
        guestCookieSecure,
        guestSessionResolved,
        guestSessionRawTokenNotPersisted,
        guestParentRevocationInvalidatesSession,
        guestFlowRowsVisibleInsideTransaction,
        guestFlowRolledBackCleanly,
      });
    } catch (error) {
      const candidate = error as { code?: string; message?: string };
      return Response.json(
        {
          ok: false,
          errorCode: candidate.code ?? null,
          error: candidate.message ?? String(error),
        },
        { status: 500 },
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  },
};
