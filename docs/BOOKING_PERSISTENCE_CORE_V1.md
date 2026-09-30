# Durable manual booking core V1 (not activated)

Date: 01/10/2026
Source branch: feat/durable-booking-core-v1
Scope: a transactionally durable **manual-request** booking repository for later integration. No public checkout, database connection, API credentials, guest tokens, or payment is enabled.

## What is implemented

- New one-time migration `0002_booking_request_fingerprint.sql`: binds the existing unique `request_id` to an HMAC-SHA256 of server-normalized booking inputs. Preexisting keys with NULL fingerprints fail closed on replay.
- `persistManualBookingRequest` accepts an **injected transaction manager**. One PostgreSQL transaction claims the idempotency key, inserts the server-side Quote and its line items, inserts an unpaid `pending_confirmation` Booking, and inserts a **PII-free** `booking.requested` outbox event.
- It supports only `availability.state=request` from the manual source. It rejects mismatched quote/booking data, invalid line totals and any prepaid/confirmed or voucher-bearing booking input.
- Concurrent requests with the same UUID serialize on the PostgreSQL unique key. A retry with the same HMAC request fingerprint returns only the existing internal booking ID; different contact/selection details or unknown legacy fingerprints fail closed. Expiry is enforced on new Quotes, but retries can find a previously committed booking.
- External JoTrip Ops notifications remain **outbox-only** until a publisher exists. No external callback is made inside this transaction.
- The HMAC key is a required **server-owned, non-extractable CryptoKey** supplied to the writer by a future authenticated service. It is NEVER supplied by the client, stored in the database or placed in source control. The CI test key is synthetic only.

## Genuine test coverage

`web/scripts/postgres-booking-integration.mjs` applies migrations and uses a disposable PostgreSQL 16 instance to test:

1. A fully committed quote, quote lines, booking, idempotency key and outbox row;
2. exact-once retry after the example Quote has expired;
3. rejection of the same request UUID with different contact information;
4. rejection of impossible availability and quote/booking mismatches;
5. foreign-key failure rolling back the idempotency claim;
6. parallel transactions on two different database connections producing just one booking and one outbox event;
7. correct HMAC storage format and absence of guest PII in the outbox.

Run in CI through `.github/workflows/db-contract.yml`. The test refuses any connection string whose database path is not **exactly** `/phuquoclux_contract_test` and uses only fake test identities and prices.

## Required production prerequisites

**This writer is not ready for a public route.** Do not change the checkout 503 gate or set `COMMERCE_MODE=live`. Before accepting anyone's personal information, provision and test all of the following in an isolated private environment:

- Secure, Worker-compatible PostgreSQL transaction manager and credentials, schema migrations and approved Product/Offer records;
- Supplier-reviewed selling prices and server-side fresh Quote/availability validation for the exact offer and service date;
- Private HMAC key rotation strategy and authoritative request normalization;
- Guest manage-booking token issuing, hashed storage, out-of-band delivery, retrieval authorization and revocation;
- An authenticated operational confirmation flow, transactional state changes with optimistic concurrency, and an outbox publisher connected to JoTrip Ops;
- Failure recovery, retention/deletion policy, observability without PII, load tests and protection from automated abuse;
- Payment integration only after final payable Quote and payment/webhook reconciliation are independently approved.

GitHub Pages remains the non-transactional design preview. Cloudflare Workers deployment is still gated. `pg` is installed for Node-based **CI tests only** and is not imported into Worker runtime; select/verify a compatible production driver separately.

## Transaction isolation guarantee

`SqlTransactionManager.transaction` must pin every query to **the same PostgreSQL client** under `READ COMMITTED` or stronger isolation, and roll back any thrown error. Retrying or sending SQL to independent pooled connections inside this callback breaks this contract.

No real customer data or supplier contract evidence belongs in GitHub, CI fixtures, test logs or public Pages.
