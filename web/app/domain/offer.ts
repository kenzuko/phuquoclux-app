import type { Currency } from "./commerce";
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
  units: UnitRate[];
};

export type OfferPricing = FlatPricing | UnitMixPricing;

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
  operationalFields: OperationalField[];
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
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["hotel_or_pickup", "flight_number", "guest_note"],
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
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["hotel_or_pickup", "flight_number", "guest_note"],
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
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["hotel_or_pickup", "flight_number", "guest_note"],
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
