import type { Currency, QuotePriceState } from "./commerce";
import type { ProductId } from "./catalog";

export type PriceBasis = "per_person" | "per_booking";

export type OfferPriceSource =
  | "prototype"
  | "jotrip"
  | "supplier"
  | "provider_api";

export type AvailabilityMode =
  | "request"
  | "live"
  | "scheduled";

export type OfferStatus = "active" | "paused" | "retired";

export type OperationalField =
  | "hotel_or_pickup"
  | "flight_number"
  | "guest_note";

export type FlatPricing = {
  mode: "flat";
  amount: number;
  currency: Currency;
  basis: PriceBasis;
  source: OfferPriceSource;
  certainty: QuotePriceState;
};

export type UnitRate = {
  code: string;
  label: string;
  amount: number;
};

export type UnitMixPricing = {
  mode: "unit_mix";
  currency: Currency;
  source: OfferPriceSource;
  certainty: QuotePriceState;
  headlineUnitCode?: string;
  units: UnitRate[];
};

export type OfferPricing = FlatPricing | UnitMixPricing;

export type OfferConstraints = {
  maxPax?: number;
};

export type Offer = {
  id: string;
  productId: ProductId;
  label: string;
  status: OfferStatus;
  providerId: string;
  availabilityMode: AvailabilityMode;
  pricing: OfferPricing;
  policy: {
    cancellation: "provider_defined" | "non_refundable" | "flexible";
    confirmation: "instant" | "request";
  };
  constraints?: OfferConstraints;
  operationalFields: OperationalField[];
  requiredOperationalFields?: OperationalField[];
};

const offers: Offer[] = [
  {
    id: "tour-three-islands-cano:shared",
    productId: "tour-three-islands-cano",
    label: "Ghép đoàn",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    pricing: {
      mode: "flat",
      amount: 850000,
      currency: "VND",
      basis: "per_person",
      source: "prototype",
      certainty: "estimated",
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["hotel_or_pickup", "guest_note"],
  },
  {
    id: "tour-three-islands-cano:private",
    productId: "tour-three-islands-cano",
    label: "Cano riêng",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    pricing: {
      mode: "flat",
      amount: 4420000,
      currency: "VND",
      basis: "per_booking",
      source: "prototype",
      certainty: "estimated",
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["hotel_or_pickup", "guest_note"],
  },
  {
    id: "hon-thom-cable-car:standard",
    productId: "hon-thom-cable-car",
    label: "Vé cáp treo",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    pricing: {
      mode: "unit_mix",
      currency: "VND",
      source: "prototype",
      certainty: "estimated",
      headlineUnitCode: "adult",
      units: [
        { code: "adult", label: "Người lớn", amount: 700000 },
        { code: "child", label: "Trẻ em", amount: 504000 },
      ],
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["guest_note"],
  },
  {
    id: "airport-private-transfer:sedan",
    productId: "airport-private-transfer",
    label: "Sedan 4 chỗ",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    pricing: {
      mode: "flat",
      amount: 250000,
      currency: "VND",
      basis: "per_booking",
      source: "prototype",
      certainty: "estimated",
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    constraints: { maxPax: 4 },
    operationalFields: ["hotel_or_pickup", "flight_number", "guest_note"],
    requiredOperationalFields: ["hotel_or_pickup", "flight_number"],
  },
  {
    id: "airport-private-transfer:suv",
    productId: "airport-private-transfer",
    label: "SUV 7 chỗ",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    pricing: {
      mode: "flat",
      amount: 362500,
      currency: "VND",
      basis: "per_booking",
      source: "prototype",
      certainty: "estimated",
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    constraints: { maxPax: 7 },
    operationalFields: ["hotel_or_pickup", "flight_number", "guest_note"],
    requiredOperationalFields: ["hotel_or_pickup", "flight_number"],
  },
  {
    id: "airport-private-transfer:van",
    productId: "airport-private-transfer",
    label: "Van 16 chỗ",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    pricing: {
      mode: "flat",
      amount: 550000,
      currency: "VND",
      basis: "per_booking",
      source: "prototype",
      certainty: "estimated",
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    constraints: { maxPax: 16 },
    operationalFields: ["hotel_or_pickup", "flight_number", "guest_note"],
    requiredOperationalFields: ["hotel_or_pickup", "flight_number"],
  },
];

export function offersForProduct(productId: ProductId) {
  return offers.filter(
    (offer) =>
      offer.productId === productId &&
      offer.status === "active",
  );
}

export function getOffer(productId: ProductId, offerId?: string) {
  const productOffers = offersForProduct(productId);
  return (
    productOffers.find((offer) => offer.id === offerId) ??
    productOffers[0]
  );
}

export function fromPriceForOffer(offer: Offer) {
  if (offer.pricing.mode === "flat") {
    return offer.pricing.amount;
  }
  if (!offer.pricing.units.length) return null;

  const headline = offer.pricing.headlineUnitCode
    ? offer.pricing.units.find(
        (unit) => unit.code === offer.pricing.headlineUnitCode,
      )
    : undefined;

  if (headline) return headline.amount;

  return offer.pricing.units.reduce(
    (lowest, unit) => Math.min(lowest, unit.amount),
    offer.pricing.units[0].amount,
  );
}

export function fromPriceForProduct(productId: ProductId) {
  const active = offersForProduct(productId);
  const prices = active
    .map(fromPriceForOffer)
    .filter((value): value is number => value !== null);

  if (!prices.length) return null;
  return Math.min(...prices);
}


export function priceCertaintyForProduct(productId: ProductId) {
  const active = offersForProduct(productId);
  if (!active.length) return null;

  return active.every(
    (offer) => offer.pricing.certainty === "final",
  )
    ? "final"
    : "estimated";
}


export function offerSupportsPax(offer: Offer, pax: number) {
  const maxPax = offer.constraints?.maxPax;
  return maxPax === undefined || pax <= maxPax;
}

export function maxPaxForProduct(productId: ProductId) {
  const active = offersForProduct(productId);
  const constrained = active
    .map((offer) => offer.constraints?.maxPax)
    .filter((value): value is number => value !== undefined);

  if (!constrained.length) return 20;
  return Math.min(20, Math.max(...constrained));
}


export function cancellationPolicyLabel(offer: Offer) {
  if (offer.policy.cancellation === "non_refundable") {
    return "Không hoàn / huỷ theo điều kiện đã chọn";
  }

  if (offer.policy.cancellation === "flexible") {
    return "Có thể đổi / huỷ theo điều kiện của lựa chọn";
  }

  return "JoTrip xác nhận điều kiện đổi / huỷ cùng tình trạng dịch vụ";
}

export function confirmationPolicyLabel(offer: Offer) {
  return offer.policy.confirmation === "instant"
    ? "Xác nhận ngay khi đủ điều kiện"
    : "Cần JoTrip xác nhận";
}
