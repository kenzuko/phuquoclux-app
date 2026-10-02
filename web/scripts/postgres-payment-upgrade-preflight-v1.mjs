#!/usr/bin/env node
/**
 * Payment Contract V1 upgrade preflight.
 *
 * Builds the current tracked migration schema first, then overlays the offline
 * payment contract on the same disposable PostgreSQL database. The overlay is
 * intentionally NOT registered in the production migration ledger yet.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigrations } from "./postgres-migrations.mjs";

const url = process.env.PG_TEST_URL;
if (!url || new URL(url).pathname !== "/phuquoclux_contract_test") {
  throw new Error(
    "Set PG_TEST_URL to an isolated /phuquoclux_contract_test database.",
  );
}

const database = "phuquoclux_contract_test";
const contractPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../db/contracts/payment_contract_v1.sql",
);
const contractSql = readFileSync(contractPath, "utf8");

const migrationRun = await applyMigrations(url, `APPLY:${database}`);
assert.ok(
  migrationRun.migrations.length > 0 &&
    migrationRun.migrations.every((item) => item.status === "applied"),
  "all tracked base migrations must be applied before payment overlay",
);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const beforeLedger = await client.query(
    `select filename, checksum
       from pql_schema_migrations
      order by filename`,
  );
  assert.ok(beforeLedger.rows.length > 0, "base migration ledger must exist");
  assert.equal(
    beforeLedger.rows.some((row) => row.filename === "payment_contract_v1.sql"),
    false,
    "offline payment contract must not already be a tracked production migration",
  );

  // Apply twice: the upgrade overlay itself must be safe to re-run on the
  // current tracked schema while it remains outside the migration runner.
  await client.query(contractSql);
  await client.query(contractSql);

  const afterLedger = await client.query(
    `select filename, checksum
       from pql_schema_migrations
      order by filename`,
  );
  assert.deepEqual(
    afterLedger.rows,
    beforeLedger.rows,
    "payment overlay must not mutate the tracked migration ledger",
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
    "payment overlay must sit on the expected current booking contract",
  );

  console.log(
    `postgres-payment-upgrade-preflight-v1: ok (${beforeLedger.rows.length} tracked migrations + offline payment overlay)`,
  );
} finally {
  await client.end();
}
