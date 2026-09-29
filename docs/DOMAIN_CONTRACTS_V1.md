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
- product summaries;
- only `from_price` display values.

**Discovery never claims availability.**

Current API:

`GET /api/discovery`

Example:

`/api/discovery?category=tour&west=103.90&south=9.95&east=104.05&north=10.10`

## Product and Offer

Product is the discoverable thing.

Offer is the commercial variant.

Examples:

```
Product: Tour 3 đảo bằng cano
  ├── Offer: Ghép đoàn
  └── Offer: Cano riêng
```

Each Offer owns:

- explicit price;
- price basis;
- provider id;
- availability mode;
- policy summary;
- operational fields.

The app no longer models Offer pricing as a multiplier on Product.

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

- product;
- offer;
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

Repository contracts now exist for:

- Quote;
- Booking;
- idempotency.

No cache or Map state may implement the production booking ledger.

## Map rule

`MapEntity` remains a spatial/discovery concept.

It does not know:

- payment state;
- booking state;
- supplier confirmation;
- inventory ledger.

This boundary is non-negotiable for the Map-first architecture.
