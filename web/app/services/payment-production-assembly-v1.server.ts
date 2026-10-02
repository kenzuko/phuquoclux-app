import type { SqlTransactionManager } from "../repositories/postgres-booking-core.server";
import {
  createPostgresPaymentEventRecorderV1,
} from "./payment-webhook-processor-v1.server";
import {
  createPaymentWebhookRuntimeV1,
  type PaymentWebhookRuntimeV1,
} from "./payment-runtime-gate-v1.server";
import {
  createPaymentProviderRegistryV1,
} from "../providers/payment-provider-registry-v1";
import type {
  PaymentProviderBundleRegistryV1,
  PaymentProviderBundleV1,
} from "../providers/payment-provider-bundle-v1";

const DATABASE_TARGET_ID_V1 = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const PAYMENT_CONTRACT_VERSION_V1 = "payment_contract_v1" as const;

export class PaymentProductionAssemblyErrorV1 extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PaymentProductionAssemblyErrorV1";
    this.code = code;
  }
}

function fail(code: string): never {
  throw new PaymentProductionAssemblyErrorV1(code);
}

function assertDatabaseTargetId(targetId: string) {
  if (
    !DATABASE_TARGET_ID_V1.test(targetId) ||
    targetId.includes("://") ||
    targetId.includes("@")
  ) {
    fail("PAYMENT_DATABASE_TARGET_ID_INVALID");
  }
}

function assertTransactionManager(database: SqlTransactionManager) {
  if (!database || typeof database.transaction !== "function") {
    fail("PAYMENT_DATABASE_MANAGER_INVALID");
  }
}

export type PaymentDatabaseCapabilityV1 = Readonly<{
  targetId: string;
  contractVersion: typeof PAYMENT_CONTRACT_VERSION_V1;
  database: SqlTransactionManager;
}>;

// Runtime brand: a look-alike object cannot claim production database readiness.
const databaseCapabilities = new WeakSet<object>();

/**
 * Creates an explicit payment-database capability.
 *
 * This does not probe a database or run migrations. It only packages a reviewed
 * transaction manager together with a non-secret target identity and the exact
 * payment contract version expected by the production assembly boundary.
 * Infrastructure provisioning and schema verification remain separate gates.
 */
export function createPaymentDatabaseCapabilityV1(input: {
  targetId: string;
  contractVersion: typeof PAYMENT_CONTRACT_VERSION_V1;
  database: SqlTransactionManager;
}): PaymentDatabaseCapabilityV1 {
  assertDatabaseTargetId(input.targetId);
  if (input.contractVersion !== PAYMENT_CONTRACT_VERSION_V1) {
    fail("PAYMENT_DATABASE_CONTRACT_VERSION_INVALID");
  }
  assertTransactionManager(input.database);

  const capability = Object.freeze({
    targetId: input.targetId,
    contractVersion: input.contractVersion,
    database: input.database,
  });
  databaseCapabilities.add(capability);
  return capability;
}

export type PaymentProductionAssemblyConfigV1 = {
  commerceMode?: "prototype" | "live";
  paymentEnabled?: boolean;
  webhookEnabled?: boolean;
  providerId?: string;
  providerBundles?: PaymentProviderBundleRegistryV1;
  database?: PaymentDatabaseCapabilityV1;
};

export type PaymentProductionAssemblyV1 = Readonly<{
  providerId: string;
  databaseTargetId: string;
  databaseContractVersion: typeof PAYMENT_CONTRACT_VERSION_V1;
  database: SqlTransactionManager;
  provider: PaymentProviderBundleV1;
  webhookRuntime: PaymentWebhookRuntimeV1;
}>;

/**
 * OFFLINE PRODUCTION-ASSEMBLY CONTRACT ONLY.
 *
 * This is the final composition boundary before a future real payment route can
 * be reviewed. It deliberately requires all capabilities at once instead of
 * letting checkout, refund, webhook and persistence be activated independently.
 */
export function createPaymentProductionAssemblyV1(
  config: PaymentProductionAssemblyConfigV1,
): PaymentProductionAssemblyV1 {
  if (config.commerceMode !== "live") {
    fail("PAYMENT_ASSEMBLY_COMMERCE_NOT_LIVE");
  }
  if (config.paymentEnabled !== true) {
    fail("PAYMENT_ASSEMBLY_DISABLED");
  }
  if (config.webhookEnabled !== true) {
    fail("PAYMENT_ASSEMBLY_WEBHOOK_DISABLED");
  }
  if (!config.providerId) {
    fail("PAYMENT_ASSEMBLY_PROVIDER_MISSING");
  }
  if (!config.providerBundles) {
    fail("PAYMENT_ASSEMBLY_PROVIDER_REGISTRY_MISSING");
  }
  if (!config.database || !databaseCapabilities.has(config.database)) {
    fail("PAYMENT_ASSEMBLY_DATABASE_CAPABILITY_INVALID");
  }
  if (config.database.contractVersion !== PAYMENT_CONTRACT_VERSION_V1) {
    fail("PAYMENT_ASSEMBLY_DATABASE_CONTRACT_MISMATCH");
  }

  const provider = config.providerBundles.resolve(config.providerId);
  if (provider.id !== config.providerId) {
    fail("PAYMENT_ASSEMBLY_PROVIDER_ID_MISMATCH");
  }

  // The webhook runtime is derived from the same complete provider bundle that
  // owns outbound checkout/refund operations, preventing split-provider wiring.
  const webhookRegistry = createPaymentProviderRegistryV1([provider.webhook]);
  const recorder = createPostgresPaymentEventRecorderV1(config.database.database);
  const webhookRuntime = createPaymentWebhookRuntimeV1({
    commerceMode: config.commerceMode,
    webhookEnabled: config.webhookEnabled,
    providerId: config.providerId,
    registry: webhookRegistry,
    recorder,
  });

  return Object.freeze({
    providerId: config.providerId,
    databaseTargetId: config.database.targetId,
    databaseContractVersion: config.database.contractVersion,
    database: config.database.database,
    provider,
    webhookRuntime,
  });
}
