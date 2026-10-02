# Payment Webhook Processor V1

Status: **OFFLINE COMPOSITION ONLY**

This layer connects the two payment contracts already present in the repository without activating a public payment endpoint:

1. preserve exact webhook bytes and apply request limits;
2. let a concrete provider adapter verify its signature;
3. normalize and independently validate the verified provider event;
4. pass only that verified event to the Payment Contract V1 recorder;
5. return the recorder's normalized processed/replayed result.

## Safety boundary

This change does **not**:

- add a webhook route;
- select a real payment provider;
- add provider credentials or secrets;
- add a Cloudflare binding;
- add a payment production migration;
- enable checkout or `COMMERCE_MODE=live`;
- change DNS or production deployment behavior.

`processPaymentWebhookV1()` is application plumbing only. Nothing on the public internet can invoke it unless a later reviewed route explicitly wires it.

## Fail-closed ordering

Persistence is unreachable until all earlier stages succeed:

```
Request
  -> prepare exact raw bytes + size/content-type guards
  -> provider adapter signature verification
  -> normalized event validation
  -> verified-event recorder
  -> Payment Contract V1 transaction
```

A body-limit failure, invalid provider id, signature failure, or malformed normalized event must stop before the recorder is called.

## PostgreSQL recorder

`createPostgresPaymentEventRecorderV1(database)` is a narrow adapter around `recordVerifiedPaymentEventV1()`.

It does not discover a database, create a connection, or provision Hyperdrive. A caller must inject an already reviewed `SqlTransactionManager`.

## Tests

`payment-webhook-processor-v1.mjs` is part of `npm run test:domain` and verifies:

- exact raw webhook bytes reach the provider adapter;
- request headers are normalized for adapter use;
- the exact raw-body SHA-256 reaches the persistence boundary;
- provider identity is bound from the selected adapter, not trusted from payload data;
- the prepared receive time is reused for persistence;
- signature failure never reaches persistence;
- oversized bodies never reach provider verification or persistence;
- invalid provider ids never execute the provider adapter;
- idempotent `replayed` results from the recorder pass through unchanged.

## Next production gates

Production remains blocked until a later change explicitly identifies and reviews:

1. the real PostgreSQL/Hyperdrive target;
2. the concrete payment provider;
3. provider-specific signature headers, timestamp tolerance and secret rotation;
4. a public webhook route with rate limiting and safe response semantics;
5. production payment schema migration and rollout procedure;
6. checkout activation and payment failure/retry UX;
7. end-to-end tests against the provider sandbox and isolated production-like database.
