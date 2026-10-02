#!/usr/bin/env node
/**
 * Payment Contract V1 tracked-migration preflight.
 *
 * Applies the full tracked migration set to an isolated PostgreSQL database and
 * verifies that Payment Contract V1 is now present in the migration ledger and
 * sits on the expected booking schema.
 */
import assert from "node:assert/strict";
import pg from "pg";
import { applyMigrations } from "./postgres-migrations.mjs";

const url = process.env.PG_TEST_URL;
if (!url || new URL(url).pathname !== "/phuquoclux_contract_test") {
  throw new Error(
    "Set PG_TEST_URL to an isolated /phuquoclux_contract_test database.",
  );
}

const database = "phuquoclux_contract_test";
const migrationRun = await applyMigrations(url, `APPLY:${database}`);
assert.ok(
  migrationRun.migrations.length > 0 &&
    migrationRun.migrations.every((item) => item.status === "applied"),
  "all tracked migrations must be applied",
);
assert.ok(
  migrationRun.migrations.some(
    (item) => item.filename === "0007_payment_contract_v1.sql" && item.status === "applied",
  ),
  "Payment Contract V1 must be a tracked migration",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const ledger = await client.query(
    `select filename, checksum
       from pql_schema_migrations
      order by filename`,
  );
  assert.equal(
    ledger.rows.some((row) => row.filename === "0007_payment_contract_v1.sql"),
    true,
    "payment production migration must be recorded in the ledger",
  );

  const tables = await client.query(
    `select
       to_regclass('public.payment_intents_v1')::text as intents,
       to_regclass('public.payment_attempts_v1')::text as attempts,
       to_regclass('public.payment_receipts_v1')::text as receipts`,
  );
  assert.deepEqual(tables.rows[0], {
    intents: "payment_intents_v1",
    attempts: "payment_attempts_v1",
    receipts: "payment_receipts_v1",
  });

  const bookingColumns = await client.query(
    `select column_name
       from information_schema.columns
      where table_schema='public'
        and table_name='bookings'
        and column_name in ('quote_id', 'state', 'version', 'payment_status', 'total_amount', 'currency')
      order by column_name`,
  );
  assert.deepEqual(
    bookingColumns.rows.map((row) => row.column_name),
    ["currency", "payment_status", "quote_id", "state", "total_amount", "version"],
    "payment migration must sit on the expected current booking contract",
  );

  console.log(
    `postgres-payment-upgrade-preflight-v1: ok (${ledger.rows.length} tracked migrations including Payment Contract V1)`,
  );
} finally {
  await client.end();
}
