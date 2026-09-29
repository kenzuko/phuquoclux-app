# PhuQuocLux runtime safety gates

Date: 29/09/2026

## Commerce mode

The Worker has an explicit runtime switch:

`COMMERCE_MODE=prototype|live`

Current repository default:

`prototype`

## Prototype mode

Prototype mode may:

- create server-side Quote objects;
- use prototype Offer prices;
- return request-to-book states;
- validate Product → Offer → Availability → Quote → Booking UX.

It does **not** imply:

- PostgreSQL persistence;
- live supplier inventory;
- payment;
- confirmed bookings.

## Live mode

The current prototype checkout intentionally returns HTTP 503 when `COMMERCE_MODE=live`.

This is a safety gate.

Before live commerce can be enabled, all of these must exist:

1. PostgreSQL repositories implemented and migrated;
2. idempotency enforced;
3. authoritative Offer pricing;
4. provider availability/confirmation path;
5. payment integration where required;
6. durable Booking and BookingEvent writes;
7. reconciliation and failure handling.

Changing a Worker variable must never be enough to accidentally turn prototype prices into real transactions.
