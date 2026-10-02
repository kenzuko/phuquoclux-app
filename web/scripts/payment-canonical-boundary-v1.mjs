#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const appRoot = path.join(webRoot, "app");

const legacyFiles = [
  "app/domain/payment.ts",
  "app/providers/payment-gateway.ts",
];

const canonicalFiles = [
  "app/domain/payment-contract-v1.ts",
  "app/domain/payment-checkout-contract-v1.ts",
  "app/providers/payment-provider-contract-v1.ts",
  "app/providers/payment-provider-registry-v1.ts",
  "app/repositories/postgres-payment-contract-v1.server.ts",
  "app/repositories/postgres-payment-checkout-readiness-v1.server.ts",
  "app/services/payment-webhook-processor-v1.server.ts",
  "app/services/payment-webhook-dispatcher-v1.server.ts",
  "app/services/payment-runtime-gate-v1.server.ts",
];

function fail(message) {
  throw new Error(`PAYMENT_CANONICAL_BOUNDARY_V1: ${message}`);
}

async function exists(relativePath) {
  try {
    await access(path.join(webRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

async function run() {
  for (const legacy of legacyFiles) {
    if (await exists(legacy)) {
      fail(`legacy payment file must stay removed: ${legacy}`);
    }
  }

  for (const canonical of canonicalFiles) {
    if (!(await exists(canonical))) {
      fail(`canonical payment boundary file is missing: ${canonical}`);
    }
  }

  const sourceFiles = await walk(appRoot);
  const forbiddenPatterns = [
    {
      pattern: /(?:from\s*["'][^"']*domain\/payment["']|import\s*\(["'][^"']*domain\/payment["']\))/,
      message: "legacy domain/payment import detected",
    },
    {
      pattern: /(?:from\s*["'][^"']*providers\/payment-gateway["']|import\s*\(["'][^"']*providers\/payment-gateway["']\))/,
      message: "legacy payment-gateway import detected",
    },
    {
      pattern: /\binterface\s+PaymentGateway\b/,
      message: "legacy PaymentGateway interface detected",
    },
    {
      pattern: /\btype\s+(?:PaymentRecord|PaymentCheckout|PaymentWebhookEvent)\b/,
      message: "legacy payment domain type detected",
    },
  ];

  for (const absolute of sourceFiles) {
    const source = await readFile(absolute, "utf8");
    const relative = path.relative(webRoot, absolute).replaceAll(path.sep, "/");
    for (const forbidden of forbiddenPatterns) {
      if (forbidden.pattern.test(source)) {
        fail(`${forbidden.message}: ${relative}`);
      }
    }
  }

  console.log("payment-canonical-boundary-v1: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
