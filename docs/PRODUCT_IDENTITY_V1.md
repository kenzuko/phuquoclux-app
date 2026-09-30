# PhuQuocLux product identity V1

Date: 29/09/2026

## Decision

A Product is **not** identified by its category.

These are different concepts:

- Product type: `tour`, `ticket`, `transfer`
- Product id: stable internal identity
- Product slug: public URL identity

Example:

```
type: tour
id: tour-three-islands-cano
slug: tour-3-dao-cano
```

## Why

The previous prototype used routes such as:

`/product/tour`

That structure only allows one Tour product, one Ticket product and one Transfer product.

A real mass marketplace must support:

```
tour
├── Tour 3 đảo
├── Tour 4 đảo
├── Sunset tour
└── Fishing tour
```

without changing the commerce architecture.

## Routing

Public routes now use slugs:

```
/product/:slug
/checkout/:slug
```

The route resolves the slug to a stable Product id.

Commerce, Offer, Quote, Booking and provider calls use Product id.

## Offer ownership

Offer belongs to Product id, not Product type.

```
Product tour-three-islands-cano
  ├── Offer shared
  └── Offer private
```

A second Tour product gets its own independent Offer set.

## Database

`products.id` is the stable primary key.

`products.slug` is unique and public-facing.

Changing a slug later must not change:

- Offer ownership;
- Quote history;
- Booking identity;
- provider mapping;
- Ops references.

## Map / Discovery

Discovery returns:

- product id;
- slug;
- type;
- display summary.

Map links use the slug.

Map category filters use Product type.

This keeps Map UX simple while preserving scalable commerce identity.
