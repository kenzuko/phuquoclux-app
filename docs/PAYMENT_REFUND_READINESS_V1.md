# Payment Refund Readiness V1

Status: **OFFLINE CONTRACT ONLY**

This layer makes future outbound refund execution retry-safe without connecting a payment provider or enabling refunds in production.

## Problem it solves

A refund is an external side effect. If the provider accepts a refund but the network response is lost, blindly retrying with a new identity can submit the same refund twice.

Payment Contract V1 already moves the booking and payment intent to `refund_pending` and writes a durable `payment.refund_requested` transactional outbox event. Refund Readiness V1 turns that existing outbox event into the canonical outbound command.

## Stable refund identity

`prepareOrReplayPaymentRefundV1()` uses the `payment.refund_requested` outbox event ID as `refundRequestId`.

That ID is suitable as the future provider-side idempotency identity because:

- it is created in the same transaction as the `refund_pending` state transition;
- a crash after commit can recover the exact same ID;
- an exact retry does not create another outbox event;
- concurrent refund requests with the same expected booking version converge on the same durable command;
- no additional production table is required.

A future provider adapter should pass this stable `refundRequestId` as its refund idempotency key when the provider supports idempotent refund creation.

## Provider target checks

Before changing booking state, the readiness layer requires exactly one refundable payment attempt and verifies:

- the attempt is `paid` or `partially_refunded`;
- the attempt has a stable provider reference;
- attempt amount and currency match the payment intent;
- the caller supplies the expected booking version.

If the provider reference is missing, the operation fails before `refund_pending` is written and before a refund outbox command exists.

## Returned command

The command contains only stable payment identifiers needed by a future provider integration:

- `refundRequestId`;
- booking and intent identity/version;
- attempt ID;
- provider ID;
- provider payment reference;
- amount and currency.

Guest PII, provider secrets and raw provider payloads are not part of this command.

## Retry behavior

For an exact retry using the original expected booking version:

- if the first request committed, the existing refund command is returned with `outcome: replayed`;
- if two requests race, one creates the refund transition and the other replays the same outbox command;
- if a different booking version is supplied after the refund is already pending, the request fails closed instead of being treated as the same operation.

Once a verified provider webhook resolves the refund to another payment state, the webhook pipeline remains authoritative for payment state changes.

## PostgreSQL evidence

The disposable PostgreSQL contract suite verifies:

- first refund preparation creates one durable refund command;
- exact retry returns the same `refundRequestId`;
- concurrent race returns one `created` and one `replayed` result with one outbox event;
- a changed expected booking version is rejected;
- a missing provider reference fails before booking state mutation;
- no refund outbox event is created when provider identity is incomplete.

## Production gate remains closed

This work does not add or change:

- a concrete payment provider;
- provider credentials or secrets;
- provider refund API calls;
- public refund routes;
- public payment webhook routes;
- production PostgreSQL/Neon or Hyperdrive;
- production payment migrations;
- checkout or refund activation;
- DNS or production deployment.

Refund execution remains offline until a real production database target and payment provider are explicitly selected and reviewed.
