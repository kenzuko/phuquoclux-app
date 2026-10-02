# Payment Upgrade Preflight V1

Status: **OFFLINE / DISPOSABLE POSTGRESQL ONLY**

This preflight proves that Payment Contract V1 can be overlaid on the current tracked PhuQuocLux schema without silently becoming a production migration.

## What it does

`web/scripts/postgres-payment-upgrade-preflight-v1.mjs`:

1. refuses any database URL except the synthetic `/phuquoclux_contract_test` database;
2. applies the current tracked migrations through the normal migration engine;
3. snapshots `pql_schema_migrations`;
4. applies `db/contracts/payment_contract_v1.sql` twice to prove overlay idempotency;
5. verifies all three payment tables exist;
6. verifies the booking columns Payment V1 depends on still match the current booking contract;
7. verifies the payment overlay did not add, remove, or rewrite any migration-ledger entry.

`npm run test:payment-contract` now runs this upgrade preflight before the functional Payment Contract V1 tests, so the payment test no longer depends implicitly on another test having already initialized the base schema.

## Production boundary

This does **not** move `payment_contract_v1.sql` into `db/migrations` and does not make it eligible for production migration.

A production migration still requires an identified production PostgreSQL target, migration review, rollback/forward-fix plan, Hyperdrive configuration, and explicit activation review.
