#!/usr/bin/env node
/**
 * Synthetic, throwaway PostgreSQL integration test. Run only against an
 * isolated TEST DATABASE. Refuses a URL without the exact test database name.
 * Does not connect any deployed Worker or touch supplier/guest production data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { createPrototypeBookingRequest } from "../app/services/booking.server.ts";
import {
  persistManualBookingRequest,
  bookingRequestFingerprint,
} from "../app/repositories/postgres-booking-core.server.ts";
import {
  hashManageBookingToken,
  issueManageBookingAccess,
  redeemManageBookingAccess,
  revokeManageBookingAccess,
} from "../app/repositories/postgres-booking-access.server.ts";

const url = process.env.PG_TEST_URL;
if (!url || new URL(url).pathname !== "/phuquoclux_contract_test") {
  throw new Error("Set PG_TEST_URL to an isolated /phuquoclux_contract_test database.");
}
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode("SYNTHETIC-TEST-KEY-NOT-FOR-DEPLOYMENT-0001"),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const TIME = "2026-10-01T00:00:00.000Z";
const now = new Date(TIME);

const connect = async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
};
function manager(client) {
  return {
    async transaction(work) {
      await client.query("BEGIN");
      try {
        const result = await work({ query: (sql, params) => client.query(sql, params) });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  };
}
function fixture(overrides = {}) {
  const quote = {
    id: crypto.randomUUID(),
    status: "active",
    priceState: "estimated",
    productType: "tour",
    productId: "tour-three-islands-cano",
    offerId: "tour-three-islands-cano:shared",
    serviceDate: "2026-10-08",
    pax: 2,
    lines: [
      {
        code: "base",
        label: "SYNTHETIC-TEST-LINE",
        quantity: 2,
        unitPrice: { amount: 123456, currency: "VND" },
        total: { amount: 246912, currency: "VND" },
      },
    ],
    total: { amount: 246912, currency: "VND" },
    createdAt: TIME,
    expiresAt: "2026-10-01T00:15:00.000Z",
    availabilitySnapshot: {
      state: "request", checkedAt: TIME, source: "manual",
    },
    ...overrides.quote,
  };
  const booking = createPrototypeBookingRequest({
    requestId: crypto.randomUUID(),
    quote,
    contact: {
      name: "SYNTHETIC-NO-GUEST",
      email: "synthetic-no-guest@example.invalid",
      phone: "0000000000",
    },
    operationalData: { guestNote: "SYNTHETIC-TEST-ONLY" },
  });
  return { quote, booking: { ...booking, ...overrides.booking }, fingerprintKey: key };
}

const one = await connect();
try {
  // This suite MUST use only a dedicated disposable database. The workflow
  // provisions it freshly with an ephemeral Postgres service container.
  for (const filename of [
    "0001_commerce_core.sql",
    "0002_booking_request_fingerprint.sql",
    "0003_booking_access_hash.sql",
  ]) {
    const sql = readFileSync(
      new URL(`../db/migrations/${filename}`, import.meta.url),
      "utf8",
    );
    await one.query(sql);
  }
  await one.query(
    `insert into products (id, slug, product_type, name)
     values ('tour-three-islands-cano', 'test-only-tour', 'tour', 'SYNTHETIC-TEST-PRODUCT')`,
  );
  await one.query(
    `insert into offers
       (id, product_id, provider_id, status, availability_mode,
        pricing_mode, price_amount, price_currency, price_basis, price_source,
        price_state)
     values
       ('tour-three-islands-cano:shared', 'tour-three-islands-cano',
        'jotrip-manual-request', 'active', 'request', 'flat', 123456,
        'VND', 'per_person', 'prototype', 'estimated')`,
  );
  const input = fixture();
  const first = await persistManualBookingRequest(manager(one), input, now);
  assert.equal(first.outcome, "created");
  assert.equal(first.bookingId, input.booking.id);
  const results = await one.query(
    `select (select count(*)::int from idempotency_keys) as keys,
            (select count(*)::int from quotes) as quotes,
            (select count(*)::int from quote_lines) as lines,
            (select count(*)::int from bookings) as bookings,
            (select count(*)::int from outbox_events) as outbox`,
  );
  assert.deepEqual(results.rows[0], {
    keys: 1, quotes: 1, lines: 1, bookings: 1, outbox: 1,
  });
  const stored = await one.query(
    "select request_fingerprint from idempotency_keys where request_id=$1",
    [input.booking.requestId],
  );
  assert.match(stored.rows[0].request_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(
    stored.rows[0].request_fingerprint,
    await bookingRequestFingerprint(input),
  );
  const outbox = await one.query(
    "select event_name, status, payload from outbox_events where aggregate_id=$1",
    [input.booking.id],
  );
  assert.equal(outbox.rows[0].event_name, "booking.requested");
  assert.equal(outbox.rows[0].status, "pending");
  assert.ok(!JSON.stringify(outbox.rows[0].payload).includes(input.booking.contact.email));
  assert.ok(!JSON.stringify(outbox.rows[0].payload).includes(input.booking.contact.phone));
  assert.ok(!JSON.stringify(outbox.rows[0].payload).includes(input.booking.contact.name));

  // Manage-booking capability: raw token is random and returned only once.
  // PostgreSQL stores only its SHA-256 digest and no guest PII is required to
  // authenticate the capability later.
  const issued = await issueManageBookingAccess(
    manager(one),
    input.booking.id,
    "2026-10-08T00:00:00.000Z",
    now,
  );
  assert.match(issued.rawToken, /^[a-f0-9]{64}$/);
  const expectedTokenHash = await hashManageBookingToken(issued.rawToken);
  assert.match(expectedTokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(issued.rawToken, expectedTokenHash);

  const accessRow = await one.query(
    `select id, booking_id, purpose, token_hash, created_at, expires_at,
            revoked_at, last_used_at
       from booking_access_tokens where booking_id=$1`,
    [input.booking.id],
  );
  assert.equal(accessRow.rows.length, 1);
  assert.equal(accessRow.rows[0].booking_id, input.booking.id);
  assert.equal(accessRow.rows[0].purpose, "manage_booking");
  assert.equal(accessRow.rows[0].token_hash, expectedTokenHash);
  assert.ok(!JSON.stringify(accessRow.rows[0]).includes(issued.rawToken));

  const redeemed = await redeemManageBookingAccess(
    manager(one),
    issued.rawToken,
    new Date("2026-10-01T00:01:00.000Z"),
  );
  assert.equal(redeemed.bookingId, input.booking.id);
  assert.equal(redeemed.purpose, "manage_booking");
  const touched = await one.query(
    "select last_used_at from booking_access_tokens where id=$1",
    [redeemed.grantId],
  );
  assert.equal(
    new Date(touched.rows[0].last_used_at).toISOString(),
    "2026-10-01T00:01:00.000Z",
  );

  // Malformed, mutated, unknown, expired and revoked capabilities all fail
  // closed with the same null result instead of leaking booking existence.
  assert.equal(
    await redeemManageBookingAccess(manager(one), issued.rawToken.toUpperCase(), now),
    null,
  );
  assert.equal(
    await redeemManageBookingAccess(manager(one), "0".repeat(64), now),
    null,
  );

  const expiresQuickly = await issueManageBookingAccess(
    manager(one),
    input.booking.id,
    "2026-10-01T00:02:00.000Z",
    now,
  );
  assert.equal(
    await redeemManageBookingAccess(
      manager(one),
      expiresQuickly.rawToken,
      new Date("2026-10-01T00:02:00.000Z"),
    ),
    null,
  );

  const revocable = await issueManageBookingAccess(
    manager(one),
    input.booking.id,
    "2026-10-08T00:00:00.000Z",
    now,
  );
  const beforeRevoke = await redeemManageBookingAccess(
    manager(one),
    revocable.rawToken,
    now,
  );
  assert.ok(beforeRevoke);
  assert.equal(
    await revokeManageBookingAccess(
      manager(one),
      beforeRevoke.grantId,
      input.booking.id,
      new Date("2026-10-01T00:03:00.000Z"),
    ),
    true,
  );
  assert.equal(
    await redeemManageBookingAccess(
      manager(one),
      revocable.rawToken,
      new Date("2026-10-01T00:04:00.000Z"),
    ),
    null,
  );

  const accessCountBeforeUnknown = await one.query(
    "select count(*)::int as count from booking_access_tokens",
  );
  await assert.rejects(
    issueManageBookingAccess(
      manager(one),
      crypto.randomUUID(),
      "2026-10-08T00:00:00.000Z",
      now,
    ),
    /BOOKING_NOT_FOUND/,
  );
  const accessCountAfterUnknown = await one.query(
    "select count(*)::int as count from booking_access_tokens",
  );
  assert.equal(
    accessCountAfterUnknown.rows[0].count,
    accessCountBeforeUnknown.rows[0].count,
  );

  // Migration refuses accidentally storing a raw/non-hash token.
  await assert.rejects(
    one.query(
      `insert into booking_access_tokens
        (id, booking_id, purpose, token_hash, created_at, expires_at)
       values ($1, $2, 'manage_booking', 'NOT-A-HASH', $3, $4)`,
      [
        crypto.randomUUID(),
        input.booking.id,
        TIME,
        "2026-10-08T00:00:00.000Z",
      ],
    ),
  );

  // Expired replays return the *existing* id, without creating another Quote,
  // booking, or Ops event. No guest data or access token is returned.
  const replay = await persistManualBookingRequest(
    manager(one), input, new Date("2026-10-01T00:30:00.000Z"),
  );
  assert.deepEqual(replay, { outcome: "already_exists", bookingId: input.booking.id });
  const changed = {
    ...input,
    booking: {
      ...input.booking,
      contact: { ...input.booking.contact, phone: "9999999999" },
    },
  };
  await assert.rejects(
    persistManualBookingRequest(manager(one), changed, now),
    /BOOKING_REQUEST_ID_REUSED_WITH_DIFFERENT_INPUT/,
  );

  // Invalid quote/booking linkage and fake availability cannot write.
  await assert.rejects(
    persistManualBookingRequest(
      manager(one),
      fixture({ booking: { quoteId: crypto.randomUUID() } }),
      now,
    ),
    /BOOKING_QUOTE_MISMATCH/,
  );
  await assert.rejects(
    persistManualBookingRequest(
      manager(one),
      fixture({ quote: { availabilitySnapshot: {
        state: "available", checkedAt: TIME, source: "manual",
      } } }),
      now,
    ),
    /DURABLE_WRITER_MANUAL_REQUEST_ONLY/,
  );

  // Database rejects an unknown offer AFTER claiming the idempotency key.
  // The transaction must roll back *all* writes, including that key.
  const unknown = fixture({ quote: { offerId: "UNKNOWN-TEST-OFFER" } });
  unknown.booking.offerId = unknown.quote.offerId;
  await assert.rejects(persistManualBookingRequest(manager(one), unknown, now));
  const orphan = await one.query(
    "select count(*)::int as count from idempotency_keys where request_id=$1",
    [unknown.booking.requestId],
  );
  assert.equal(orphan.rows[0].count, 0, "failed write cannot reserve request key");

  // Real PostgreSQL unique-index behavior: two parallel transactions with
  // the same request but independent quote/booking ids must yield one booking.
  const parallelA = fixture();
  const parallelB = fixture({
    booking: {
      requestId: parallelA.booking.requestId,
      contact: parallelA.booking.contact,
      operationalData: parallelA.booking.operationalData,
    },
  });
  const second = await connect();
  try {
    const parallel = await Promise.all([
      persistManualBookingRequest(manager(one), parallelA, now),
      persistManualBookingRequest(manager(second), parallelB, now),
    ]);
    assert.deepEqual(parallel.map(p=>p.outcome).sort(), ["already_exists", "created"]);
    assert.equal(parallel[0].bookingId, parallel[1].bookingId);
  } finally {
    await second.end();
  }

  const counts = await one.query(
    `select (select count(*)::int from idempotency_keys) as keys,
            (select count(*)::int from bookings) as bookings,
            (select count(*)::int from outbox_events) as outbox`,
  );
  assert.deepEqual(counts.rows[0], { keys: 2, bookings: 2, outbox: 2 });
  console.log(
    "PostgreSQL booking contract PASS: booking transaction, HMAC idempotency, rollback/race safety, no-PII outbox, hashed guest access, expiry and revocation.",
  );
} finally {
  await one.end();
}
