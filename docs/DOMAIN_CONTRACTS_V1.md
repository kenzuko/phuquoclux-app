# PhuQuocLux domain contracts V1

Date: 29/09/2026

## Purpose

Keep Map discovery, Product, Offer, commerce state and supplier integrations separated before real inventory is connected.

## Discovery

`DiscoveryQuery` accepts:

- viewport bounds;
- category;
- free-text query;
- optional date;
- optional pax.

It returns:

- MapEntities;
- product summaries with stable Product id + public slug;
- only `from_price` display values.

**Discovery never claims availability.**

Current API:

`GET /api/discovery`

Example:

`/api/discovery?category=tour&west=103.90&south=9.95&east=104.05&north=10.10`

## Product identity

Product category is not Product identity.

A Product has:

- stable internal `id`;
- public `slug`;
- `type` for category/filtering.

Public routes use slug:

```
/product/:slug
/checkout/:slug
```

Commerce state uses Product id.

See `PRODUCT_IDENTITY_V1.md`.

## Product and Offer

Product is the discoverable thing.

Offer is the commercial variant and belongs to a Product id.

Example:

```
Product: tour-three-islands-cano
  ├── Offer: shared
  └── Offer: private
```

Each Offer owns:

- explicit price;
- price basis;
- provider id;
- availability mode;
- policy summary;
- operational fields.

The app does not model Offer pricing as a multiplier on Product and Product no longer duplicates transaction pricing.

## Availability

Availability is evaluated only after meaningful purchase intent.

States:

- `available`
- `limited`
- `request`
- `sold_out`
- `unknown`

Every result records:

- checked timestamp;
- source;
- optional expiry.

Do not convert `unknown` or stale cache into `available`.

## Quote

A Quote is a priced snapshot for:

- stable Product id;
- Offer;
- service date;
- pax;
- availability snapshot.

A Quote has an expiry.

The UI must not carry a raw discovery/catalog price directly into payment.

## Booking

Booking is separate from Payment.

Booking lifecycle:

```
draft
→ pending_payment
→ paid
→ pending_confirmation
→ confirmed
→ fulfilled
```

Branches:

```
cancel_requested
cancelled
refund_pending
refunded
failed
expired
```

State changes must satisfy the domain transition guard and should be written to `booking_events`.

## Provider adapters

External suppliers sit behind `ProviderAdapter`.

Capabilities are explicit:

- availability
- pricing
- hold
- confirm
- modify
- cancel
- voucher

A provider that does not expose live availability must not implement the product UI as if it did.

## Persistence

PostgreSQL is the intended transactional source of truth.

Repository contracts exist for:

- Quote;
- Booking;
- idempotency;
- outbox;
- webhook receipts.

No cache or Map state may implement the production booking ledger.

## Map rule

`MapEntity` remains a spatial/discovery concept.

It does not know:

- payment state;
- booking state;
- supplier confirmation;
- inventory ledger.

This boundary is non-negotiable for the Map-first architecture.

## Service date

Travel service dates use the Phu Quoc/Vietnam calendar boundary:

`Asia/Ho_Chi_Minh`

The browser may propose a date, but the server normalizes the transaction date and never accepts a past service date because of timezone drift or a hand-edited URL.

## Prototype Quote continuity

The prototype checkout carries the Quote identity shown on the checkout page through form submission.

On submit the server:

1. reads the displayed Quote receipt;
2. re-checks current authoritative Offer pricing and Availability;
3. rejects the request if the displayed Quote has expired or materially changed;
4. preserves the original Quote id only when the current server-side result still matches.

This is a prototype bridge until Quotes are durably stored in PostgreSQL.

The receipt is not a payment authorization and is not treated as trusted pricing input.
