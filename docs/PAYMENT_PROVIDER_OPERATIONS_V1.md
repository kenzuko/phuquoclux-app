# Payment Provider Operations V1

Status: **OFFLINE CONTRACT ONLY**

This contract defines the future outbound payment-provider boundary without selecting or calling a real provider today.

## Checkout operation

`executePaymentProviderCheckoutV1()` accepts the local checkout request plus the canonical stored attempt returned by Payment Checkout Readiness V1.

Rules:

- the selected adapter ID must match the request/attempt provider;
- the provider call uses the original checkout `requestKey` as its exact idempotency key;
- canonical stored intent/attempt IDs win over any regenerated proposed IDs on a retry;
- booking, quote, amount and currency are validated before the adapter runs;
- return/cancel URLs and returned redirect URLs must be HTTPS;
- if a provider reference is already bound, a retry may only return that same reference;
- provider SDK exceptions are collapsed to `PAYMENT_PROVIDER_CHECKOUT_FAILED` so provider-specific secrets or diagnostic details are not propagated through this boundary.

The response may contain only provider-safe checkout material such as a stable provider reference, HTTPS redirect URL, opaque client token and expiry timestamp. This layer does not persist those values.

## Refund operation

`executePaymentProviderRefundV1()` accepts the durable refund command returned by Payment Refund Readiness V1.

Rules:

- the adapter ID must match the command provider;
- the provider call uses `refundRequestId` - the transactional outbox event ID - as its exact idempotency key;
- the original provider payment reference is mandatory;
- intent, attempt, booking, amount and currency are passed through unchanged;
- optional provider refund references and accepted timestamps are validated;
- provider SDK exceptions are collapsed to `PAYMENT_PROVIDER_REFUND_FAILED`.

The verified webhook pipeline remains authoritative for final payment/refund state changes. A synchronous provider acknowledgement must not mark the booking paid/refunded by itself.

## Secret boundary

Concrete adapters may receive provider credentials from future runtime dependency injection, but this contract must never:

- accept secrets from request/body data;
- return provider secrets;
- persist raw provider responses;
- surface provider SDK exception text to callers.

## Contract evidence

The domain self-test verifies:

- checkout receives the exact local `requestKey` as idempotency key;
- canonical stored IDs are used on checkout replay;
- checkout cannot dispatch to a different provider;
- insecure HTTP return URLs are rejected;
- an already-bound provider reference cannot be replaced;
- provider checkout exceptions become a generic error;
- refunds receive the exact durable `refundRequestId` as idempotency key;
- refund provider/reference/amount/currency identity is preserved;
- refunds cannot dispatch to another provider;
- provider refund exceptions become a generic error;
- invalid provider refund references are rejected.

## Production gate remains closed

This work does not add or change:

- a concrete payment provider;
- provider credentials or secrets;
- network calls to a payment provider;
- public checkout or refund routes;
- public payment webhook routes;
- production PostgreSQL/Neon or Hyperdrive;
- production payment migrations;
- checkout/refund activation;
- DNS or production deployment.
