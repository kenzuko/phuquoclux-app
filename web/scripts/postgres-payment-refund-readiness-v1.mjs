#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createOrReplayPaymentIntentAttemptV1 } from "../app/repositories/postgres-payment-checkout-readiness-v1.server.ts";
import { recordVerifiedPaymentEventV1 } from "../app/repositories/postgres-payment-contract-v1.server.ts";
import { prepareOrReplayPaymentRefundV1 } from "../app/repositories/postgres-payment-refund-readiness-v1.server.ts";

const url = process.env.PG_TEST_URL;
if (!url || new URL(url).pathname !== "/phuquoclux_contract_test") {
  throw new Error("Set PG_TEST_URL to an isolated /phuquoclux_contract_test database.");
}

const contractSql = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../db/contracts/payment_contract_v1.sql"),
  "utf8",
);
const AMOUNT = 970000;
const TIME = "2026-10-02T09:00:00.000Z";

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
        const result = await work({ query: (sql, parameters) => client.query(sql, parameters) });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  };
}

async function seedPayableBooking(client, label) {
  const token = crypto.randomUUID().slice(0, 8);
  const productId = `refund-ready-product-${label}-${token}`;
  const offerId = `refund-ready-offer-${label}-${token}`;
  const quoteId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();

  await client.query(
    `insert into products (id, slug, product_type, name)
     values ($1, $2, 'tour', 'SYNTHETIC REFUND READINESS PRODUCT')`,
    [productId, `${productId}-slug`],
  );
  await client.query(
    `insert into offers
      (id, product_id, provider_id, status, availability_mode,
       pricing_mode, price_amount, price_currency, price_basis, price_source,
       price_state)
     values ($1, $2, 'synthetic-refund-supplier', 'active', 'live',
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
      JSON.stringify({ state: "available", checkedAt: TIME, source: "provider_api" }),
      TIME,
      "2026-10-02T10:00:00.000Z",
    ],
  );
  await client.query(
    `insert into bookings
      (id, request_id, guest_name, guest_email, guest_phone, product_id,
       offer_id, quote_id, state, version, payment_status, service_date, pax,
       total_amount, currency, operational_data, created_at, updated_at)
     values ($1, $2, 'SYNTHETIC REFUND GUEST',
             'refund-readiness@example.invalid', '0000000000', $3, $4, $5,
             'pending_payment', 1, 'unpaid', '2026-10-10', 2, $6, 'VND',
             '{}'::jsonb, $7, $7)`,
    [bookingId, crypto.randomUUID(), productId, offerId, quoteId, AMOUNT, TIME],
  );

  return { bookingId, quoteId };
}

async function makePaid(client, label, withProviderReference = true) {
  const fixture = await seedPayableBooking(client, label);
  const intentId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const providerReference = `pay-refund-${label}-${crypto.randomUUID().slice(0, 8)}`;

  await createOrReplayPaymentIntentAttemptV1(
    manager(client),
    {
      intentId,
      attemptId,
      bookingId: fixture.bookingId,
      quoteId: fixture.quoteId,
      provider: "synthetic_refund_provider",
      requestKey: crypto.randomUUID(),
      amount: AMOUNT,
      currency: "VND",
    },
    new Date(TIME),
  );

  await recordVerifiedPaymentEventV1(
    manager(client),
    {
      attemptId,
      bookingId: fixture.bookingId,
      quoteId: fixture.quoteId,
      provider: "synthetic_refund_provider",
      providerEventId: `evt-paid-${label}-${crypto.randomUUID()}`,
      ...(withProviderReference ? { providerReference } : {}),
      payloadHash: "a".repeat(64),
      status: "paid",
      amount: AMOUNT,
      currency: "VND",
      occurredAt: "2026-10-02T09:01:00.000Z",
    },
    new Date("2026-10-02T09:01:00.000Z"),
  );

  return { ...fixture, intentId, attemptId, providerReference };
}

const client = await connect();
try {
  await client.query(contractSql);

  const first = await makePaid(client, "first");
  const refundInput = { bookingId: first.bookingId, expectedBookingVersion: 2 };
  const created = await prepareOrReplayPaymentRefundV1(
    manager(client),
    refundInput,
    new Date("2026-10-02T09:02:00.000Z"),
  );
  assert.equal(created.outcome, "created");
  assert.match(created.refundRequestId, /^[0-9a-f-]{36}$/i);
  assert.equal(created.bookingState, "refund_pending");
  assert.equal(created.bookingVersion, 3);
  assert.equal(created.intentId, first.intentId);
  assert.equal(created.attemptId, first.attemptId);
  assert.equal(created.provider, "synthetic_refund_provider");
  assert.equal(created.providerReference, first.providerReference);
  assert.equal(created.amount, AMOUNT);
  assert.equal(created.currency, "VND");

  const replayed = await prepareOrReplayPaymentRefundV1(
    manager(client),
    refundInput,
    new Date("2026-10-02T09:02:01.000Z"),
  );
  assert.equal(replayed.outcome, "replayed");
  assert.equal(replayed.refundRequestId, created.refundRequestId);
  assert.deepEqual(
    { intentId: replayed.intentId, attemptId: replayed.attemptId, providerReference: replayed.providerReference },
    { intentId: first.intentId, attemptId: first.attemptId, providerReference: first.providerReference },
  );

  const firstOutbox = await client.query(
    `select count(*)::int as count
       from outbox_events
      where event_name='payment.refund_requested'
        and aggregate_id=$1`,
    [first.intentId],
  );
  assert.equal(firstOutbox.rows[0].count, 1, "exact retry must not create a second refund command");

  await assert.rejects(
    prepareOrReplayPaymentRefundV1(
      manager(client),
      { bookingId: first.bookingId, expectedBookingVersion: 3 },
      new Date("2026-10-02T09:02:02.000Z"),
    ),
    /PAYMENT_REFUND_VERSION_CONFLICT/,
  );

  const raced = await makePaid(client, "race");
  const raceClient = await connect();
  try {
    const input = { bookingId: raced.bookingId, expectedBookingVersion: 2 };
    const results = await Promise.all([
      prepareOrReplayPaymentRefundV1(manager(client), input, new Date("2026-10-02T09:03:00.000Z")),
      prepareOrReplayPaymentRefundV1(manager(raceClient), input, new Date("2026-10-02T09:03:00.000Z")),
    ]);
    assert.deepEqual(results.map((item) => item.outcome).sort(), ["created", "replayed"]);
    assert.equal(results[0].refundRequestId, results[1].refundRequestId);
  } finally {
    await raceClient.end();
  }
  const raceOutbox = await client.query(
    `select count(*)::int as count
       from outbox_events
      where event_name='payment.refund_requested'
        and aggregate_id=$1`,
    [raced.intentId],
  );
  assert.equal(raceOutbox.rows[0].count, 1, "concurrent refund requests must converge on one durable command");

  const missingRef = await makePaid(client, "missing-ref", false);
  await assert.rejects(
    prepareOrReplayPaymentRefundV1(
      manager(client),
      { bookingId: missingRef.bookingId, expectedBookingVersion: 2 },
      new Date("2026-10-02T09:04:00.000Z"),
    ),
    /PAYMENT_REFUND_PROVIDER_REFERENCE_MISSING/,
  );
  const missingRefBooking = await client.query(
    `select state, version, payment_status from bookings where id=$1`,
    [missingRef.bookingId],
  );
  assert.deepEqual(
    {
      state: missingRefBooking.rows[0].state,
      version: Number(missingRefBooking.rows[0].version),
      paymentStatus: missingRefBooking.rows[0].payment_status,
    },
    { state: "paid", version: 2, paymentStatus: "paid" },
  );
  const missingRefOutbox = await client.query(
    `select count(*)::int as count
       from outbox_events
      where event_name='payment.refund_requested'
        and aggregate_id=$1`,
    [missingRef.intentId],
  );
  assert.equal(missingRefOutbox.rows[0].count, 0, "missing provider reference must fail before refund state mutation");

  console.log("postgres-payment-refund-readiness-v1: ok");
} finally {
  await client.end();
}
