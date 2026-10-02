#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  bindPaymentProviderReferenceV1,
  createOrReplayPaymentIntentAttemptV1,
} from "../app/repositories/postgres-payment-checkout-readiness-v1.server.ts";
import { applyMigrations } from "./postgres-migrations.mjs";

const url = process.env.PG_TEST_URL;
if (!url || new URL(url).pathname !== "/phuquoclux_contract_test") {
  throw new Error(
    "Set PG_TEST_URL to an isolated /phuquoclux_contract_test database.",
  );
}

const contractSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../db/contracts/payment_contract_v1.sql",
  ),
  "utf8",
);
const TIME = "2026-10-02T09:30:00.000Z";
const AMOUNT = 1450000;
const PROVIDER = "synthetic_checkout_provider";

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

async function seedPayableBooking(client, suffix) {
  const quoteId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  const productId = `checkout-readiness-product-${suffix}-${crypto.randomUUID()}`;
  const offerId = `checkout-readiness-offer-${suffix}-${crypto.randomUUID()}`;

  await client.query(
    `insert into products (id, slug, product_type, name)
     values ($1, $2, 'tour', 'SYNTHETIC CHECKOUT READINESS PRODUCT')`,
    [productId, `${productId}-slug`],
  );
  await client.query(
    `insert into offers
      (id, product_id, provider_id, status, availability_mode,
       pricing_mode, price_amount, price_currency, price_basis, price_source,
       price_state)
     values ($1, $2, 'synthetic-checkout-supplier', 'active', 'live',
             'flat', $3, 'VND', 'per_booking', 'provider_api', 'final')`,
    [offerId, productId, AMOUNT],
  );
  await client.query(
    `insert into quotes
      (id, product_id, offer_id, status, price_state, service_date, pax,
       total_amount, currency, availability_snapshot, created_at, expires_at,
       accepted_at)
     values ($1, $2, $3, 'accepted', 'final', '2026-10-20', 2,
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
      "2026-10-02T10:30:00.000Z",
    ],
  );
  await client.query(
    `insert into bookings
      (id, request_id, guest_name, guest_email, guest_phone, product_id,
       offer_id, quote_id, state, version, payment_status, service_date, pax,
       total_amount, currency, operational_data, created_at, updated_at)
     values ($1, $2, 'SYNTHETIC CHECKOUT GUEST',
             'checkout-readiness@example.invalid', '0000000000', $3, $4, $5,
             'pending_payment', 1, 'unpaid', '2026-10-20', 2, $6, 'VND',
             '{}'::jsonb, $7, $7)`,
    [bookingId, requestId, productId, offerId, quoteId, AMOUNT, TIME],
  );

  return { bookingId, quoteId };
}

await applyMigrations(url, "APPLY:phuquoclux_contract_test");
const client = await connect();
try {
  await client.query(contractSql);

  const firstBooking = await seedPayableBooking(client, "a");
  const requestKey = crypto.randomUUID();
  const firstInput = {
    intentId: crypto.randomUUID(),
    attemptId: crypto.randomUUID(),
    bookingId: firstBooking.bookingId,
    quoteId: firstBooking.quoteId,
    provider: PROVIDER,
    requestKey,
    amount: AMOUNT,
    currency: "VND",
  };

  const created = await createOrReplayPaymentIntentAttemptV1(
    manager(client),
    firstInput,
    new Date(TIME),
  );
  assert.deepEqual(created, {
    outcome: "created",
    intentId: firstInput.intentId,
    attemptId: firstInput.attemptId,
    bookingId: firstBooking.bookingId,
    bookingVersion: 1,
    provider: PROVIDER,
    attemptStatus: "created",
  });

  // Retry identity is requestKey + commercial identity. Proposed UUIDs may be
  // regenerated, but the existing canonical attempt wins.
  const replayed = await createOrReplayPaymentIntentAttemptV1(
    manager(client),
    {
      ...firstInput,
      intentId: crypto.randomUUID(),
      attemptId: crypto.randomUUID(),
    },
    new Date("2026-10-02T09:30:01.000Z"),
  );
  assert.deepEqual(replayed, {
    outcome: "replayed",
    intentId: firstInput.intentId,
    attemptId: firstInput.attemptId,
    bookingId: firstBooking.bookingId,
    bookingVersion: 1,
    provider: PROVIDER,
    attemptStatus: "created",
  });

  await assert.rejects(
    createOrReplayPaymentIntentAttemptV1(
      manager(client),
      { ...firstInput, amount: AMOUNT + 1 },
      new Date("2026-10-02T09:30:02.000Z"),
    ),
    /PAYMENT_REQUEST_REPLAY_MISMATCH/,
  );

  await assert.rejects(
    createOrReplayPaymentIntentAttemptV1(
      manager(client),
      { ...firstInput, requestKey: crypto.randomUUID() },
      new Date("2026-10-02T09:30:03.000Z"),
    ),
    /PAYMENT_INTENT_ALREADY_EXISTS/,
  );

  const bindInput = {
    attemptId: firstInput.attemptId,
    bookingId: firstBooking.bookingId,
    quoteId: firstBooking.quoteId,
    provider: PROVIDER,
    providerReference: "provider-checkout-ref-001",
    amount: AMOUNT,
    currency: "VND",
  };
  const attached = await bindPaymentProviderReferenceV1(
    manager(client),
    bindInput,
    new Date("2026-10-02T09:31:00.000Z"),
  );
  assert.deepEqual(attached, {
    outcome: "attached",
    intentId: firstInput.intentId,
    attemptId: firstInput.attemptId,
    bookingId: firstBooking.bookingId,
    provider: PROVIDER,
    providerReference: bindInput.providerReference,
    attemptStatus: "created",
  });

  const bindReplay = await bindPaymentProviderReferenceV1(
    manager(client),
    bindInput,
    new Date("2026-10-02T09:31:01.000Z"),
  );
  assert.equal(bindReplay.outcome, "replayed");
  assert.equal(bindReplay.providerReference, bindInput.providerReference);

  await assert.rejects(
    bindPaymentProviderReferenceV1(
      manager(client),
      { ...bindInput, providerReference: "provider-checkout-ref-different" },
      new Date("2026-10-02T09:31:02.000Z"),
    ),
    /PAYMENT_PROVIDER_REFERENCE_MISMATCH/,
  );

  const secondBooking = await seedPayableBooking(client, "b");
  const secondInput = {
    intentId: crypto.randomUUID(),
    attemptId: crypto.randomUUID(),
    bookingId: secondBooking.bookingId,
    quoteId: secondBooking.quoteId,
    provider: PROVIDER,
    requestKey: crypto.randomUUID(),
    amount: AMOUNT,
    currency: "VND",
  };
  await createOrReplayPaymentIntentAttemptV1(
    manager(client),
    secondInput,
    new Date("2026-10-02T09:32:00.000Z"),
  );
  await assert.rejects(
    bindPaymentProviderReferenceV1(
      manager(client),
      {
        attemptId: secondInput.attemptId,
        bookingId: secondBooking.bookingId,
        quoteId: secondBooking.quoteId,
        provider: PROVIDER,
        providerReference: bindInput.providerReference,
        amount: AMOUNT,
        currency: "VND",
      },
      new Date("2026-10-02T09:32:01.000Z"),
    ),
    /PAYMENT_PROVIDER_REFERENCE_ALREADY_BOUND/,
  );

  const stored = await client.query(
    `select request_key::text, provider_reference, status
       from payment_attempts_v1 where id=$1`,
    [firstInput.attemptId],
  );
  assert.deepEqual(stored.rows[0], {
    request_key: requestKey,
    provider_reference: bindInput.providerReference,
    status: "created",
  });

  console.log("postgres-payment-checkout-readiness-v1: ok");
} finally {
  await client.end();
}
