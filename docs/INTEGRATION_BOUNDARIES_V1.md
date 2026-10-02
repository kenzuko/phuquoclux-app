# PhuQuocLux integration boundaries V1

Date: 29/09/2026
Updated: 02/10/2026

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

Payment providers are separate from travel supplier adapters and do not own Booking truth.

The canonical payment architecture is Payment Contract V1 plus the provider verification, registry/dispatcher, webhook processor and runtime activation gate. Legacy `domain/payment.ts` and `providers/payment-gateway.ts` contracts have been removed so there is only one supported payment path.

A concrete payment provider adapter may only normalize a verified provider event after checking the provider signature against the exact raw request bytes. Provider identity comes from the trusted registry/runtime mapping, never from webhook body or headers.

A payment webhook changes payment state only after:

1. raw request policy validation succeeds;
2. provider signature is verified;
3. provider id resolves from the trusted registry;
4. payment/booking/quote identity and amount/currency match;
5. provider event replay/idempotency checks succeed;
6. the booking/payment state transition is valid;
7. persistence, booking events and transactional outbox updates commit together.

## Webhook idempotency

Payment Contract V1 uses `(provider, provider_event_id)` as the unique verified receipt identity and stores the exact raw-body SHA-256 hash used for replay matching.

A provider retry returns the already-processed outcome only when the verified event identity, payload hash and commercial identity match. Mismatched replay attempts fail closed.

## Delivery retries

Outbox publisher rules:

- claim a bounded batch;
- increment attempts;
- publish;
- mark published on success;
- back off on failure;
- never block checkout waiting for a downstream consumer.

## Current state

Booking/outbox contracts and Payment Contract V1 exist and are exercised against disposable PostgreSQL in CI.

Provider verification, registry/dispatcher, webhook processor and runtime activation gates exist as offline contracts.

No concrete payment provider, public payment webhook route, production payment migration or production PostgreSQL/Hyperdrive target is connected yet.

That is intentional. Production commerce remains fail-closed until those production dependencies are explicitly provisioned and reviewed.
