# Payment Provider Bundle V1

Status: **OFFLINE CONTRACT ONLY**

This layer prevents a future concrete payment integration from wiring webhook verification for one provider identity while checkout/refund operations use another.

## Bundle rule

A complete payment-provider bundle contains:

- one webhook verification adapter;
- one outbound checkout/refund operations adapter;
- one canonical provider ID shared by both.

`createPaymentProviderBundleV1()` fails closed if the two adapter IDs differ or are malformed.

## Bundle registry

`createPaymentProviderBundleRegistryV1()` provides explicit trusted lookup of complete provider bundles.

Rules:

- provider IDs are validated;
- duplicate provider bundles are rejected;
- tampered bundles whose nested adapter IDs do not match the bundle ID are rejected;
- unknown providers fail closed;
- the registry and bundles are immutable;
- provider IDs are exposed in a stable sorted list for diagnostics/config validation.

Provider selection must still come from a trusted route/config boundary. Request bodies and webhook headers must never choose a provider bundle.

## Why both registries exist today

The existing webhook-only registry remains in place for the current offline webhook/runtime contracts. Provider Bundle V1 is the stronger future integration boundary once a real provider is selected, because it proves inbound verification and outbound operations represent the same provider identity.

No existing runtime route is switched to the bundle registry by this work.

## Production gate remains closed

This work does not add or change:

- a concrete payment provider;
- provider credentials or secrets;
- external network calls;
- public checkout/refund/webhook routes;
- production PostgreSQL/Neon or Hyperdrive;
- production payment migrations;
- checkout/refund activation;
- DNS or production deployment.
