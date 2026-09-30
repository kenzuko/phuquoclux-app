import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expectedSupplierIntakeOffers,
  supplierIntakeHeaders,
} from "../app/domain/supplier-intake.ts";
import { todayInPhuQuoc } from "../app/domain/service-date.ts";

const run = (...args) =>
  spawnSync("npm", ["run", "--silent", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

const template = run("supplier:template");
assert.equal(template.status, 0, template.stderr);
const committed = readFileSync(
  new URL("../data/templates/supplier-intake.template.csv", import.meta.url),
  "utf8",
);
assert.equal(
  template.stdout,
  committed,
  "Committed supplier intake template must match live Offer contracts.",
);

const expected = expectedSupplierIntakeOffers();
assert.equal(expected.length, 6, "V1 intake should cover six current offers.");
const now = new Date();
const verifiedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
const from = todayInPhuQuoc(now);
const until = todayInPhuQuoc(
  new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
);
const complete = expected.map((offer) => {
  const values = {
    offer_id: offer.offerId,
    provider_id: offer.providerId,
    source_type: "supplier",
    source_reference: "SYNTHETIC-LOCAL-TEST-ONLY",
    price_verified_at_utc: verifiedAt,
    valid_from: from,
    valid_through: until,
    pricing_mode: offer.pricingMode,
    price_basis: offer.priceBasis,
    flat_vnd: offer.pricingMode === "flat" ? "123456" : "",
    unit_rates_vnd:
      offer.pricingMode === "unit_mix"
        ? offer.unitCodes.map((code, index) => `${code}=${123456 + index}`).join(";")
        : "",
    max_pax: offer.maxPax ? String(offer.maxPax) : "",
    cancellation_policy_reference: "SYNTHETIC-CANCEL-POLICY",
    confirmation_policy_reference: "SYNTHETIC-CONFIRM-POLICY",
    inventory_mode: offer.inventoryMode,
  };
  return supplierIntakeHeaders.map((key) => values[key]).join(",");
});
const header = supplierIntakeHeaders.join(",");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "pql-supplier-check-"));
const privateFixture = join(temporaryDirectory, "synthetic.supplier-confidential.csv");
try {
  writeFileSync(privateFixture, [header, ...complete].join("\n") + "\n");
  const valid = run("supplier:check", "--", privateFixture);
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.match(valid.stdout, /ready for manual Ops review: 6/);
  assert.match(valid.stdout, /Live commerce eligible: 0/);
  
  const firstExpired = complete[0].split(",");
  const throughColumn = supplierIntakeHeaders.indexOf("valid_through");
  firstExpired[throughColumn] = "2020-01-01";
  writeFileSync(
    privateFixture,
    [header, firstExpired.join(","), ...complete.slice(1)].join("\n") + "\n",
  );
  const expired = run("supplier:check", "--", privateFixture);
  assert.equal(expired.status, 2, "Expired supplier evidence must be rejected.");
  assert.match(expired.stdout, /PRICE_EVIDENCE_EXPIRED/);

  const duplicate = run("supplier:check", "--", privateFixture);
  assert.equal(duplicate.status, 2);
  writeFileSync(
    privateFixture,
    [header, ...complete, complete[0]].join("\n") + "\n",
  );
  const repeated = run("supplier:check", "--", privateFixture);
  assert.equal(repeated.status, 2);
  assert.match(repeated.stdout, /OFFER_DUPLICATE_IN_FILE/);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
console.log("Supplier intake CLI selftest passed; no supplier data left on disk.");
