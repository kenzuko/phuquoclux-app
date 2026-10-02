# Payment Contract V1

Status: **OFFLINE CONTRACT ONLY**

Payment Contract V1 defines the database and transaction boundary required before any real payment provider, public payment route, checkout activation, or production database migration is allowed.

## Safety boundary

This contract does **not**:

- choose or connect a real payment provider;
- expose a public mutation or webhook route;
- activate checkout or payment in production;
- add Cloudflare/Hyperdrive production bindings;
- add a production migration;
- persist provider secrets, raw webhook bodies, or guest PII from payment callbacks.

The SQL contract is intentionally stored at `web/db/contracts/payment_contract_v1.sql`, outside `web/db/migrations/`. The guarded production migration runner therefore cannot apply it.

## Model

### Payment intent

One `payment_intents_v1` row belongs to exactly one booking and its immutable quote identity. It owns:

- booking and quote linkage;
- amount and currency;
- provider-neutral payment lifecycle status;
- optimistic `version` for payment-side sequencing.

### Payment attempt

`payment_attempts_v1` allows one intent to have provider attempts without changing the booking identity. Each attempt has:

- provider id;
- unique request key;
- optional provider reference;
- amount/currency copied for integrity checks;
- provider-neutral attempt status.

### Verified payment receipt

`payment_receipts_v1` is the replay ledger for already verified provider events.

Identity is `(provider, provider_event_id)`. The row stores only:

- stable provider/event/attempt identifiers;
- SHA-256 payload hash;
- normalized event status;
- normalized result needed to return an identical replay result.

It never stores the raw webhook body.

## Commercial integrity

A payment intent can be created only when all of the following agree:

- booking is `pending_payment` and `unpaid`;
- quote is `accepted` and `final`;
- booking points to the supplied quote;
- booking amount/currency equals quote amount/currency;
- supplied payment amount/currency equals both booking and quote.

A verified provider event re-checks attempt, intent, booking, quote, provider, amount and currency before any state is changed.

## State ownership

The normal booking transition writer continues to reject payment-coupled states. Payment Contract V1 is the only offline writer allowed to own these transitions in its disposable test boundary.

Normalized behavior:

| Payment event/action | Required booking/payment state | Result |
| --- | --- | --- |
| `authorized` | `pending_payment` + `unpaid/authorized` | booking stays `pending_payment`, payment becomes `authorized` |
| `paid` | `pending_payment` + `unpaid/authorized` | booking becomes `paid`, payment becomes `paid` |
| `failed` | `pending_payment` + `unpaid/authorized` | booking becomes `failed`, payment becomes `failed` |
| `beginRefundV1` | booking `paid/cancelled`, payment `paid/partially_refunded` | booking becomes `refund_pending` with optimistic version increment |
| `partially_refunded` | `refund_pending` + `paid/partially_refunded` | payment becomes `partially_refunded` |
| `refunded` | `refund_pending` + `paid/partially_refunded` | booking becomes `refunded`, payment becomes `refunded` |

Every booking state change writes `booking_events` and a PII-free transactional outbox row in the same transaction. Payment status/refund actions also write a PII-free payment outbox row.

## Replay and concurrency

- Receipt claim uses the unique `(provider, provider_event_id)` key.
- A concurrent duplicate event can have only one first processor.
- Exact replay returns the previously committed normalized result.
- Reusing the event id with different payload hash/attempt/status is rejected.
- Booking, payment intent and attempt rows are locked during a first event application.
- Booking state transitions use the existing booking `version` contract.
- Refund initiation requires the caller's expected booking version.

## Test gate

`npm run test:db` runs both the existing booking contract suite and `postgres-payment-contract-v1.mjs` against the disposable PostgreSQL service created by GitHub Actions.

The payment suite covers:

- DDL idempotency;
- amount/currency/quote/booking integrity;
- rollback of an invalid event receipt;
- concurrent duplicate webhook processing;
- exact replay and mismatched replay rejection;
- atomic paid state transition;
- versioned refund initiation;
- refunded state transition;
- exclusion of guest PII and raw webhook payloads from payment audit/outbox records.

## Production gate remains closed

Before this contract can become a forward production migration or a public runtime capability, a later change must explicitly identify and review:

1. the real PostgreSQL/Hyperdrive production target;
2. a selected payment provider adapter and its signature-verification rules;
3. secret ownership and rotation;
4. webhook ingress/rate-limit/replay controls;
5. checkout activation and failure UX;
6. production migration plan and rollback/forward-fix procedure;
7. end-to-end tests proving no double charge, no cross-booking mutation, and safe refund behavior.

Until those gates are separately satisfied, payment and public checkout remain disabled.
