# PhuQuocLux price certainty V1

Date: 29/09/2026

## Problem

A visible number is not always a payable price.

Examples:

- a transfer may depend on the destination;
- a supplier may require confirmation;
- prototype catalog values are not production prices;
- a cached price may need revalidation.

The app must not let an estimated number drift into payment as if it were final.

## Quote price state

Every Quote carries:

- `estimated`
- `final`

An estimated Quote may be used for request-to-book UX.

It may **not** be used to start payment.

## Payment guard

A Quote is payable only when all are true:

1. Quote is active;
2. Quote is not expired;
3. price state is `final`;
4. availability is `available` or `limited`.

The domain guard is `assertQuotePayable`.

## Current prototype

All current prototype Offer prices are marked `estimated`.

That is intentional.

The app can validate the booking journey without creating the impression that prototype values are authoritative production prices.

## Production transition

When a provider or JoTrip pricing source becomes authoritative, the corresponding Offer pricing can emit `final` Quotes after all required pricing inputs are present.

No UI or payment integration should infer finality from the numeric amount alone.
