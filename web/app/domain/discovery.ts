import {
  mapEntities,
  products,
  type MapCategory,
  type MapEntity,
  type ProductType,
} from "./catalog";

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
  type: ProductType;
  name: string;
  fromPrice: number;
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
  const normalized = query.q?.trim().toLocaleLowerCase("vi") ?? "";

  const entities = mapEntities.filter((entity) => {
    const categoryOk =
      !query.category ||
      query.category === "all" ||
      entity.category === query.category;
    const boundsOk = inside(entity, query.bounds);
    const textOk =
      !normalized ||
      [entity.name, entity.subtitle, entity.copy]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(normalized);
    return categoryOk && boundsOk && textOk;
  });

  const entityIds = new Set(entities.map((entity) => entity.id));
  const productList = Object.values(products)
    .filter((product) => {
      const categoryOk =
        !query.category ||
        query.category === "all" ||
        product.type === query.category;
      const mapOk =
        !query.bounds ||
        product.mapEntityIds.some((entityId) => entityIds.has(entityId));
      const textOk =
        !normalized ||
        [product.name, product.kicker, product.lead, product.locationLabel]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(normalized);
      return categoryOk && mapOk && textOk;
    })
    .map((product) => ({
      type: product.type,
      name: product.name,
      fromPrice: product.fromPrice,
      unit: product.unit,
      mapEntityIds: product.mapEntityIds,
    }));

  return {
    entities,
    products: productList,
    meta: {
      generatedAt: new Date().toISOString(),
      availabilityIncluded: false,
      pricingMode: "from_price",
    },
  };
}
