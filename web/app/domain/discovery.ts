import {
  mapEntities,
  productList,
  type MapCategory,
  type MapEntity,
  type Product,
  type ProductId,
  type ProductType,
} from "./catalog";
import { fromPriceForProduct } from "./offer";

export type BoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type DiscoveryQuery = {
  bounds?: BoundingBox;
  category?: "all" | MapCategory;
  q?: string;
  date?: string;
  pax?: number;
};

export type DiscoveryProductSummary = {
  productId: ProductId;
  slug: string;
  type: ProductType;
  name: string;
  fromPrice: number | null;
  unit: string;
  mapEntityIds: string[];
};

export type DiscoveryResult = {
  entities: MapEntity[];
  products: DiscoveryProductSummary[];
  meta: {
    generatedAt: string;
    availabilityIncluded: false;
    pricingMode: "from_price";
  };
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

function textScore(query: string, fields: string[]) {
  if (!query) return 1;

  const q = normalize(query);
  const haystack = normalize(fields.join(" "));
  if (!q || !haystack) return 0;

  if (haystack.includes(q)) return 100;

  const queryTokens = tokens(q);
  if (!queryTokens.length) return 0;

  const matched = queryTokens.filter((token) => haystack.includes(token)).length;
  return matched === queryTokens.length
    ? 70 + matched
    : matched
      ? Math.round((matched / queryTokens.length) * 40)
      : 0;
}

function productScore(product: Product, query: string) {
  return textScore(query, [
    product.name,
    product.slug,
    product.kicker,
    product.lead,
    product.locationLabel,
    ...product.chips,
    ...product.searchTerms,
  ]);
}

function entityScore(entity: MapEntity, query: string) {
  return textScore(query, [
    entity.name,
    entity.subtitle,
    entity.kicker,
    entity.copy,
  ]);
}

function inside(entity: MapEntity, bounds?: BoundingBox) {
  if (!bounds) return true;
  return (
    entity.lng >= bounds.west &&
    entity.lng <= bounds.east &&
    entity.lat >= bounds.south &&
    entity.lat <= bounds.north
  );
}

export function discover(query: DiscoveryQuery): DiscoveryResult {
  const search = query.q?.trim() ?? "";
  const category = query.category ?? "all";

  const rankedProducts = productList
    .map((product) => ({ product, score: productScore(product, search) }))
    .filter(({ product, score }) => {
      const categoryOk =
        category === "all" || product.type === category;
      const searchOk = !search || score > 0;
      return categoryOk && searchOk;
    })
    .sort((a, b) => b.score - a.score);

  const linkedEntityIds = new Set(
    rankedProducts.flatMap(({ product }) => product.mapEntityIds),
  );

  const rankedEntities = mapEntities
    .map((entity) => ({
      entity,
      score: entityScore(entity, search),
      linked: linkedEntityIds.has(entity.id),
    }))
    .filter(({ entity, score, linked }) => {
      const categoryOk =
        category === "all" ||
        entity.category === category ||
        linked;
      const boundsOk = inside(entity, query.bounds);
      const searchOk = !search || score > 0 || linked;
      return categoryOk && boundsOk && searchOk;
    })
    .sort((a, b) => {
      if (a.linked !== b.linked) return a.linked ? -1 : 1;
      return b.score - a.score;
    });

  const visibleEntityIds = new Set(
    rankedEntities.map(({ entity }) => entity.id),
  );

  const products = rankedProducts
    .filter(({ product }) => {
      if (!query.bounds) return true;
      if (!product.mapEntityIds.length) return false;
      return product.mapEntityIds.some((entityId) =>
        visibleEntityIds.has(entityId),
      );
    })
    .map(({ product }) => ({
      productId: product.id,
      slug: product.slug,
      type: product.type,
      name: product.name,
      fromPrice: fromPriceForProduct(product.id),
      unit: product.unit,
      mapEntityIds: product.mapEntityIds,
    }));

  return {
    entities: rankedEntities.map(({ entity }) => entity),
    products,
    meta: {
      generatedAt: new Date().toISOString(),
      availabilityIncluded: false,
      pricingMode: "from_price",
    },
  };
}
