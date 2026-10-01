# Hyperdrive PostgreSQL runtime V1

Date: 01/10/2026  
Status: adapter implemented, infrastructure binding not provisioned

## Decision

PhuQuocLux Workers will use Cloudflare Hyperdrive as the production PostgreSQL
connection path when database infrastructure is provisioned.

The application uses `pg` through a transaction adapter that satisfies the
existing `SqlTransactionManager` contract.

## Why this shape

Booking writes and authenticated reads require a single PostgreSQL connection
for the full transaction. The adapter therefore:

- creates one `pg.Client` per application transaction;
- connects only when a transaction is actually requested;
- issues `BEGIN` before handing the transaction to repositories;
- commits only after the callback succeeds;
- rolls back on callback/query failure;
- always closes the client;
- never exposes or logs the connection string.

Hyperdrive maintains the underlying connection pool. Application code does not
create a long-lived global `pg.Pool`.

## Runtime binding

The Worker environment type supports an optional binding:

```
HYPERDRIVE.connectionString
```

No Hyperdrive id, database URL, username or password is committed to this
repository.

The current `wrangler.jsonc` intentionally contains no `hyperdrive` binding.
A real binding must be created only after PostgreSQL infrastructure exists.

## Fail-closed behavior

If the binding is absent or malformed:

- no transaction manager is injected;
- `/manage/exchange` remains incapable of minting a session;
- `/bookings` cannot read booking data;
- the rest of the map/discovery application continues without a database.

Even with a valid Hyperdrive binding, guest access still requires all existing
manage-booking gates. The binding alone never enables checkout or booking access.

## CI contract

Disposable PostgreSQL CI exercises the same `pg` transaction manager without
requiring Cloudflare infrastructure.

The test verifies:

- a real transaction can query PostgreSQL;
- callback failure rolls back all writes;
- the adapter does not replace booking-level idempotency or access controls.

## Provisioning sequence - future infrastructure step

Use `docs/POSTGRES_PROVISIONING_V1.md` as the operational runbook.

1. Provision a fresh dedicated PostgreSQL database.
2. Run `npm run db:migrate:plan`.
3. Apply reviewed migrations only through the guarded migration runner.
4. Run plan again and verify every checksum is tracked.
5. Create a Cloudflare Hyperdrive configuration pointed at that database.
4. Add the real Hyperdrive binding to the Worker deployment configuration.
5. Verify the binding in an isolated preview Worker first.
6. Confirm PostgreSQL transaction/read tests against synthetic non-customer data.
7. Configure canonical manage-booking origin and session TTL.
8. Only after delivery and authenticated read paths are verified, consider
   enabling `MANAGE_BOOKING_EXCHANGE_ENABLED=true`.

Checkout remains a separate gate and must not be activated by this sequence.
