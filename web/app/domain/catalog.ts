export type ProductType = "tour" | "ticket" | "transfer";
export type ProductId =
  | "tour-three-islands-cano"
  | "hon-thom-cable-car"
  | "airport-private-transfer";

export type MapCategory = ProductType | "place";
export type MapVerification = "verified" | "reference" | "demo";
export type MapCoordinateScope = "area" | "site" | "exact";
export type MapProvenanceSystem =
  | "openpq"
  | "jotrip-weather"
  | "phuquoclux";

export type MapProvenance = {
  system: MapProvenanceSystem;
  sourceId: string;
  verifiedAt?: string;
};

export type MapEntity = {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  category: MapCategory;
  icon: string;
  kicker: string;
  copy: string;
  verification: MapVerification;
  coordinateScope: MapCoordinateScope;
  provenance: MapProvenance;
  priority: number;
  minZoom: number;
};

export type ProductMedia =
  | {
      kind: "placeholder";
      alt: string;
    }
  | {
      kind: "photo";
      src: string;
      alt: string;
      credit?: string;
      sourceUrl?: string;
    };

export type Product = {
  id: ProductId;
  slug: string;
  type: ProductType;
  name: string;
  kicker: string;
  lead: string;
  pricingNote?: string;
  fulfillmentSummary: string;
  facts: Array<{ label: string; value: string }>;
  media: ProductMedia;
  unit: string;
  duration?: string;
  locationLabel: string;
  chips: string[];
  searchTerms: string[];
  mapEntityIds: string[];
};

export const mapEntities: MapEntity[] = [
  {
    id: "duong-dong",
    name: "Dương Đông",
    subtitle: "Trung tâm · dịch vụ",
    lat: 10.2172,
    lng: 103.9593,
    category: "place",
    icon: "⌂",
    kicker: "KHU VỰC",
    copy: "Ăn uống, dịch vụ hằng ngày và các điểm quanh trung tâm.",
    verification: "verified",
    coordinateScope: "area",
    provenance: {
      system: "jotrip-weather",
      sourceId: "duong_dong",
      verifiedAt: "2026-09-30",
    },
    priority: 95,
    minZoom: 8.8,
  },
  {
    id: "an-thoi",
    name: "An Thới",
    subtitle: "Tour đảo · bến tàu",
    lat: 10.0191,
    lng: 104.015,
    category: "tour",
    icon: "🛥",
    kicker: "TOUR · NAM ĐẢO",
    copy: "Điểm xuất phát chính cho trải nghiệm đảo và cano phía Nam.",
    verification: "verified",
    coordinateScope: "area",
    provenance: {
      system: "jotrip-weather",
      sourceId: "an_thoi",
      verifiedAt: "2026-09-30",
    },
    priority: 100,
    minZoom: 8.8,
  },
  {
    id: "ganh-dau",
    name: "Gành Dầu",
    subtitle: "Bắc đảo · khám phá",
    lat: 10.3759,
    lng: 103.9,
    category: "place",
    icon: "⌖",
    kicker: "BẮC ĐẢO",
    copy: "Khu vực tham quan phía Bắc. Chỉ gắn sản phẩm khi vị trí và dịch vụ đã được xác minh.",
    verification: "reference",
    coordinateScope: "area",
    provenance: {
      system: "jotrip-weather",
      sourceId: "ganh_dau",
    },
    priority: 72,
    minZoom: 9.2,
  },
  {
    id: "pqc-airport-reference",
    name: "Sân bay PQC",
    subtitle: "Điểm tham chiếu sân bay",
    lat: 10.1698,
    lng: 103.9931,
    category: "transfer",
    icon: "🚗",
    kicker: "TRANSFER",
    copy: "Vị trí tham chiếu của sân bay, không phải điểm đón cụ thể cho từng đặt chỗ.",
    verification: "reference",
    coordinateScope: "site",
    provenance: {
      system: "phuquoclux",
      sourceId: "pqc-airport-reference-v1",
    },
    priority: 98,
    minZoom: 8.8,
  },
  {
    id: "sunset-town",
    name: "Sunset Town",
    subtitle: "Nam đảo · ga cáp treo · show",
    lat: 10.026903,
    lng: 104.007917,
    category: "place",
    icon: "◐",
    kicker: "NAM ĐẢO",
    copy:
      "Điểm neo khu Sunset Town. Đây là khu vực xuất phát cho hành trình Hòn Thơm, không phải một cổng duy nhất.",
    verification: "verified",
    coordinateScope: "area",
    provenance: {
      system: "openpq",
      sourceId: "place_sunset_town",
      verifiedAt: "2026-09-22",
    },
    priority: 99,
    minZoom: 8.9,
  },
  {
    id: "aquatopia-hon-thom",
    name: "Aquatopia · Hòn Thơm",
    subtitle: "Hòn Thơm · công viên nước",
    lat: 9.95644,
    lng: 104.01589,
    category: "place",
    icon: "◉",
    kicker: "HÒN THƠM",
    copy:
      "Tâm khu Aquatopia trên Hòn Thơm. Pin dùng để định hướng khu tổ hợp, không phải ga cáp treo chính xác.",
    verification: "verified",
    coordinateScope: "site",
    provenance: {
      system: "openpq",
      sourceId: "place_aquatopia",
      verifiedAt: "2026-09-22",
    },
    priority: 96,
    minZoom: 9.0,
  },
];

export const products: Record<ProductId, Product> = {
  "tour-three-islands-cano": {
    id: "tour-three-islands-cano",
    slug: "tour-3-dao-cano",
    type: "tour",
    name: "Tour 3 đảo bằng cano",
    kicker: "NAM ĐẢO · 7 GIỜ",
    lead: "Đón khách sạn · Ăn trưa · Lặn ngắm san hô",
    fulfillmentSummary: "Điểm đón & hướng dẫn tour",
    facts: [
      { label: "Khu vực", value: "An Thới" },
      { label: "Thời lượng", value: "Khoảng 7 giờ" },
    ],
    media: {
      kind: "placeholder",
      alt: "Tour 3 đảo bằng cano ở Nam đảo Phú Quốc",
    },
    unit: "/ khách",
    duration: "Khoảng 7 giờ",
    locationLabel: "An Thới",
    chips: ["Đón khách sạn", "Ăn trưa", "Lặn ngắm san hô"],
    searchTerms: [
      "3 đảo",
      "ba đảo",
      "cano",
      "tour đảo",
      "island tour",
      "snorkeling",
      "an thới",
      "an thoi",
    ],
    mapEntityIds: ["an-thoi"],
  },
  "hon-thom-cable-car": {
    id: "hon-thom-cable-car",
    slug: "ve-cap-treo-hon-thom",
    type: "ticket",
    name: "Vé cáp treo Hòn Thơm",
    kicker: "HÒN THƠM · VÉ ĐIỆN TỬ",
    lead: "Chọn ngày · Voucher trên điện thoại · Đi thẳng đến cổng",
    fulfillmentSummary: "Voucher điện tử",
    facts: [
      { label: "Khu vực", value: "Hòn Thơm · An Thới" },
      { label: "Hình thức", value: "Voucher điện tử" },
    ],
    media: {
      kind: "placeholder",
      alt: "Vé cáp treo Hòn Thơm Phú Quốc",
    },
    unit: "/ vé",
    locationLabel: "Nam đảo",
    chips: ["Voucher điện tử", "Chọn ngày", "Hướng dẫn sử dụng"],
    searchTerms: [
      "hòn thơm",
      "hon thom",
      "vé hòn thơm",
      "cáp treo",
      "cable car",
      "sun world",
    ],
    mapEntityIds: ["sunset-town", "aquatopia-hon-thom"],
  },
  "airport-private-transfer": {
    id: "airport-private-transfer",
    slug: "xe-san-bay-rieng",
    type: "transfer",
    name: "Sân bay → khách sạn",
    kicker: "PQC · PRIVATE TRANSFER",
    lead: "Đón theo chuyến bay · Không ghép khách · Hỗ trợ hành lý",
    pricingNote:
      "Giá xe đang hiển thị là tham khảo và có thể thay đổi theo điểm đến, thời gian đón và điều kiện vận hành.",
    fulfillmentSummary: "Điểm đón & thông tin tài xế",
    facts: [
      { label: "Điểm bắt đầu", value: "Sân bay PQC" },
      { label: "Hình thức", value: "Xe riêng" },
    ],
    media: {
      kind: "placeholder",
      alt: "Xe riêng đón sân bay Phú Quốc",
    },
    unit: "/ xe",
    locationLabel: "Sân bay PQC",
    chips: ["Xe riêng", "Theo chuyến bay", "Hỗ trợ hành lý"],
    searchTerms: [
      "xe sân bay",
      "đón sân bay",
      "airport transfer",
      "private car",
      "pqc",
      "taxi sân bay",
    ],
    mapEntityIds: ["pqc-airport-reference"],
  },
};

export const productList = Object.values(products);

export function isProductId(value: string | undefined): value is ProductId {
  return Boolean(value && value in products);
}

export function getProductById(value: string | undefined) {
  return isProductId(value) ? products[value] : undefined;
}

export function getProductBySlug(slug: string | undefined) {
  if (!slug) return undefined;
  return productList.find((product) => product.slug === slug);
}

export function productPath(product: Product) {
  return `/product/${product.slug}`;
}

export function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value)) + "đ";
}

export function mapVerificationLabel(
  entity: Pick<MapEntity, "verification" | "coordinateScope">,
) {
  if (entity.verification === "demo") return "Dữ liệu demo";

  if (entity.coordinateScope === "area") {
    return entity.verification === "verified"
      ? "Khu vực đã xác minh"
      : "Khu vực tham chiếu";
  }

  if (entity.coordinateScope === "site") {
    return entity.verification === "verified"
      ? "Cơ sở đã xác minh"
      : "Cơ sở tham chiếu";
  }

  return entity.verification === "verified"
    ? "Đã xác minh vị trí"
    : "Vị trí tham chiếu";
}

export function productsForMapEntity(entityId: string) {
  return productList.filter((product) =>
    product.mapEntityIds.includes(entityId),
  );
}


export function mapCoordinateScopeLabel(
  scope: MapCoordinateScope,
) {
  if (scope === "area") return "Pin đại diện khu vực";
  if (scope === "site") return "Pin đại diện cơ sở";
  return "Vị trí chính xác";
}

export function mapCoordinateScopeCopy(
  entity: Pick<MapEntity, "name" | "coordinateScope">,
) {
  if (entity.coordinateScope === "area") {
    return `Pin này đại diện khu vực ${entity.name}, không phải điểm đón hoặc điểm gặp chính xác.`;
  }

  if (entity.coordinateScope === "site") {
    return `Pin này đại diện phạm vi ${entity.name}, không phải điểm gặp cụ thể trong cơ sở.`;
  }

  return "Pin này có thể được dùng như một vị trí chính xác.";
}
