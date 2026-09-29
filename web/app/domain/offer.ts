import type { Currency } from "./commerce";
import type { ProductType } from "./catalog";

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

export type Offer = {
  id: string;
  productType: ProductType;
  label: string;
  status: OfferStatus;
  providerId: string;
  availabilityMode: AvailabilityMode;
  price: {
    amount: number;
    currency: Currency;
    basis: PriceBasis;
    source: OfferPriceSource;
  };
  policy: {
    cancellation: "provider_defined" | "non_refundable" | "flexible";
    confirmation: "instant" | "request";
  };
  operationalFields: OperationalField[];
};

const offers: Offer[] = [
  {
    id: "tour:shared",
    productType: "tour",
    label: "Ghép đoàn",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    price: {
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
    id: "tour:private",
    productType: "tour",
    label: "Cano riêng",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    price: {
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
    id: "ticket:adult",
    productType: "ticket",
    label: "Người lớn",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    price: {
      amount: 700000,
      currency: "VND",
      basis: "per_person",
      source: "prototype",
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["guest_note"],
  },
  {
    id: "ticket:child",
    productType: "ticket",
    label: "Trẻ em",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    price: {
      amount: 504000,
      currency: "VND",
      basis: "per_person",
      source: "prototype",
    },
    policy: {
      cancellation: "provider_defined",
      confirmation: "request",
    },
    operationalFields: ["guest_note"],
  },
  {
    id: "transfer:sedan",
    productType: "transfer",
    label: "Sedan 4 chỗ",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    price: {
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
    id: "transfer:suv",
    productType: "transfer",
    label: "SUV 7 chỗ",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    price: {
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
    id: "transfer:van",
    productType: "transfer",
    label: "Van 16 chỗ",
    status: "active",
    providerId: "jotrip-manual-request",
    availabilityMode: "request",
    price: {
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

export function offersForProduct(type: ProductType) {
  return offers.filter(
    (offer) => offer.productType === type && offer.status === "active",
  );
}

export function getOffer(type: ProductType, offerId?: string) {
  const productOffers = offersForProduct(type);
  return (
    productOffers.find((offer) => offer.id === offerId) ??
    productOffers[0]
  );
}

export function fromPriceForProduct(type: ProductType) {
  const active = offersForProduct(type);
  if (!active.length) return null;

  return active.reduce(
    (lowest, offer) => Math.min(lowest, offer.price.amount),
    active[0].price.amount,
  );
}
