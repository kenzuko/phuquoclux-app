import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(webRoot, "..");

async function text(relativeToRepo) {
  return readFile(path.join(repoRoot, relativeToRepo), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`COMMERCE_PRODUCTION_LOCK_V1: ${message}`);
  }
}

function assertContains(source, needle, message) {
  assert(source.includes(needle), message);
}

function assertNotMatch(source, pattern, message) {
  assert(!pattern.test(source), message);
}

async function run() {
  const [deployWorkflow, wrangler, routes, checkout, worker] = await Promise.all([
    text(".github/workflows/deploy-production.yml"),
    text("web/wrangler.jsonc"),
    text("web/app/routes.ts"),
    text("web/app/routes/checkout.tsx"),
    text("web/workers/app.ts"),
  ]);

  // Production deployment must remain prototype-only until a dedicated,
  // reviewed activation change intentionally replaces this lock.
  assertContains(
    deployWorkflow,
    '--var "COMMERCE_MODE:prototype"',
    "production deploy must hard-code COMMERCE_MODE:prototype",
  );
  assertNotMatch(
    deployWorkflow,
    /COMMERCE_MODE:(?:live|production|enabled)/i,
    "production deploy must not contain a live commerce override",
  );

  // Local/default Worker config must fail closed as well.
  assertContains(
    wrangler,
    '"COMMERCE_MODE": "prototype"',
    "wrangler default commerce mode must remain prototype",
  );
  assertContains(
    wrangler,
    '"MANAGE_BOOKING_EXCHANGE_ENABLED": "false"',
    "manage-booking exchange must remain disabled by default",
  );
  assertNotMatch(
    wrangler,
    /"hyperdrive"\s*:/i,
    "production Worker config must not provision Hyperdrive before database activation review",
  );

  // No public payment ingress exists yet. Provider/webhook code is deliberately
  // offline-only until DB, Hyperdrive and a concrete provider are reviewed.
  assertNotMatch(
    routes,
    /route\([^\n]*(?:payment|webhook)/i,
    "public payment/webhook route detected before production activation review",
  );
  assertNotMatch(
    worker,
    /payment-production-assembly-v1/i,
    "offline payment production assembly must not be wired into the Worker",
  );

  // Current checkout remains quote-preview-only. If this action changes, the
  // activation lock must be intentionally redesigned in the same reviewed PR.
  assertContains(
    checkout,
    "assertPrototypeCommerce(getCommerceMode(",
    "checkout loader must enforce prototype commerce",
  );
  assertContains(
    checkout,
    "export async function action(): Promise<never>",
    "checkout action must remain non-submitting",
  );
  assertContains(
    checkout,
    "status: 503",
    "checkout POST must continue failing closed with 503",
  );

  console.log("commerce-production-lock-v1: ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
