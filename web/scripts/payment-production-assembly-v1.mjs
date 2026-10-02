import {
  createPaymentDatabaseCapabilityV1,
  createPaymentProductionAssemblyV1,
} from "../app/services/payment-production-assembly-v1.server.ts";
import {
  createPaymentProviderBundleRegistryV1,
  createPaymentProviderBundleV1,
} from "../app/providers/payment-provider-bundle-v1.ts";

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nexpected: ${String(expected)}\nactual: ${String(actual)}`);
  }
}

async function rejectsCode(fn, expectedCode, message) {
  try {
    await fn();
  } catch (error) {
    equal(error?.code, expectedCode, message);
    return;
  }
  throw new Error(`${message}\nexpected rejection: ${expectedCode}`);
}

const database = {
  async transaction() {
    throw new Error("ASSEMBLY_MUST_NOT_TOUCH_DATABASE");
  },
};

const webhook = {
  id: "mockpay",
  async verifyWebhook() {
    throw new Error("ASSEMBLY_MUST_NOT_VERIFY_WEBHOOK");
  },
};

const operations = {
  id: "mockpay",
  async createCheckout() {
    throw new Error("ASSEMBLY_MUST_NOT_CALL_PROVIDER");
  },
  async createRefund() {
    throw new Error("ASSEMBLY_MUST_NOT_CALL_PROVIDER");
  },
};

const bundle = createPaymentProviderBundleV1({ webhook, operations });
const providerBundles = createPaymentProviderBundleRegistryV1([bundle]);
const capability = createPaymentDatabaseCapabilityV1({
  targetId: "neon:phuquoclux-production",
  contractVersion: "payment_contract_v1",
  database,
});

async function run() {
  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentDatabaseCapabilityV1({
          targetId: "postgresql://user:secret@example.invalid/db",
          contractVersion: "payment_contract_v1",
          database,
        }),
      ),
    "PAYMENT_DATABASE_TARGET_ID_INVALID",
    "database target identity must never accept a connection string",
  );

  await rejectsCode(
    () =>
      Promise.resolve(
        createPaymentDatabaseCapabilityV1({
          targetId: "neon:phuquoclux-production",
          contractVersion: "payment_contract_v1",
          database: {},
        }),
      ),
    "PAYMENT_DATABASE_MANAGER_INVALID",
    "database capability requires a transaction manager",
  );

  equal(Object.isFrozen(capability), true, "database capability must be immutable");
  equal(capability.targetId, "neon:phuquoclux-production", "target id must be preserved");

  const base = {
    commerceMode: "live",
    paymentEnabled: true,
    webhookEnabled: true,
    providerId: "mockpay",
    providerBundles,
    database: capability,
  };

  await rejectsCode(
    () => Promise.resolve(createPaymentProductionAssemblyV1({ ...base, commerceMode: "prototype" })),
    "PAYMENT_ASSEMBLY_COMMERCE_NOT_LIVE",
    "prototype commerce cannot assemble production payment",
  );
  await rejectsCode(
    () => Promise.resolve(createPaymentProductionAssemblyV1({ ...base, paymentEnabled: false })),
    "PAYMENT_ASSEMBLY_DISABLED",
    "payment enablement must be explicit",
  );
  await rejectsCode(
    () => Promise.resolve(createPaymentProductionAssemblyV1({ ...base, webhookEnabled: false })),
    "PAYMENT_ASSEMBLY_WEBHOOK_DISABLED",
    "webhook capability is mandatory for a complete payment assembly",
  );
  await rejectsCode(
    () => Promise.resolve(createPaymentProductionAssemblyV1({ ...base, providerId: undefined })),
    "PAYMENT_ASSEMBLY_PROVIDER_MISSING",
    "provider id must be explicit",
  );
  await rejectsCode(
    () => Promise.resolve(createPaymentProductionAssemblyV1({ ...base, providerBundles: undefined })),
    "PAYMENT_ASSEMBLY_PROVIDER_REGISTRY_MISSING",
    "complete provider bundle registry is mandatory",
  );

  const fakeCapability = Object.freeze({
    targetId: capability.targetId,
    contractVersion: capability.contractVersion,
    database,
  });
  await rejectsCode(
    () => Promise.resolve(createPaymentProductionAssemblyV1({ ...base, database: fakeCapability })),
    "PAYMENT_ASSEMBLY_DATABASE_CAPABILITY_INVALID",
    "look-alike database readiness objects must not pass the runtime brand",
  );

  const emptyRegistry = createPaymentProviderBundleRegistryV1([]);
  try {
    createPaymentProductionAssemblyV1({ ...base, providerBundles: emptyRegistry });
    throw new Error("expected missing provider bundle rejection");
  } catch (error) {
    equal(
      error?.code,
      "PAYMENT_PROVIDER_BUNDLE_NOT_REGISTERED",
      "assembly must resolve the concrete provider from the complete bundle registry",
    );
  }

  const assembly = createPaymentProductionAssemblyV1(base);
  equal(Object.isFrozen(assembly), true, "production assembly must be immutable");
  equal(assembly.providerId, "mockpay", "assembly provider id must be canonical");
  equal(assembly.provider, bundle, "assembly must preserve the complete provider bundle");
  equal(assembly.provider.operations, operations, "outbound operations must come from the same bundle");
  equal(assembly.provider.webhook, webhook, "webhook verifier must come from the same bundle");
  equal(assembly.database, database, "assembly must preserve the reviewed database manager");
  equal(
    assembly.databaseContractVersion,
    "payment_contract_v1",
    "assembly must pin the payment DB contract version",
  );
  equal(
    assembly.webhookRuntime.providerId,
    "mockpay",
    "webhook runtime must inherit the same provider id",
  );
  equal(
    assembly.webhookRuntime.registry.resolve("mockpay"),
    webhook,
    "webhook runtime must resolve the verifier from the complete provider bundle",
  );

  console.log("payment-production-assembly-v1: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
