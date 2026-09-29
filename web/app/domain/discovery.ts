import {
  mapEntities,
  productList,
  type MapCategory,
  type MapEntity,
  type Product,
  type ProductId,
  type ProductType,
} from "./catalog";
import {
  fromPriceForProduct,
  priceCertaintyForProduct,
} from "./offer";

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
  locationLabel: string;
  fromPrice: number | null;
  priceState: "estimated" | "final" | null;
  unit: string;
  mapEntityIds: string[];
  spatialMatch: "linked" | "unlocated";
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

function editDistanceWithinOne(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }

  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}

function tokenMatches(queryToken: string, haystackTokens: string[]) {
  return haystackTokens.some((candidate) => {
    if (
      candidate.includes(queryToken) ||
      queryToken.includes(candidate)
    ) {
      return true;
    }

    return (
      queryToken.length >= 3 &&
      candidate.length >= 3 &&
      editDistanceWithinOne(queryToken, candidate)
    );
  });
}

function textScore(query: string, fields: string[]) {
  if (!query) return 1;

  const q = normalize(query);
  const haystack = normalize(fields.join(" "));
  if (!q || !haystack) return 0;

  if (haystack.includes(q)) return 100;

  const queryTokens = tokens(q);
  const haystackTokens = tokens(haystack);
  if (!queryTokens.length) return 0;

  const matched = queryTokens.filter((token) =>
    tokenMatches(token, haystackTokens),
  ).length;

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
    .filter(({ product, score }) => {
      if (!query.bounds) return true;

      if (!product.mapEntityIds.length) {
        return Boolean(search && score > 0);
      }

      return product.mapEntityIds.some((entityId) =>
        visibleEntityIds.has(entityId),
      );
    })
    .map(({ product }) => ({
      productId: product.id,
      slug: product.slug,
      type: product.type,
      name: product.name,
      locationLabel: product.locationLabel,
      fromPrice: fromPriceForProduct(product.id),
      priceState: priceCertaintyForProduct(product.id),
      unit: product.unit,
      mapEntityIds: product.mapEntityIds,
      spatialMatch: product.mapEntityIds.length ? "linked" : "unlocated",
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
