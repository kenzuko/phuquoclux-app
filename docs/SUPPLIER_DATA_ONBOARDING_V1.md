# Supplier data onboarding V1

Date: 01/10/2026
Scope: Tour / Ticket / Transfer offers in PhuQuocLux V1

## Purpose

The repository currently contains six active Offer variants with prototype, estimated prices. Those numbers support UX and pricing-model checks, but they are not authoritative production selling prices.

This intake layer creates a repeatable path from a supplier or JoTrip price source to manual Ops review without allowing a spreadsheet to turn live commerce on.

## Non-negotiable rules

1. A completed CSV is private operational input. Do not commit it to this public repository.
2. flat_vnd and unit_rates_vnd are intended traveler-facing selling prices, not supplier net rates, commissions, margins or confidential contract economics.
3. Source and policy references must be opaque internal references only. Never paste credentials, signed URLs, access tokens or confidential document contents.
4. A clean CSV means only READY FOR MANUAL OPS REVIEW.
5. A clean CSV never means inventory is live, a booking is confirmed, payment is enabled or the price has been published.
6. Static CSV evidence cannot prove live inventory. Live inventory requires a runtime ProviderAdapter.
7. Current runtime Offer values remain unchanged until a separate reviewed change applies approved selling prices.

## Current Offer coverage

The template includes all six current active variants:
- shared 3-island canoe tour;
- private canoe;
- Hòn Thơm cable-car ticket;
- airport sedan;
- airport SUV;
- airport van.

The committed template contains no source evidence and no authoritative prices.

## Workflow

From the web directory:

    npm run supplier:template > .private/supplier-intake-20261001.csv
    npm run supplier:check -- .private/supplier-intake-20261001.csv

Fill the private CSV in Excel, Numbers or Sheets export before running the checker. A blank template is expected to fail evidence validation. That is intentional.

When every row is complete, the checker can report READY FOR MANUAL OPS REVIEW ONLY. It will still report Live commerce eligible: 0.

## Field contract

- offer_id: Stable PhuQuocLux Offer ID. Must already exist and be active.
- provider_id: Current runtime provider path. Must match the Offer.
- source_type: jotrip, supplier, or provider_api. prototype is rejected.
- source_reference: Opaque internal evidence reference. No secret material.
- price_verified_at_utc: Timestamp when the selling price was verified. Explicit timezone is mandatory.
- valid_from / valid_through: Inclusive service-date validity in YYYY-MM-DD.
- pricing_mode: Must match the Offer: flat or unit_mix.
- price_basis: Flat Offers use per_person or per_booking; mixed tickets use unit_mix.
- flat_vnd: Positive whole-number VND traveler-facing selling price for flat Offers.
- unit_rates_vnd: Mixed rates as code=amount;code=amount. Required unit codes are enforced.
- max_pax: Must match an already-configured capacity constraint. It cannot silently change capacity.
- cancellation_policy_reference: Opaque internal reference to applicable cancellation terms.
- confirmation_policy_reference: Opaque internal reference to confirmation terms.
- inventory_mode: Must match the runtime Offer. Current V1 intake rows are request.

## Fail-closed checks

The validator rejects:
- unknown or duplicate Offer IDs;
- missing active Offers in a full intake batch;
- provider mismatch;
- prototype evidence claimed as real;
- future verification timestamps;
- invalid or expired price validity;
- wrong pricing mode or price basis;
- missing or unknown mixed ticket unit codes;
- capacity drift;
- missing policy references;
- static data claiming a runtime inventory mode it does not have.

## What happens after Ops review

A later reviewed change can translate approved traveler-facing selling prices into runtime Offer pricing while retaining an opaque evidence link. It must still pass domain tests and code review.

For live commerce, durable PostgreSQL persistence, idempotency, provider confirmation, final Quote semantics, payment and reconciliation where applicable, and guest booking access remain separate mandatory gates. The CSV cannot bypass any of them.
