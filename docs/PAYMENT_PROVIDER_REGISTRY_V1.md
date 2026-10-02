# Payment Provider Registry V1

Status: **OFFLINE CONTRACT ONLY**

This layer prevents payment webhook handling from selecting a provider adapter from untrusted request data.

## Rule

The provider id must come from a trusted application boundary such as a reviewed route mapping or explicit runtime configuration.

Webhook body fields and arbitrary provider headers must never decide which adapter verifies a webhook.

## Registry behavior

`createPaymentProviderRegistryV1()`:

- accepts only normalized lowercase provider ids matching the Payment Provider Contract V1 format;
- rejects duplicate provider registration;
- exposes exact-id resolution only;
- rejects unknown providers before webhook verification or persistence;
- exposes a stable read-only provider-id list for diagnostics.

## Dispatcher behavior

`dispatchPaymentWebhookV1()`:

1. resolves the adapter from the trusted `providerId`;
2. fails immediately if that provider is malformed or unregistered;
3. passes the selected adapter into `processPaymentWebhookV1()`;
4. preserves all existing raw-body, signature verification, normalization, replay and persistence safety guarantees.

This contract does not inspect the webhook body to choose a provider.

## Test gate

The offline contract test proves:

- exact provider resolution;
- malformed and unknown providers fail closed;
- duplicate registrations are rejected;
- body/header attempts to name a different provider cannot change the selected adapter;
- unknown providers fail before adapter verification and before the payment recorder is called;
- exact raw body and receive timestamp continue through the processor unchanged.

## Production gate remains closed

This change does **not** add:

- a real provider;
- public webhook routes;
- provider secrets;
- Cloudflare bindings;
- production PostgreSQL/Hyperdrive infrastructure;
- payment migrations;
- checkout activation;
- DNS or production deployment changes.

A later provider-specific integration must explicitly register its adapter and independently satisfy signature, secret rotation, ingress, database and end-to-end production gates.
