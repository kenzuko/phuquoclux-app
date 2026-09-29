import {
  mapEntities,
  productList,
} from "./catalog";
import {
  fromPriceForProduct,
  offersForProduct,
} from "./offer";

export type CatalogIssue = {
  code: string;
  message: string;
};

export function validateCatalog(): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const slugs = new Set<string>();
  const productIds = new Set<string>();
  const entityIds = new Set(mapEntities.map((entity) => entity.id));

  for (const entity of mapEntities) {
    if (
      entity.lat < -90 ||
      entity.lat > 90 ||
      entity.lng < -180 ||
      entity.lng > 180
    ) {
      issues.push({
        code: "MAP_COORDINATE_INVALID",
        message: `${entity.id} has invalid coordinates`,
      });
    }

    if (entity.priority < 0 || entity.priority > 100) {
      issues.push({
        code: "MAP_PRIORITY_INVALID",
        message: `${entity.id} priority must be between 0 and 100`,
      });
    }
  }

  for (const product of productList) {
    if (productIds.has(product.id)) {
      issues.push({
        code: "PRODUCT_ID_DUPLICATE",
        message: `duplicate Product id: ${product.id}`,
      });
    }
    productIds.add(product.id);

    if (slugs.has(product.slug)) {
      issues.push({
        code: "PRODUCT_SLUG_DUPLICATE",
        message: `duplicate Product slug: ${product.slug}`,
      });
    }
    slugs.add(product.slug);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) {
      issues.push({
        code: "PRODUCT_SLUG_INVALID",
        message: `invalid Product slug: ${product.slug}`,
      });
    }

    if (!product.media.alt.trim()) {
      issues.push({
        code: "PRODUCT_MEDIA_ALT_MISSING",
        message: `${product.id} media alt is required`,
      });
    }

    if (product.media.kind === "photo") {
      if (!product.media.src.startsWith("/")) {
        issues.push({
          code: "PRODUCT_MEDIA_SOURCE_INVALID",
          message: `${product.id} photo must use a controlled app asset path`,
        });
      }
    }

    for (const entityId of product.mapEntityIds) {
      if (!entityIds.has(entityId)) {
        issues.push({
          code: "PRODUCT_MAP_ENTITY_MISSING",
          message: `${product.id} references missing MapEntity ${entityId}`,
        });
      }
    }

    const offers = offersForProduct(product.id);
    if (!offers.length) {
      issues.push({
        code: "PRODUCT_WITHOUT_OFFER",
        message: `${product.id} has no active Offer`,
      });
      continue;
    }

    if (fromPriceForProduct(product.id) === null) {
      issues.push({
        code: "PRODUCT_WITHOUT_HEADLINE_PRICE",
        message: `${product.id} cannot derive a headline price`,
      });
    }

    const offerIds = new Set<string>();
    for (const offer of offers) {
      if (offerIds.has(offer.id)) {
        issues.push({
          code: "OFFER_ID_DUPLICATE",
          message: `duplicate Offer id under ${product.id}: ${offer.id}`,
        });
      }
      offerIds.add(offer.id);

      if (!offer.providerId.trim()) {
        issues.push({
          code: "OFFER_PROVIDER_MISSING",
          message: `${offer.id} has no provider`,
        });
      }

      if (offer.pricing.mode === "flat") {
        if (offer.pricing.amount <= 0) {
          issues.push({
            code: "OFFER_PRICE_INVALID",
            message: `${offer.id} flat price must be positive`,
          });
        }
      } else {
        if (!offer.pricing.units.length) {
          issues.push({
            code: "OFFER_UNITS_MISSING",
            message: `${offer.id} has no unit rates`,
          });
        }

        const unitCodes = new Set<string>();
        for (const unit of offer.pricing.units) {
          if (unitCodes.has(unit.code)) {
            issues.push({
              code: "OFFER_UNIT_DUPLICATE",
              message: `${offer.id} repeats unit code ${unit.code}`,
            });
          }
          unitCodes.add(unit.code);

          if (unit.amount <= 0) {
            issues.push({
              code: "OFFER_UNIT_PRICE_INVALID",
              message: `${offer.id} unit ${unit.code} must be positive`,
            });
          }
        }

        if (
          offer.pricing.headlineUnitCode &&
          !unitCodes.has(offer.pricing.headlineUnitCode)
        ) {
          issues.push({
            code: "OFFER_HEADLINE_UNIT_MISSING",
            message:
              `${offer.id} headline unit ${offer.pricing.headlineUnitCode} does not exist`,
          });
        }
      }
    }
  }

  return issues;
}

export function assertCatalogValid() {
  const issues = validateCatalog();
  if (!issues.length) return;

  throw new Error(
    [
      "CATALOG_INVALID",
      ...issues.map((issue) => `${issue.code}: ${issue.message}`),
    ].join("\n"),
  );
}
