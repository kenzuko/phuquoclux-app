/**
 * Supplier price-evidence staging, not a production pricing engine.
 * This module only checks whether a manual intake row is ready for JoTrip Ops
 * review. It NEVER authorizes publishing a price, live inventory, or payment.
 */
import { productList } from "./catalog";
import { offersForProduct, type Offer } from "./offer";
import { todayInPhuQuoc } from "./service-date";

export const supplierIntakeHeaders = [
  "offer_id",
  "provider_id",
  "source_type",
  "source_reference",
  "price_verified_at_utc",
  "valid_from",
  "valid_through",
  "pricing_mode",
  "price_basis",
  "flat_vnd",
  "unit_rates_vnd",
  "max_pax",
  "cancellation_policy_reference",
  "confirmation_policy_reference",
  "inventory_mode",
] as const;

export type SupplierIntakeHeader = (typeof supplierIntakeHeaders)[number];
export type SupplierIntakeRow = Record<SupplierIntakeHeader, string>;
export type SupplierIntakeSource = "jotrip" | "supplier" | "provider_api";

export type SupplierIntakeIssue = {
  code: string;
  field?: SupplierIntakeHeader;
  message: string;
};

export type SupplierIntakeAssessment = {
  offerId: string;
  readyForOpsReview: boolean;
  issues: SupplierIntakeIssue[];
  /**
   * Even a clean row remains review-only. Runtime provider + persistence gates
   * are still required before commerce can become live.
   */
  liveCommerceEligible: false;
};

function activeOffers() {
  return productList.flatMap((product) => offersForProduct(product.id));
}

export function expectedSupplierIntakeOffers() {
  return activeOffers().map((offer) => ({
    offerId: offer.id,
    providerId: offer.providerId,
    pricingMode: offer.pricing.mode,
    priceBasis:
      offer.pricing.mode === "flat" ? offer.pricing.basis : "unit_mix",
    unitCodes:
      offer.pricing.mode === "unit_mix"
        ? offer.pricing.units.map((unit) => unit.code)
        : [],
    maxPax: offer.constraints?.maxPax,
    inventoryMode: offer.availabilityMode,
  }));
}

function issue(
  issues: SupplierIntakeIssue[],
  code: string,
  field: SupplierIntakeHeader | undefined,
  message: string,
) {
  issues.push({ code, field, message });
}

function strictDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function strictUtcInstant(value: string) {
  // Require an explicit timezone so a supplier timestamp is never interpreted
  // using the machine/browser's local timezone by accident.
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function positiveInteger(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseUnitRates(value: string) {
  const result = new Map<string, number>();
  if (!value.trim()) return result;

  for (const rawPart of value.split(";")) {
    const part = rawPart.trim();
    if (!part) continue;
    const separator = part.indexOf("=");
    if (separator <= 0 || separator === part.length - 1) return null;
    const code = part.slice(0, separator).trim();
    const amount = positiveInteger(part.slice(separator + 1).trim());
    if (!/^[a-z0-9_]+$/.test(code) || amount === null || result.has(code)) {
      return null;
    }
    result.set(code, amount);
  }
  return result;
}

function findExactOffer(offerId: string): Offer | undefined {
  return activeOffers().find((offer) => offer.id === offerId);
}

export function validateSupplierIntakeRow(
  row: SupplierIntakeRow,
  now = new Date(),
): SupplierIntakeAssessment {
  const issues: SupplierIntakeIssue[] = [];
  const offerId = row.offer_id.trim();
  const offer = findExactOffer(offerId);

  if (!offer) {
    issue(
      issues,
      "OFFER_NOT_FOUND",
      "offer_id",
      "Offer ID is not an active PhuQuocLux offer.",
    );
    return {
      offerId,
      readyForOpsReview: false,
      liveCommerceEligible: false,
      issues,
    };
  }

  if (row.provider_id.trim() !== offer.providerId) {
    issue(
      issues,
      "PROVIDER_MISMATCH",
      "provider_id",
      "Provider ID must match the configured offer provider.",
    );
  }

  const sourceType = row.source_type.trim() as SupplierIntakeSource;
  if (!["jotrip", "supplier", "provider_api"].includes(sourceType)) {
    issue(
      issues,
      "SOURCE_TYPE_INVALID",
      "source_type",
      "Use jotrip, supplier, or provider_api. Prototype is never evidence.",
    );
  }

  if (!row.source_reference.trim()) {
    issue(
      issues,
      "SOURCE_REFERENCE_MISSING",
      "source_reference",
      "Use an internal opaque evidence reference, never a secret or credential.",
    );
  }

  const verifiedAt = strictUtcInstant(row.price_verified_at_utc.trim());
  if (verifiedAt === null) {
    issue(
      issues,
      "PRICE_VERIFIED_AT_INVALID",
      "price_verified_at_utc",
      "Use an ISO timestamp with explicit timezone, for example 2026-10-01T08:00:00+07:00.",
    );
  } else if (verifiedAt > now.getTime()) {
    issue(
      issues,
      "PRICE_VERIFIED_IN_FUTURE",
      "price_verified_at_utc",
      "Price verification time cannot be in the future.",
    );
  }

  const validFrom = strictDate(row.valid_from.trim());
  const validThrough = strictDate(row.valid_through.trim());
  if (!validFrom) {
    issue(
      issues,
      "VALID_FROM_INVALID",
      "valid_from",
      "Use a real calendar date in YYYY-MM-DD format.",
    );
  }
  if (!validThrough) {
    issue(
      issues,
      "VALID_THROUGH_INVALID",
      "valid_through",
      "Use a real calendar date in YYYY-MM-DD format.",
    );
  }
  if (validFrom && validThrough && validFrom > validThrough) {
    issue(
      issues,
      "VALIDITY_RANGE_INVALID",
      "valid_through",
      "valid_through must be on or after valid_from.",
    );
  }
  if (validThrough && validThrough < todayInPhuQuoc(now)) {
    issue(
      issues,
      "PRICE_EVIDENCE_EXPIRED",
      "valid_through",
      "This price evidence has expired for the Phu Quoc service calendar.",
    );
  }

  if (row.pricing_mode.trim() !== offer.pricing.mode) {
    issue(
      issues,
      "PRICING_MODE_MISMATCH",
      "pricing_mode",
      "Pricing mode must match the configured Offer.",
    );
  }

  if (offer.pricing.mode === "flat") {
    if (row.price_basis.trim() !== offer.pricing.basis) {
      issue(
        issues,
        "PRICE_BASIS_MISMATCH",
        "price_basis",
        "Flat-price basis must match the Offer.",
      );
    }
    if (positiveInteger(row.flat_vnd.trim()) === null) {
      issue(
        issues,
        "FLAT_PRICE_INVALID",
        "flat_vnd",
        "Enter a positive whole-number VND amount.",
      );
    }
    if (row.unit_rates_vnd.trim()) {
      issue(
        issues,
        "UNIT_RATES_NOT_ALLOWED",
        "unit_rates_vnd",
        "Flat pricing must not include unit_rates_vnd.",
      );
    }
  } else {
    if (row.price_basis.trim() !== "unit_mix") {
      issue(
        issues,
        "PRICE_BASIS_MISMATCH",
        "price_basis",
        "Unit-mix offers must use price_basis=unit_mix.",
      );
    }
    if (row.flat_vnd.trim()) {
      issue(
        issues,
        "FLAT_PRICE_NOT_ALLOWED",
        "flat_vnd",
        "Unit-mix pricing must not include flat_vnd.",
      );
    }

    const rates = parseUnitRates(row.unit_rates_vnd.trim());
    if (rates === null) {
      issue(
        issues,
        "UNIT_RATES_INVALID",
        "unit_rates_vnd",
        "Use code=amount pairs separated by semicolons, with positive whole-number VND amounts.",
      );
    } else {
      const requiredCodes = new Set(
        offer.pricing.units.map((unit) => unit.code),
      );
      for (const code of requiredCodes) {
        if (!rates.has(code)) {
          issue(
            issues,
            "UNIT_RATE_MISSING",
            "unit_rates_vnd",
            `Required unit rate is missing: ${code}.`,
          );
        }
      }
      for (const code of rates.keys()) {
        if (!requiredCodes.has(code)) {
          issue(
            issues,
            "UNIT_RATE_UNKNOWN",
            "unit_rates_vnd",
            `Unknown unit rate for this Offer: ${code}.`,
          );
        }
      }
    }
  }

  const configuredMaxPax = offer.constraints?.maxPax;
  if (configuredMaxPax === undefined) {
    if (row.max_pax.trim()) {
      issue(
        issues,
        "MAX_PAX_UNEXPECTED",
        "max_pax",
        "Leave max_pax empty until an Offer capacity rule is configured.",
      );
    }
  } else if (positiveInteger(row.max_pax.trim()) !== configuredMaxPax) {
    issue(
      issues,
      "MAX_PAX_MISMATCH",
      "max_pax",
      "Capacity evidence must match the configured Offer capacity before review.",
    );
  }

  if (!row.cancellation_policy_reference.trim()) {
    issue(
      issues,
      "CANCELLATION_POLICY_REFERENCE_MISSING",
      "cancellation_policy_reference",
      "Attach an opaque reference to the applicable cancellation terms.",
    );
  }
  if (!row.confirmation_policy_reference.trim()) {
    issue(
      issues,
      "CONFIRMATION_POLICY_REFERENCE_MISSING",
      "confirmation_policy_reference",
      "Attach an opaque reference to the applicable confirmation terms.",
    );
  }

  const inventoryMode = row.inventory_mode.trim();
  if (inventoryMode !== offer.availabilityMode) {
    issue(
      issues,
      "INVENTORY_MODE_MISMATCH",
      "inventory_mode",
      "Inventory mode must match the currently configured provider path.",
    );
  }
  if (inventoryMode === "live") {
    issue(
      issues,
      "LIVE_INVENTORY_REQUIRES_RUNTIME_ADAPTER",
      "inventory_mode",
      "A static intake file can never prove live inventory. Runtime provider checks are required.",
    );
  }

  return {
    offerId: offer.id,
    readyForOpsReview: issues.length === 0,
    liveCommerceEligible: false,
    issues,
  };
}

export function auditSupplierIntake(
  rows: SupplierIntakeRow[],
  now = new Date(),
) {
  const expected = expectedSupplierIntakeOffers();
  const assessments = rows.map((row) =>
    validateSupplierIntakeRow(row, now),
  );
  const seen = new Map<string, number>();
  const fileIssues: SupplierIntakeIssue[] = [];

  rows.forEach((row) => {
    const id = row.offer_id.trim();
    if (!id) return;
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    if (count > 1) {
      issue(
        fileIssues,
        "OFFER_DUPLICATE_IN_FILE",
        "offer_id",
        `Duplicate offer_id in intake file: ${id}.`,
      );
    }
  });

  for (const item of expected) {
    if (!seen.has(item.offerId)) {
      issue(
        fileIssues,
        "OFFER_MISSING_FROM_FILE",
        "offer_id",
        `Missing active offer: ${item.offerId}.`,
      );
    }
  }

  return {
    expectedOfferCount: expected.length,
    rowCount: rows.length,
    readyForOpsReviewCount: assessments.filter(
      (assessment) => assessment.readyForOpsReview,
    ).length,
    liveCommerceEligibleCount: 0 as const,
    assessments,
    fileIssues,
  };
}
