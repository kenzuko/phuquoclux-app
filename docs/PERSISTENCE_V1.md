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
offer_unit_rates
quotes
quote_lines
bookings
booking_access_tokens
booking_access_sessions
booking_events
payments
outbox_events
webhook_receipts
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
- pricing mode;
- price basis for flat pricing;
- per-unit rates for mixed pricing such as adult/child tickets;
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

The prototype retains its in-memory domain-test functions, but its public checkout action is now explicitly disabled (HTTP 503) and does not accept guest data. Once durable storage is wired, issue and enforce the idempotency key in the transactional implementation before reopening POST checkout.

## Guest access

Guest checkout requires a durable way for the traveler to return to a booking.

`booking_access_tokens` stores only a hash of an opaque access capability. Raw manage-booking tokens are never persisted and must not be used as analytics identifiers.

The repository now includes driver-neutral PostgreSQL contracts for issuing, hashing, redeeming and revoking manage-booking capabilities and for exchanging an active capability into a separately hashed server-side session. Parent-grant revocation/expiry invalidates child sessions. Disposable PostgreSQL CI covers both layers.

The codebase now includes a disabled-by-default fragment landing (`/manage#<capability>`) and POST-body exchange endpoint (`/manage/exchange`). The raw access capability is therefore not part of a server-visible URL.

The database also owns the invariant that `booking_access_sessions.booking_id` must match the booking attached to its parent access grant. The authenticated My Bookings read model authorizes and reads the booking in one PostgreSQL transaction and returns only guest-safe fields, excluding internal booking/request ids and guest contact data.

The Worker still injects no booking database runtime and explicitly configures the exchange gate off. No email/SMS provider is connected, so no production Set-Cookie exchange or guest booking access is enabled.

See `docs/GUEST_BOOKING_ACCESS_V1.md`.

## Personal data

Guest name, email and phone belong in the booking/customer domain.

Do not place PII in:

- URL query strings;
- map state;
- analytics event names;
- provider logs unless required.

## Provider rule

Supplier/provider payloads may be stored as audit JSON, but normalized booking state remains the source used by the app.

## Outbox delivery

Committed booking events are delivered through the durable PostgreSQL outbox, never inline inside the booking transaction.

The repository now includes lease-based claiming, stale-worker protection, retry backoff, terminal failure state and provider-neutral publishing orchestration. Raw provider errors are never persisted; only stable allow-listed error codes may enter `last_error`.

No external publisher or scheduler is connected yet.

See `docs/OUTBOX_DELIVERY_V1.md`.

## Cloudflare

Workers remains the application runtime.

The repository now contains a lazy Cloudflare Hyperdrive -> `pg` transaction adapter that satisfies the existing PostgreSQL transaction contract. The Worker injects it only when a real `HYPERDRIVE` runtime binding exists.

No Hyperdrive id, database URL or credential is committed to source control, and the current `wrangler.jsonc` intentionally contains no Hyperdrive binding. Therefore merging the adapter cannot connect production PostgreSQL by itself.

See `docs/HYPERDRIVE_RUNTIME_V1.md` and `docs/POSTGRES_PROVISIONING_V1.md`.


## Concurrency

Booking state changes use optimistic concurrency.

Every Booking has a monotonically increasing `version`.

A transition must update only when both are still true:

- current state equals `expectedFrom`;
- current version equals `expectedVersion`.

The resulting `booking_event.version` is unique per booking.

This prevents a supplier callback, an Ops confirmation and a customer cancellation from silently overwriting one another.
