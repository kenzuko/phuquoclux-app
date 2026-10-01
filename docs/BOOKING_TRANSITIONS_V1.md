# Durable booking transitions V1

Date: 01/10/2026  
Status: PostgreSQL contract implemented, payment transitions intentionally excluded

## Purpose

Booking state changes must never be free-form `UPDATE bookings SET state=...`.

Every durable transition must:

- declare the expected current state;
- declare the expected booking version;
- pass the domain state-machine guard;
- increment version atomically;
- write one `booking_events` row;
- write one PII-free outbox event;
- commit all three changes in one PostgreSQL transaction.

## Optimistic concurrency

The update succeeds only when both still match:

```
state = expectedFrom
version = expectedVersion
```

If another Ops/provider/customer action wins first, the stale transition returns
`conflict` with the current state/version and writes no event or outbox row.

This prevents silent last-write-wins behavior.

## Audit fields

Every transition requires:

- a stable allow-listed reason code;
- source: `ops`, `provider`, `customer`, or `system`.

Arbitrary reason/source strings are not persisted.

The booking event payload contains only the source.

The outbox payload contains only:

- booking id;
- from state;
- to state;
- new version;
- reason code;
- source.

Guest name, email, phone, guest note and access/session tokens are excluded.

## Payment boundary

This writer deliberately refuses any transition where either side is:

- `paid`;
- `refund_pending`;
- `refunded`.

Those states require a separate payment contract that updates booking state and
`payment_status` consistently in the same transaction.

Entering `pending_payment` is allowed because it does not by itself claim that
money has moved.

## Current reason codes

- `OPS_CONFIRMED`
- `PROVIDER_CONFIRMED`
- `CUSTOMER_CANCEL_REQUESTED`
- `OPS_CANCELLED`
- `PROVIDER_REJECTED`
- `SERVICE_FULFILLED`
- `PAYMENT_REQUIRED`
- `BOOKING_EXPIRED`
- `SYSTEM_FAILURE`
- `OPS_RESTORED`

## Current activation boundary

The writer is backend-only.

There is no public route, provider webhook, Ops mutation route or payment webhook
connected to it yet.

Future callers must reuse this writer instead of issuing direct booking-state
updates.
