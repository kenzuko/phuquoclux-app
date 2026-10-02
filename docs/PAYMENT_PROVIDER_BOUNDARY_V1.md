# Payment Provider Boundary V1

Status: **OFFLINE CONTRACT ONLY**

This boundary sits between a future concrete payment provider adapter and Payment Contract V1. It exists so provider-specific signature rules can be added later without letting raw provider payloads, secrets or spoofed identity leak into booking state transitions.

## Safety boundary

This change does **not**:

- select or connect a real payment provider;
- add a public webhook route;
- add provider secrets or Worker bindings;
- activate checkout or payment;
- add a production migration;
- change DNS or deploy production commerce.

Production payment remains closed.

## Raw request handling

`preparePaymentWebhookV1` is the only generic request preparation step.

It:

1. accepts only `POST`;
2. rejects a request whose body has already been consumed;
3. enforces a configurable body-size ceiling, defaulting to 64 KiB and capped at 1 MiB;
4. can enforce an adapter-selected content-type allowlist;
5. reads the raw body exactly once;
6. preserves the exact bytes for provider signature verification;
7. computes a SHA-256 hash over those exact bytes;
8. exposes normalized lowercase headers in memory only.

The raw body and headers are not part of the normalized payment event returned to the persistence layer.

## Provider adapter contract

A future concrete adapter implements `PaymentProviderAdapterV1`.

The adapter receives:

- exact raw body bytes;
- normalized headers;
- request id;
- receive timestamp;
- normalized content type.

The adapter must verify the provider signature before it returns a normalized event. Provider secrets are expected to be injected into the concrete adapter at runtime. This contract has no secret field and does not return, log or persist verification material.

If the adapter throws for an invalid signature, malformed signed payload or provider-specific verification failure, the generic boundary returns `PAYMENT_WEBHOOK_VERIFICATION_FAILED` with a fail-closed 401 outcome.

Provider-specific error detail is intentionally not part of the generic normalized result.

## Normalized verified event

Only a successfully verified adapter result can become `VerifiedPaymentEventInputV1`.

The generic boundary independently validates:

- provider id format;
- UUID identity for attempt, booking and quote;
- provider event id length and whitespace integrity;
- optional provider reference integrity;
- allowed payment event status;
- positive safe-integer amount;
- `VND` currency;
- valid occurrence timestamp.

The `provider` field is injected from the selected adapter id, not accepted from the provider payload. The SHA-256 `payloadHash` is injected from the exact raw body prepared before parsing.

This makes it harder for a provider payload or adapter parser to spoof the persistence identity checked again by Payment Contract V1.

## Replay and persistence boundary

This layer does not claim receipts and does not mutate PostgreSQL.

After successful verification and normalization, the existing Payment Contract V1 writer remains responsible for:

- `(provider, provider_event_id)` replay identity;
- payload hash replay checks;
- attempt/provider/booking/quote/amount/currency integrity;
- row locking and concurrency;
- atomic booking/payment state changes;
- transactional audit/outbox writes.

## Offline tests

`npm run test:payment-provider-contract` covers:

- raw-byte preservation and single body consumption;
- SHA-256 payload hashing;
- content type and body-size rejection;
- already-consumed body rejection;
- generic verification failure handling;
- invalid provider id rejection;
- invalid normalized status rejection;
- invalid UUID identity rejection;
- invalid amount and currency rejection;
- exclusion of raw body and headers from the normalized verified event.

The test is also included in `npm run test:domain`, so normal web CI runs it for changes under `web/**`.

## Remaining production gates

A real provider still requires a separate reviewed change that explicitly locks:

1. provider selection and account/environment identity;
2. exact signature algorithm and signed-byte rules from provider documentation;
3. timestamp/freshness tolerance and replay expectations specific to that provider;
4. secret ownership, environment separation and rotation procedure;
5. public webhook ingress path, rate limits and response behavior;
6. production PostgreSQL/Hyperdrive target and migration plan;
7. checkout activation and customer failure/retry UX;
8. end-to-end tests proving no double charge, no cross-booking mutation and safe refund behavior.

Until those gates are satisfied, this boundary remains offline infrastructure only.
