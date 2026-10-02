# Payment Production Assembly V1

Status: **OFFLINE CONTRACT ONLY**

This is the final code composition boundary before a future real payment runtime can be reviewed. It does not activate production payment.

## Purpose

Previous payment contracts separately protect:

- local checkout attempt creation and retry identity;
- outbound provider checkout/refund calls;
- complete provider bundles;
- verified webhook ingress;
- payment persistence and replay handling;
- refund command idempotency;
- runtime activation.

The production assembly prevents those pieces from being wired independently. A future real payment integration must present all required capabilities together.

## Database capability

`createPaymentDatabaseCapabilityV1()` requires:

- a non-secret target identity such as `neon:phuquoclux-production`;
- exact contract version `payment_contract_v1`;
- a reviewed `SqlTransactionManager`.

The capability is runtime-branded. A look-alike object cannot pass the assembly gate.

The target ID deliberately rejects connection-string-shaped values so credentials cannot be smuggled into diagnostics/config identity fields.

Important: creating this capability does **not** prove that a production database exists or that Payment Contract V1 has been migrated. Provisioning and schema verification remain separate infrastructure gates.

## Complete production assembly

`createPaymentProductionAssemblyV1()` succeeds only when all of these are present:

1. `commerceMode` is exactly `live`;
2. payment enablement is explicitly `true`;
3. webhook enablement is explicitly `true`;
4. a trusted provider ID is supplied;
5. the provider resolves from the complete provider-bundle registry;
6. a branded Payment Database Capability V1 is supplied;
7. its contract version is exactly `payment_contract_v1`.

The webhook runtime is derived from the same provider bundle that owns outbound checkout/refund operations, so split-provider wiring cannot occur.

The returned assembly is immutable and preserves the reviewed database transaction manager, provider bundle and webhook runtime.

## CI evidence

The domain self-test proves:

- prototype commerce cannot assemble production payment;
- one enablement flag is insufficient;
- webhook capability is mandatory;
- missing provider configuration fails closed;
- fake/look-alike database capabilities fail closed;
- database target identity cannot be a connection string;
- missing transaction manager fails closed;
- unknown provider bundles fail closed;
- successful assembly keeps the same provider ID across webhook and outbound operations;
- assembly creation performs no database transaction and no provider/network call.

`Commerce Production Lock V1` additionally requires:

- production deploy remains `COMMERCE_MODE:prototype`;
- default Worker config remains prototype;
- no Hyperdrive binding exists in `wrangler.jsonc`;
- the offline production assembly is not imported by the Worker;
- no public payment/webhook route exists;
- checkout POST remains fail-closed with HTTP 503.

## Production gate remains closed

This work does not add or change:

- a Neon/PostgreSQL production project;
- a Hyperdrive binding;
- Payment Contract V1 production migration;
- a concrete payment provider;
- provider credentials or secrets;
- payment checkout/refund routes;
- payment webhook routes;
- checkout activation;
- DNS or production deployment.

A future activation review must first identify and verify the real database target, schema state, Hyperdrive binding and concrete provider configuration. Only then should this assembly be wired into runtime code.
