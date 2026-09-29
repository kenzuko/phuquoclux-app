export type ProductType = "tour" | "ticket" | "transfer";
export type MapCategory = ProductType | "place";

export type MapVerification = "verified" | "reference" | "demo";

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
  href?: string;
  verification: MapVerification;
  priority: number;
  minZoom: number;
};

export type Product = {
  type: ProductType;
  name: string;
  kicker: string;
  lead: string;
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
    href: "/product/tour",
    verification: "verified",
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
    copy: "Khu vực tham quan phía Bắc. Chỉ gắn sản phẩm khi vị trí và offer đã được xác minh.",
    verification: "reference",
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
    copy: "Vị trí tham chiếu của sân bay, không phải điểm đón cụ thể cho từng booking.",
    href: "/product/transfer",
    verification: "reference",
    priority: 98,
    minZoom: 8.8,
  },
];

export const products: Record<ProductType, Product> = {
  tour: {
    type: "tour",
    name: "Tour 3 đảo bằng cano",
    kicker: "NAM ĐẢO · 7 GIỜ",
    lead: "Đón khách sạn · Ăn trưa · Lặn ngắm san hô",
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
  ticket: {
    type: "ticket",
    name: "Vé cáp treo Hòn Thơm",
    kicker: "HÒN THƠM · VÉ ĐIỆN TỬ",
    lead: "Chọn ngày · Voucher trên điện thoại · Đi thẳng đến cổng",
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
    mapEntityIds: [],
  },
  transfer: {
    type: "transfer",
    name: "Sân bay → khách sạn",
    kicker: "PQC · PRIVATE TRANSFER",
    lead: "Đón theo chuyến bay · Không ghép khách · Hỗ trợ hành lý",
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

export function isProductType(value: string | undefined): value is ProductType {
  return value === "tour" || value === "ticket" || value === "transfer";
}

export function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value)) + "đ";
}

export function mapVerificationLabel(verification: MapVerification) {
  if (verification === "verified") return "Đã xác minh vị trí";
  if (verification === "reference") return "Vị trí tham chiếu";
  return "Dữ liệu demo";
}
