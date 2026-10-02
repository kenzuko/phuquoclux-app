# Commerce Production Lock V1

Status: **ACTIVE CI INVARIANT**

This lock keeps PhuQuocLux production commerce fail-closed while the real production database/Hyperdrive target and concrete payment provider are still unconfirmed.

## Invariants enforced by CI

`web/scripts/commerce-production-lock-v1.mjs` fails when any of these change without an intentional lock redesign:

1. production deploy no longer hard-codes `COMMERCE_MODE:prototype`;
2. production deploy contains a live/production/enabled commerce override;
3. Worker default commerce mode is not `prototype`;
4. manage-booking exchange is enabled by default;
5. a public route containing `payment` or `webhook` appears;
6. checkout loader stops enforcing prototype commerce;
7. checkout action becomes submitting instead of `Promise<never>`;
8. checkout POST no longer fails closed with HTTP 503.

The lock runs inside `npm run test:domain`. `web-ci` also watches `.github/workflows/deploy-production.yml`, so a deployment-only PR cannot bypass this invariant by avoiding `web/**` changes.

## Intentional future activation

A future production-commerce activation PR must update this lock deliberately in the same reviewed change that provides all required production dependencies, including:

- identified production PostgreSQL target;
- reviewed Hyperdrive binding;
- production migration plan and rollback/forward-fix plan;
- concrete payment provider adapter;
- verified provider secret ownership and rotation process;
- public webhook ingress design;
- payment runtime gate wiring;
- durable booking/guest-access readiness;
- end-to-end no-double-charge and replay tests.

Until then, offline payment contracts may continue to evolve, but production commerce remains closed.
