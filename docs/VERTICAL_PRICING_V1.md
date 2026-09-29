# PhuQuocLux vertical pricing V1

Date: 29/09/2026

## Why this exists

Different travel products do not share one pricing model.

A transfer can price per vehicle.

A shared tour can price per person.

A ticket can require a mixed basket such as:

- 2 adults;
- 1 child.

Treating adult and child as separate Offers would make a family booking impossible without creating multiple independent bookings.

## Decision

Offer pricing supports two modes.

### Flat

Used when one commercial price applies to the whole selected quantity.

Examples:

- tour per person;
- private canoe per booking;
- airport vehicle per booking.

### Unit mix

Used when one Offer contains multiple traveler/unit rates.

Example:

```
Hòn Thơm standard ticket
  adult  700,000
  child  504,000
```

A family selection:

```
adult = 2
child = 1
```

creates two Quote lines and one Booking.

## Quote rule

The server, not the browser, creates the priced lines.

The Product page may calculate a preview with the same deterministic pricing function, but checkout re-runs pricing server-side.

The Quote receipt includes a line signature.

Changing the traveler composition after the Quote was displayed invalidates the receipt even if the final total accidentally matches.

## Product type is not pricing mode

Do not hardcode:

`ticket = unit_mix`

Some future tickets may have one flat price, while other tour products may also require multiple participant classes.

Pricing mode belongs to the Offer.

## Future extension

The contract can later add:

- infant/free units;
- senior/student units;
- date-band pricing;
- resident/non-resident rates;
- capacity-linked rates;
- add-ons.

Those should extend Offer pricing or Quote lines without changing Product identity or Booking identity.


## Headline from-price

For mixed-unit products, the smallest numeric rate is not automatically the public "from" price.

A child or concession rate may have eligibility rules and should not make the whole product appear cheaper than the normal entry rate.

`UnitMixPricing.headlineUnitCode` selects the rate used for discovery/product "from" pricing.

The Hòn Thơm prototype uses `adult` as the headline unit while still pricing mixed adult/child baskets correctly.


## Passenger / vehicle capacity

Transfer Offers may declare a `maxPax` constraint.

The Product UI uses it to:

- disable vehicle choices that cannot carry the selected party;
- move the traveler to the first compatible vehicle when party size increases;
- cap the transfer product at the largest active vehicle capacity.

The server pricing function enforces the same constraint.

A hand-edited URL must not be able to price a 4-seat vehicle for a party above its declared capacity.

The persistence schema stores Offer constraints as JSON so provider-specific capacity rules can evolve without changing Product identity.
