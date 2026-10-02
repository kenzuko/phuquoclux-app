# Payment Runtime Gate V1

Status: **OFFLINE CONTRACT ONLY**

This layer prevents payment webhook execution from becoming live because of one configuration switch.

## Required capability

`createPaymentWebhookRuntimeV1()` creates an immutable runtime capability only when all of these are true:

1. commerce mode is explicitly `live`;
2. webhook activation is explicitly enabled;
3. a provider registry exists;
4. a trusted provider id is supplied;
5. that provider is already registered;
6. a reviewed payment event recorder is injected.

Any missing requirement fails closed before webhook processing starts.

## Why this exists

Future route/runtime code should not be able to activate payment handling merely by setting one environment variable. Provider verification and persistence dependencies must already be present and reviewed.

`handlePaymentWebhookRuntimeV1()` accepts only a previously created runtime capability and then delegates into the reviewed registry/dispatcher and webhook processor contracts.

## Tests

The contract test proves:

- empty/default configuration fails closed;
- enabling the webhook while commerce remains `prototype` is rejected;
- `live` commerce alone is insufficient;
- missing registry, provider mapping or recorder is rejected;
- unregistered provider ids are rejected;
- a ready runtime is immutable;
- body/header provider hints cannot override the registered provider identity;
- a ready runtime still preserves existing verification and persistence flow.

## Production gate remains closed

This contract does not add or change:

- a real Neon/PostgreSQL production project;
- Hyperdrive bindings;
- public webhook routes;
- concrete payment provider adapters;
- provider secrets;
- production migrations;
- checkout activation;
- DNS or production deployment.

PhuQuocLux still requires an explicitly identified production PostgreSQL/Hyperdrive target and concrete payment provider before any live payment route can be reviewed.
