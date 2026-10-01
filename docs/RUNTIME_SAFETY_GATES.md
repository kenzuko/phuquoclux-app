# PhuQuocLux runtime safety gates

Date: 29/09/2026

## Commerce mode

The Worker has an explicit runtime switch:

`COMMERCE_MODE=prototype|live`

Current repository default:

`prototype`

## Prototype mode

Prototype mode may:

- create ephemeral server-side Quote objects for reviewing date, party, option and estimated prices;
- use clearly labeled prototype Offer prices;
- validate Product → Offer → Availability → Quote domain behavior in offline tests.

The PUBLIC checkout route is a read-only selection review. Until durable PostgreSQL storage, idempotency and guest access/delivery exist:

- no public checkout form may collect guest name, phone, email or operational PII;
- any direct POST to /checkout/:slug returns HTTP 503 before reading the body;
- /bookings displays no unpersisted or URL-spoofed confirmation;
- an in-memory Booking domain test is NOT a real booking or a request sent to JoTrip.

It does **not** imply:

- PostgreSQL persistence;
- live supplier inventory;
- payment;
- confirmed bookings.

## Live mode

The current prototype checkout intentionally returns HTTP 503 when `COMMERCE_MODE=live`.

This is a safety gate.

Before live commerce can be enabled, all of these must exist:

1. production PostgreSQL infrastructure and a reviewed Worker-compatible connection path;
2. migrations applied and durable booking/idempotency contracts wired to runtime;
3. guest manage-booking delivery plus a reviewed public exchange route that sets the tested HttpOnly session cookie and immediately redirects to a clean URL;
4. authoritative Offer pricing;
5. provider availability/confirmation path;
6. payment integration where required;
7. durable Booking and BookingEvent writes in the production runtime;
8. outbox delivery, reconciliation and failure handling.

Offline PostgreSQL CI contracts do not satisfy these production gates by themselves. The existence of access/session tables, cookie helpers, the `/manage` landing page or `/manage/exchange` POST resource must never be interpreted as live guest access.

The exchange route has an independent fail-closed gate:

- `MANAGE_BOOKING_EXCHANGE_ENABLED=true`;
- a valid HTTPS `MANAGE_BOOKING_CANONICAL_ORIGIN`;
- explicit `MANAGE_BOOKING_SESSION_TTL_MINUTES` between 5 and 1440;
- an injected reviewed booking database transaction runtime.

Current Worker config sets the first value to `false` and injects no booking database, so changing or merging application code alone cannot activate the exchange.

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


## Preview before merging

GitHub's manual `workflow_dispatch` UI depends on the workflow being present on the default branch. A feature PR cannot rely on that path alone.

The isolated preview workflow also accepts a **same-repository** pull-request event, but only for `feat/react-router-v1` with the `preview-approved` label.

The existing `PHUQUOCLUX_PREVIEW_ENABLED=true` variable and Cloudflare credentials are still required inside the job. If they are absent, deployment is skipped.

This gives the team a safe way to deploy the branch to `phuquoclux-app-preview` for live Map and mobile visual QA **without merging or touching production DNS**.
