# PhuQuocLux persistence V1

Date: 29/09/2026  
Status: architecture locked, production connection not enabled

## Decision

The transactional source of truth is **PostgreSQL**.

Cloudflare cache, browser state, Map state, KV-like stores and discovery read models may improve speed, but none of them may become the booking ledger.

## Core transactional tables

```
products
offers
quotes
quote_lines
bookings
booking_events
payments
idempotency_keys
```

Draft migration:

`web/db/migrations/0001_commerce_core.sql`

## Important boundaries

### Product vs Offer

Product answers:

- what is being sold;
- what the traveler sees in discovery;
- where it is linked on the map.

Offer answers:

- which commercial variant;
- price basis;
- provider;
- availability mode;
- policy;
- operational requirements.

Product price on discovery cards is only a `from_price` read-model value.

The transaction uses the selected Offer and then creates a Quote.

### Quote

A Quote is a server-side snapshot.

It stores:

- product;
- offer;
- service date;
- pax;
- line items;
- final quoted total;
- availability snapshot;
- expiry.

A catalog price must never be posted directly to a payment provider.

### Booking

Booking is separate from payment.

The state machine supports both instant-pay and request-first products.

Instant-pay path:

```
draft
→ pending_payment
→ paid
→ pending_confirmation
→ confirmed
→ fulfilled
```

Request-first path:

```
draft
→ pending_confirmation
→ pending_payment
→ paid
→ confirmed
→ fulfilled
```

A provider that can confirm immediately may skip the second confirmation step after payment.

The domain transition guard explicitly allows these branches; UI labels must describe the actual state instead of forcing every vertical into one checkout sequence.

All state changes should write `booking_events`.

## Idempotency

Checkout submits a `requestId`.

In production:

1. claim `requestId` in `idempotency_keys`;
2. if it already exists, return the existing booking;
3. otherwise create Quote/Booking transactionally;
4. never create a second booking because a browser retried a POST.

The current prototype passes the key but does not yet persist or enforce it.

## Personal data

Guest name, email and phone belong in the booking/customer domain.

Do not place PII in:

- URL query strings;
- map state;
- analytics event names;
- provider logs unless required.

## Provider rule

Supplier/provider payloads may be stored as audit JSON, but normalized booking state remains the source used by the app.

## Cloudflare

Workers remains the application runtime.

When PostgreSQL wiring begins, use a Worker-compatible PostgreSQL connection path. The exact connection adapter is intentionally not committed in this step because database infrastructure has not been provisioned yet.

This avoids turning an infrastructure placeholder into an accidental production dependency.


## Concurrency

Booking state changes use optimistic concurrency.

Every Booking has a monotonically increasing `version`.

A transition must update only when both are still true:

- current state equals `expectedFrom`;
- current version equals `expectedVersion`.

The resulting `booking_event.version` is unique per booking.

This prevents a supplier callback, an Ops confirmation and a customer cancellation from silently overwriting one another.
