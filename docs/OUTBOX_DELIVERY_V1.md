# Outbox delivery and reconciliation V1

Date: 01/10/2026  
Status: PostgreSQL contract implemented, no external publisher connected

## Purpose

Booking writes must not send email, SMS, Ops notifications or provider calls
inside the booking transaction.

The booking transaction writes a committed `outbox_events` row. A separate
worker later claims and publishes that event.

## Delivery model

```
booking transaction
→ committed outbox row
→ worker claim with lease
→ provider-neutral publisher
→ published
   or
→ retry with backoff
   or
→ terminal failed
```

## Lease rules

A claim:

- uses PostgreSQL `FOR UPDATE SKIP LOCKED`;
- moves a row to `processing`;
- increments `attempts`;
- stores an opaque lease token;
- stores lease start/expiry;
- clears `next_attempt_at` while processing.

A second worker cannot claim an active lease.

If the first worker dies, a new worker may reclaim the row only after
`lease_expires_at`.

Every publish/retry transition must match both event id and current lease token.
A stale worker therefore cannot overwrite a newer worker's result.

## Retry policy

Default retry delays by attempt:

1. 1 minute
2. 5 minutes
3. 15 minutes
4. 1 hour
5. 6 hours
6+ 12 hours

Default terminal threshold: 8 attempts.

The contract permits an explicit lower/higher threshold for a future publisher,
bounded by code.

## Error privacy

`last_error` stores only one of the stable allow-listed codes:

- `DELIVERY_AUTH_FAILED`
- `DELIVERY_NETWORK`
- `DELIVERY_RATE_LIMITED`
- `DELIVERY_REJECTED`
- `DELIVERY_TIMEOUT`
- `HANDLER_UNSUPPORTED_EVENT`
- `DELIVERY_FAILED`

Unknown strings and thrown exceptions become `DELIVERY_FAILED`.

Never store:

- provider exception text;
- email addresses;
- phone numbers;
- guest names;
- request bodies;
- access/session tokens.

## Publisher boundary

`processOutboxBatch` accepts a provider-neutral `OutboxPublisher`.

No concrete email, SMS, Ops or supplier publisher is connected yet.

Provider calls occur outside PostgreSQL transactions. The lease is the
concurrency boundary while the external network request is in flight.

## Current booking event

`booking.requested` payload currently contains only:

- booking id;
- product id;
- offer id;
- service date;
- pax;
- booking state.

Guest name, email and phone are intentionally absent.

## Reconciliation

Terminal `failed` rows are not retried automatically.

Before live booking is enabled, Ops must have a read path/dashboard that can:

- list terminal failures;
- filter by event type/time;
- inspect aggregate id/version;
- trigger a controlled retry or manual resolution;
- audit the resolution without editing historical outbox rows directly.

That Ops path is not implemented in this step.

## Activation boundary

This contract does not create:

- a scheduled Worker/Cron;
- an email/SMS provider;
- a supplier API publisher;
- an Ops dashboard;
- guest access;
- checkout/payment activation.

The outbox layer is durable infrastructure only.
