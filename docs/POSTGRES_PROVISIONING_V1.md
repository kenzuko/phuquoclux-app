# PostgreSQL provisioning and migrations V1

Date: 01/10/2026  
Status: tooling ready, production database not provisioned

## Purpose

This runbook is the only supported path for creating the first PhuQuocLux
transactional schema and then attaching Cloudflare Hyperdrive.

Do not paste migration SQL manually into a production console.

## Assumptions

- the target PostgreSQL database is newly provisioned for PhuQuocLux;
- `public` contains no application tables;
- `DATABASE_URL` is supplied only through the operator shell or a protected
  CI secret;
- production guest access and checkout remain disabled.

The migration runner refuses to auto-adopt a non-empty public schema without
the PhuQuocLux migration ledger.

## Migration safety model

The migration CLI:

- defaults to plan mode;
- never prints the full connection string;
- verifies the database reached by PostgreSQL matches the database name in the
  URL;
- refuses `postgres`, `template0`, and `template1`;
- refuses a non-empty untracked `public` schema;
- uses a session-level PostgreSQL advisory lock so only one migration runner can
  apply at a time;
- records SHA-256 for every applied migration;
- refuses an applied migration whose file checksum later changes;
- applies each pending migration in its own transaction;
- is idempotent when no migration is pending.

## 1. Provision PostgreSQL

Create an empty PostgreSQL database dedicated to PhuQuocLux.

Choose the final database name before migrating. Example only:

```
phuquoclux_booking
```

Do not use the provider's default `postgres` database.

## 2. Set the direct database URL locally

Migrations must use the provider's **direct / unpooled** PostgreSQL connection,
not a PgBouncer/pooled endpoint.

From the `web` directory:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/phuquoclux_booking'
export PQL_MIGRATION_EXPECTED_HOST='EXACT_HOST_FROM_PROVIDER'
export PQL_MIGRATION_EXPECTED_DATABASE='phuquoclux_booking'
```

The runner compares the exact host and database before connecting. Wildcard host
expectations are refused.

Do not commit any of these values and do not paste the connection string into
`wrangler.jsonc`.

### GitHub manual bootstrap path

For an approved infrastructure operation, the repository also contains:

```
.github/workflows/db-bootstrap.yml
```

It is manual-only and the migration job starts only when all of these are true:

- the workflow is dispatched from `main`;
- repository variable `PHUQUOCLUX_DB_BOOTSTRAP_ENABLED=true`;
- repository secret `PHUQUOCLUX_DATABASE_URL_UNPOOLED` exists;
- the operator enters the exact expected database and exact expected host;
- apply mode also receives the exact `APPLY:<database>` confirmation.

The workflow runs plan before apply and plan again after apply. It never creates
a database, never creates Hyperdrive and never enables guest access.

## 3. Plan migrations

```bash
npm run db:migrate:plan
```

For a fresh database, every repository migration should show `pending`.

If the command reports `MIGRATION_UNTRACKED_SCHEMA_REFUSED`, stop. Do not
force adoption or delete tables until the database identity has been checked.

If it reports `MIGRATION_CHECKSUM_MISMATCH`, stop. An already-applied
migration file has drifted and must be investigated rather than reapplied.

## 4. Apply migrations

The apply command requires an exact database-name confirmation:

```bash
export PQL_MIGRATION_CONFIRM='APPLY:phuquoclux_booking'
npm run db:migrate
```

The confirmation string must match the actual database name exactly. When
`PQL_MIGRATION_EXPECTED_HOST` and
`PQL_MIGRATION_EXPECTED_DATABASE` are supplied, those must also match the
connection target exactly before any network connection is opened.

Run plan again:

```bash
npm run db:migrate:plan
```

Every migration must now report `applied`.

## 5. Create Cloudflare Hyperdrive

Cloudflare Hyperdrive should be created only after the origin database is
reachable and migrations are clean.

Keep the origin connection string in the shell so it is not pasted into source:

```bash
npx wrangler hyperdrive create phuquoclux-booking \
  --connection-string="$DATABASE_URL"
```

Cloudflare verifies the database connection and returns a Hyperdrive
configuration id.

Do not commit the origin database URL.

## 6. Bind Hyperdrive to an isolated preview Worker first

After the Hyperdrive id is known, add a binding in a dedicated infrastructure
change:

```json
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<REAL_HYPERDRIVE_ID>"
    }
  ]
}
```

Use the real id only. Never invent a placeholder id in a deployable config.

The Worker compatibility date in this repository is after 2026-08-04, when
Cloudflare enables Node.js compatibility by default, so a redundant
`nodejs_compat` flag is not required.

## 7. Verify preview runtime

Before any production binding change:

1. deploy only the isolated preview Worker;
2. confirm health reports `hyperdriveBindingConfigured=true` and
   `manageBookingDatabaseInjected=true`;
3. exercise database connectivity with synthetic non-customer data only;
4. verify no credential or connection string appears in logs;
5. verify map/discovery still works when database access fails closed.

## 8. Guest access remains independently gated

A working Hyperdrive connection does not enable guest booking access.

Keep:

```
MANAGE_BOOKING_EXCHANGE_ENABLED=false
COMMERCE_MODE=prototype
```

until the delivery provider, manage-link exchange, authenticated booking view,
and operational response path have all been verified against the real runtime.

## 9. Checkout remains separately disabled

Database provisioning is not permission to accept bookings or payments.

Public checkout stays read-only until:

- authoritative pricing is ready;
- supplier availability/confirmation exists;
- durable write path is connected;
- outbox delivery and reconciliation exist;
- payment is reviewed where required;
- operational handling is ready.

## Rollback principle

Do not edit an applied migration file to undo a schema change.

Create a new forward migration that corrects the schema. The checksum ledger is
designed to make historical migration edits fail loudly.
