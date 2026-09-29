# PhuQuocLux domain contracts V1

Date: 29/09/2026

## Purpose

Keep Map discovery, commerce state and supplier integrations separated before real inventory is connected.

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
- only "from price" display values.

**Discovery never claims availability.**

The current API stub is:

`GET /api/discovery`

Example:

`/api/discovery?category=tour&west=103.90&south=9.95&east=104.05&north=10.10`

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
- selected option;
- availability snapshot.

A Quote has an expiry.

The UI must not carry a raw catalog price directly into payment.

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

## Map rule

`MapEntity` remains a spatial/discovery concept.

It does not know:
- payment state;
- booking state;
- supplier confirmation;
- inventory ledger.

This boundary is non-negotiable for the Map-first architecture.
