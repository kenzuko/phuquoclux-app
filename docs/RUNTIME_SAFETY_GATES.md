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


## Production deploy gate

Merging code to `main` must not be enough to publish the app.

The production workflow now requires all of these:

1. repository variable `PHUQUOCLUX_DEPLOY_ENABLED=true`;
2. repository variable `PHUQUOCLUX_MAP_STYLE_URL` set to the approved production map style;
3. the map style must not be the MapLibre demo tile endpoint;
4. Cloudflare API token and account id must be present;
5. typecheck, domain checks and production build must pass.

If any gate is missing, deployment is skipped.

The deploy command keeps `COMMERCE_MODE=prototype` until live-commerce readiness is separately approved.

DNS/custom-domain changes remain a separate operational step and are not performed by this workflow.


## Isolated preview deploy

Visual QA uses a separate manual Worker:

```
phuquoclux-app-preview
```

The preview workflow:

- runs only from `workflow_dispatch`;
- requires `PHUQUOCLUX_PREVIEW_ENABLED=true`;
- requires Cloudflare credentials;
- runs full typecheck, domain checks, build and Worker dry-run first;
- keeps `COMMERCE_MODE=prototype`;
- uses Workers.dev only;
- does not attach `phuquoclux.com` or change DNS.

The MapLibre demo style is acceptable only in this isolated preview.

Production keeps the stricter map-style gate.
