#!/usr/bin/env node
/**
 * Payment Contract V1 disposable PostgreSQL integration test.
 *
 * Runs only against the exact synthetic CI database. The payment schema is
 * loaded from db/contracts and is intentionally NOT part of production
 * migrations yet.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  beginRefundV1,
  createPaymentIntentAttemptV1,
  recordVerifiedPaymentEventV1,
} from "../app/repositories/postgres-payment-contract-v1.server.ts";

const url = process.env.PG_TEST_URL;
if (!url || new URL(url).pathname !== "/phuquoclux_contract_test") {
  throw new Error(
    "Set PG_TEST_URL to an isolated /phuquoclux_contract_test database.",
  );
}

const contractPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../db/contracts/payment_contract_v1.sql",
);
const contractSql = readFileSync(contractPath, "utf8");
const TIME = "2026-10-02T01:00:00.000Z";
const AMOUNT = 880000;
const PRODUCT_ID = "payment-contract-v1-product";
const OFFER_ID = "payment-contract-v1-offer";

async function connect() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

function manager(client) {
  return {
    async transaction(work) {
      await client.query("BEGIN");
      try {
        const result = await work({
          query: (sql, parameters) => client.query(sql, parameters),
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  };
}

async function seedPayableBooking(client, suffix = "a") {
  const quoteId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  const productId = `${PRODUCT_ID}-${suffix}`;
  const offerId = `${OFFER_ID}-${suffix}`;

  await client.query(
    `insert into products (id, slug, product_type, name)
     values ($1, $2, 'tour', 'SYNTHETIC PAYMENT CONTRACT PRODUCT')`,
    [productId, `${productId}-slug`],
  );
  await client.query(
    `insert into offers
      (id, product_id, provider_id, status, availability_mode,
       pricing_mode, price_amount, price_currency, price_basis, price_source,
       price_state)
     values ($1, $2, 'synthetic-payment-provider', 'active', 'live',
             'flat', $3, 'VND', 'per_booking', 'provider_api', 'final')`,
    [offerId, productId, AMOUNT],
  );
  await client.query(
    `insert into quotes
      (id, product_id, offer_id, status, price_state, service_date, pax,
       total_amount, currency, availability_snapshot, created_at, expires_at,
       accepted_at)
     values ($1, $2, $3, 'accepted', 'final', '2026-10-10', 2,
             $4, 'VND', $5::jsonb, $6, $7, $6)`,
    [
      quoteId,
      productId,
      offerId,
      AMOUNT,
      JSON.stringify({
        state: "available",
        checkedAt: TIME,
        source: "provider_api",
      }),
      TIME,
      "2026-10-02T02:00:00.000Z",
    ],
  );
  await client.query(
    `insert into bookings
      (id, request_id, guest_name, guest_email, guest_phone, product_id,
       offer_id, quote_id, state, version, payment_status, service_date, pax,
       total_amount, currency, operational_data, created_at, updated_at)
     values ($1, $2, 'SYNTHETIC PAYMENT GUEST',
             'payment-contract@example.invalid', '0000000000', $3, $4, $5,
             'pending_payment', 1, 'unpaid', '2026-10-10', 2, $6, 'VND',
             '{}'::jsonb, $7, $7)`,
    [bookingId, requestId, productId, offerId, quoteId, AMOUNT, TIME],
  );

  return { bookingId, quoteId };
}

const client = await connect();
try {
  // Contract DDL is idempotent and deliberately outside the migration runner.
  await client.query(contractSql);
  await client.query(contractSql);

  const fixture = await seedPayableBooking(client, "main");
  const intentId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const createInput = {
    intentId,
    attemptId,
    bookingId: fixture.bookingId,
    quoteId: fixture.quoteId,
    provider: "synthetic_provider",
    requestKey: crypto.randomUUID(),
    amount: AMOUNT,
    currency: "VND",
  };

  const created = await createPaymentIntentAttemptV1(
    manager(client),
    createInput,
    new Date(TIME),
  );
  assert.deepEqual(created, {
    intentId,
    attemptId,
    bookingId: fixture.bookingId,
    bookingVersion: 1,
  });

  // Amount integrity is checked against attempt + intent + booking + quote.
  const beforeBadReceipt = await client.query(
    "select count(*)::int as count from payment_receipts_v1",
  );
  await assert.rejects(
    recordVerifiedPaymentEventV1(
      manager(client),
      {
        attemptId,
        bookingId: fixture.bookingId,
        quoteId: fixture.quoteId,
        provider: "synthetic_provider",
        providerEventId: "evt-wrong-amount",
        providerReference: "pay-ref-001",
        payloadHash: "b".repeat(64),
        status: "paid",
        amount: AMOUNT + 1,
        currency: "VND",
        occurredAt: "2026-10-02T01:01:00.000Z",
      },
      new Date("2026-10-02T01:01:00.000Z"),
    ),
    /PAYMENT_COMMERCIAL_INTEGRITY_MISMATCH/,
  );
  const afterBadReceipt = await client.query(
    "select count(*)::int as count from payment_receipts_v1",
  );
  assert.equal(
    afterBadReceipt.rows[0].count,
    beforeBadReceipt.rows[0].count,
    "invalid payment events must roll back their receipt claim",
  );

  // Same verified provider event racing on two DB connections is processed once.
  const raceClient = await connect();
  try {
    const paidEvent = {
      attemptId,
      bookingId: fixture.bookingId,
      quoteId: fixture.quoteId,
      provider: "synthetic_provider",
      providerEventId: "evt-paid-001",
      providerReference: "pay-ref-001",
      payloadHash: "a".repeat(64),
      status: "paid",
      amount: AMOUNT,
      currency: "VND",
      occurredAt: "2026-10-02T01:02:00.000Z",
    };
    const race = await Promise.all([
      recordVerifiedPaymentEventV1(
        manager(client),
        paidEvent,
        new Date("2026-10-02T01:02:00.000Z"),
      ),
      recordVerifiedPaymentEventV1(
        manager(raceClient),
        paidEvent,
        new Date("2026-10-02T01:02:00.000Z"),
      ),
    ]);
    assert.deepEqual(
      race.map((item) => item.outcome).sort(),
      ["processed", "replayed"],
    );
    assert.ok(race.every((item) => item.bookingState === "paid"));
    assert.ok(race.every((item) => item.bookingVersion === 2));
    assert.ok(race.every((item) => item.paymentStatus === "paid"));
  } finally {
    await raceClient.end();
  }

  const paidBooking = await client.query(
    `select state, version, payment_status
       from bookings where id=$1`,
    [fixture.bookingId],
  );
  assert.deepEqual(
    {
      state: paidBooking.rows[0].state,
      version: Number(paidBooking.rows[0].version),
      payment_status: paidBooking.rows[0].payment_status,
    },
    { state: "paid", version: 2, payment_status: "paid" },
  );

  const paymentRows = await client.query(
    `select i.status as intent_status, i.version as intent_version,
            a.status as attempt_status, a.provider_reference,
            r.payload_hash, r.result_payment_status, r.result_booking_state,
            r.result_booking_version
       from payment_intents_v1 i
       join payment_attempts_v1 a on a.intent_id=i.id
       join payment_receipts_v1 r on r.attempt_id=a.id
      where i.id=$1 and r.provider_event_id='evt-paid-001'`,
    [intentId],
  );
  assert.deepEqual(
    {
      intent_status: paymentRows.rows[0].intent_status,
      intent_version: Number(paymentRows.rows[0].intent_version),
      attempt_status: paymentRows.rows[0].attempt_status,
      provider_reference: paymentRows.rows[0].provider_reference,
      payload_hash: paymentRows.rows[0].payload_hash,
      result_payment_status: paymentRows.rows[0].result_payment_status,
      result_booking_state: paymentRows.rows[0].result_booking_state,
      result_booking_version: Number(
        paymentRows.rows[0].result_booking_version,
      ),
    },
    {
      intent_status: "paid",
      intent_version: 2,
      attempt_status: "paid",
      provider_reference: "pay-ref-001",
      payload_hash: "a".repeat(64),
      result_payment_status: "paid",
      result_booking_state: "paid",
      result_booking_version: 2,
    },
  );

  // Reusing the provider event id with different bytes is rejected fail-closed.
  await assert.rejects(
    recordVerifiedPaymentEventV1(
      manager(client),
      {
        attemptId,
        bookingId: fixture.bookingId,
        quoteId: fixture.quoteId,
        provider: "synthetic_provider",
        providerEventId: "evt-paid-001",
        providerReference: "pay-ref-001",
        payloadHash: "c".repeat(64),
        status: "paid",
        amount: AMOUNT,
        currency: "VND",
        occurredAt: "2026-10-02T01:03:00.000Z",
      },
      new Date("2026-10-02T01:03:00.000Z"),
    ),
    /PAYMENT_RECEIPT_REPLAY_MISMATCH/,
  );

  // Refund-pending is owned by this contract and is version-checked.
  const refundPending = await beginRefundV1(
    manager(client),
    {
      bookingId: fixture.bookingId,
      expectedBookingVersion: 2,
    },
    new Date("2026-10-02T01:04:00.000Z"),
  );
  assert.deepEqual(refundPending, {
    bookingId: fixture.bookingId,
    bookingState: "refund_pending",
    bookingVersion: 3,
    paymentStatus: "paid",
  });
  await assert.rejects(
    beginRefundV1(
      manager(client),
      {
        bookingId: fixture.bookingId,
        expectedBookingVersion: 2,
      },
      new Date("2026-10-02T01:04:01.000Z"),
    ),
    /PAYMENT_REFUND_VERSION_CONFLICT/,
  );

  const refunded = await recordVerifiedPaymentEventV1(
    manager(client),
    {
      attemptId,
      bookingId: fixture.bookingId,
      quoteId: fixture.quoteId,
      provider: "synthetic_provider",
      providerEventId: "evt-refunded-001",
      providerReference: "pay-ref-001",
      payloadHash: "d".repeat(64),
      status: "refunded",
      amount: AMOUNT,
      currency: "VND",
      occurredAt: "2026-10-02T01:05:00.000Z",
    },
    new Date("2026-10-02T01:05:00.000Z"),
  );
  assert.deepEqual(refunded, {
    outcome: "processed",
    bookingId: fixture.bookingId,
    bookingState: "refunded",
    bookingVersion: 4,
    paymentStatus: "refunded",
  });

  const finalBooking = await client.query(
    `select state, version, payment_status
       from bookings where id=$1`,
    [fixture.bookingId],
  );
  assert.deepEqual(
    {
      state: finalBooking.rows[0].state,
      version: Number(finalBooking.rows[0].version),
      payment_status: finalBooking.rows[0].payment_status,
    },
    { state: "refunded", version: 4, payment_status: "refunded" },
  );

  // Audit/outbox content is stable identifiers only - never guest PII/raw body.
  const audit = await client.query(
    `select
       (select jsonb_agg(payload order by aggregate_version)
          from outbox_events
         where aggregate_id in ($1, $2)) as outbox_payloads,
       (select jsonb_agg(payload order by version)
          from booking_events
         where booking_id=$1) as booking_payloads,
       (select jsonb_agg(jsonb_build_object(
          'provider', provider,
          'provider_event_id', provider_event_id,
          'payload_hash', payload_hash,
          'event_status', event_status))
          from payment_receipts_v1
         where attempt_id=$3) as receipts`,
    [fixture.bookingId, intentId, attemptId],
  );
  const auditJson = JSON.stringify(audit.rows[0]);
  assert.ok(!auditJson.includes("payment-contract@example.invalid"));
  assert.ok(!auditJson.includes("SYNTHETIC PAYMENT GUEST"));
  assert.ok(!auditJson.includes("0000000000"));
  assert.ok(!auditJson.includes("rawBody"));
  assert.ok(auditJson.includes("a".repeat(64)));
  assert.ok(auditJson.includes("d".repeat(64)));

  const eventCounts = await client.query(
    `select
       (select count(*)::int from payment_receipts_v1
         where attempt_id=$1) as receipts,
       (select count(*)::int from booking_events
         where booking_id=$2) as booking_events,
       (select count(*)::int from outbox_events
         where aggregate_id in ($2, $3)) as outbox`,
    [attemptId, fixture.bookingId, intentId],
  );
  assert.deepEqual(eventCounts.rows[0], {
    receipts: 2,
    booking_events: 3,
    outbox: 6,
  });

  console.log(
    "Payment Contract V1 PASS: offline intent/attempt/receipt schema, amount+currency+quote integrity, replay-safe provider receipts, concurrent duplicate suppression, atomic payment+booking state, versioned refund flow, and PII/raw-payload exclusion.",
  );
} finally {
  await client.end();
}
