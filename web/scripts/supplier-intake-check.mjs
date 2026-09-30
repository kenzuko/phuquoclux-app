#!/usr/bin/env node
/**
 * Offline-only supplier intake checker.
 * This tool never uploads evidence, changes runtime Offers or logs raw prices.
 * Keep completed supplier CSVs outside the public Git repository.
 */
import { readFileSync } from "node:fs";
import {
  auditSupplierIntake,
  expectedSupplierIntakeOffers,
  supplierIntakeHeaders,
} from "../app/domain/supplier-intake.ts";

function parseCsv(content) {
  const text = content.replace(/^\uFEFF/, "");
  const rows = [];
  let cells = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;

  function addCell() {
    cells.push(cell);
    cell = "";
    afterQuote = false;
  }
  function addRow() {
    addCell();
    if (cells.length > 1 || cells[0].trim()) rows.push(cells);
    cells = [];
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        cell += char;
      }
    } else if (afterQuote) {
      if (char === ",") {
        addCell();
      } else if (char === "\n") {
        addRow();
      } else if (char === "\r" || char === " " || char === "\t") {
        // Excel CRLF and insignificant whitespace after a quoted cell.
      } else {
        throw new Error("Invalid character after a quoted CSV value.");
      }
    } else if (char === '"' && !cell) {
      quoted = true;
    } else if (char === ",") {
      addCell();
    } else if (char === "\n") {
      addRow();
    } else if (char === "\r" && text[i + 1] === "\n") {
      // Next character handles row termination.
    } else if (char === '"') {
      throw new Error("Unexpected quote inside an unquoted CSV value.");
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("Unclosed quoted CSV value.");
  if (cells.length || cell || afterQuote) addRow();
  return rows;
}

function quoteCsvCell(value) {
  const string = String(value ?? "");
  return /[",\r\n]/.test(string)
    ? '"' + string.replaceAll('"', '""') + '"'
    : string;
}

function printTemplate() {
  const expected = expectedSupplierIntakeOffers();
  const rows = expected.map((offer) => {
    const record = {
      offer_id: offer.offerId,
      provider_id: offer.providerId,
      source_type: "",
      source_reference: "",
      price_verified_at_utc: "",
      valid_from: "",
      valid_through: "",
      pricing_mode: offer.pricingMode,
      price_basis: offer.priceBasis,
      flat_vnd: "",
      unit_rates_vnd: "",
      max_pax: offer.maxPax ?? "",
      cancellation_policy_reference: "",
      confirmation_policy_reference: "",
      inventory_mode: offer.inventoryMode,
    };
    return supplierIntakeHeaders.map((field) => quoteCsvCell(record[field]));
  });
  process.stdout.write(
    [supplierIntakeHeaders.join(","), ...rows.map((cells) => cells.join(","))].join("\n") + "\n",
  );
}

function parseIntake(csvContent) {
  const [header, ...data] = parseCsv(csvContent);
  if (!header) throw new Error("CSV is empty.");
  if (
    header.length !== supplierIntakeHeaders.length ||
    supplierIntakeHeaders.some((field, index) => field !== header[index])
  ) {
    throw new Error(
      "CSV headers must exactly match the supplier template, in the same order.",
    );
  }
  return data.map((cells, index) => {
    if (cells.length !== supplierIntakeHeaders.length) {
      throw new Error(
        `CSV row ${index + 2} has an incorrect column count (${cells.length}).`,
      );
    }
    return Object.fromEntries(
      supplierIntakeHeaders.map((field, column) => [field, cells[column].trim()]),
    );
  });
}

const command = process.argv[2];
if (command === "--template") {
  printTemplate();
} else if (command && !command.startsWith("-")) {
  try {
    const content = readFileSync(command, "utf8");
    const result = auditSupplierIntake(parseIntake(content));
    const issueCount =
      result.fileIssues.length +
      result.assessments.reduce((sum, assessment) => sum + assessment.issues.length, 0);
    process.stdout.write(
      `Rows: ${result.rowCount}/${result.expectedOfferCount}; ready for manual Ops review: ${result.readyForOpsReviewCount}; issues: ${issueCount}.\n`,
    );
    process.stdout.write(
      "Live commerce eligible: 0. CSV review never activates provider inventory, checkout, or payment.\n",
    );

    result.fileIssues.forEach((issue) => {
      process.stdout.write(`FILE [${issue.code}]: ${issue.message}\n`);
    });
    result.assessments.forEach((assessment) => {
      if (!assessment.issues.length) {
        process.stdout.write(`${assessment.offerId}: READY FOR MANUAL OPS REVIEW ONLY\n`);
      } else {
        assessment.issues.forEach((issue) => {
          process.stdout.write(
            `${assessment.offerId || "(missing offer_id)"} [${issue.code}] ${issue.field ?? ""}: ${issue.message}\n`,
          );
        });
      }
    });
    if (issueCount) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(
      `Supplier intake validation failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 2;
  }
} else {
  process.stderr.write(
    "Usage: npm run supplier:template > LOCAL_PRIVATE.csv, or npm run supplier:check -- /path/to/LOCAL_PRIVATE.csv\n",
  );
  process.exitCode = 2;
}
