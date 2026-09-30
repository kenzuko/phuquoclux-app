# PhuQuocLux integration boundaries V1

Date: 29/09/2026

## Purpose

PhuQuocLux must not couple checkout success to synchronous calls into JoTrip Ops, payment webhooks, supplier notifications or other external systems.

The transactional booking write happens first.

Integration is published from a durable outbox after the database transaction commits.

## Domain events

Initial normalized event names:

- `booking.requested`
- `booking.state_changed`
- `booking.confirmed`
- `booking.cancel_requested`
- `payment.state_changed`

Each event has:

- event id;
- aggregate type;
- aggregate id;
- aggregate version;
- occurred timestamp;
- normalized payload.

## Transactional outbox

When a Booking changes:

```
BEGIN
  update booking
  insert booking_event
  insert outbox_event
COMMIT
```

Only after commit does a publisher deliver the outbox event.

This prevents:

- booking committed but Ops never notified;
- Ops notified but booking transaction rolled back;
- duplicate state updates caused by network retry.

## JoTrip Ops boundary

PhuQuocLux should publish booking/operations events.

JoTrip Ops consumes those events and owns its own operational views, reminders and staff workflow.

Do not make the consumer web app depend on the availability of the Ops UI.

Do not let Ops become the transactional booking database.

## Supplier/provider boundary

Provider adapters normalize supplier APIs into PhuQuocLux commerce states.

Supplier-specific payloads may be retained for audit, but UI and Ops should consume normalized state.

## Payment boundary

Payment gateways are separate from travel supplier adapters.

A PaymentGateway owns:

- checkout/payment session creation;
- webhook verification;
- refund actions when supported.

It does not own Booking truth.

A payment webhook changes payment state only after:

1. provider signature is verified;
2. provider event id has not already been processed;
3. payment/booking identity is matched;
4. state transition is valid.

## Webhook idempotency

`webhook_receipts` uses:

```
(provider, provider_event_id)
```

as the unique receipt identity.

A provider retry must return the already-processed outcome rather than applying the event twice.

## Delivery retries

Outbox publisher rules:

- claim a bounded batch;
- increment attempts;
- publish;
- mark published on success;
- back off on failure;
- never block checkout waiting for a downstream consumer.

## Current state

Contracts and PostgreSQL schema exist.

No publisher, JoTrip Ops consumer or payment gateway is connected yet.

That is intentional until persistent PostgreSQL infrastructure is provisioned.
