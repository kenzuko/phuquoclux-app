import {
  type Quote,
  type QuoteLine,
} from "../domain/commerce";
import {
  isProductType,
  type ProductType,
} from "../domain/catalog";
import { getOffer } from "../domain/offer";
import { normalizeServiceDate } from "../domain/service-date";
import { checkAvailabilityForOffer } from "./availability.server";

export type PrototypeQuoteInput = {
  type: ProductType;
  offerId?: string;
  pax: number;
  serviceDate?: string;
};

function vnd(amount: number) {
  return { amount: Math.round(amount), currency: "VND" as const };
}

function earlierExpiry(a: string, b?: string) {
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

/**
 * Temporary server-side Quote boundary.
 *
 * Pricing is still prototype data, but Product and Offer are now separated.
 * Availability travels through the ProviderAdapter selected by the Offer.
 */
export async function createPrototypeQuote(
  input: PrototypeQuoteInput,
): Promise<Quote> {
  if (!isProductType(input.type)) {
    throw new Error("INVALID_PRODUCT_TYPE");
  }

  const offer = getOffer(input.type, input.offerId);
  if (!offer) {
    throw new Error("OFFER_NOT_FOUND");
  }

  const pax = Math.max(1, Math.min(20, input.pax));
  const quantity = offer.price.basis === "per_person" ? pax : 1;
  const now = new Date();
  const serviceDate = normalizeServiceDate(input.serviceDate, now);
  const productId = `product:${input.type}`;
  const totalAmount = offer.price.amount * quantity;

  const availability = await checkAvailabilityForOffer(offer, {
    productId,
    offerId: offer.id,
    serviceDate,
    pax,
  });

  const priceExpiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const expiresAt = earlierExpiry(priceExpiry, availability.expiresAt);

  const lines: QuoteLine[] = [
    {
      code: "base",
      label: offer.label,
      quantity,
      unitPrice: vnd(offer.price.amount),
      total: vnd(totalAmount),
    },
  ];

  return {
    id: crypto.randomUUID(),
    status: "active",
    productType: input.type,
    productId,
    offerId: offer.id,
    serviceDate,
    pax,
    lines,
    total: vnd(totalAmount),
    createdAt: now.toISOString(),
    expiresAt,
    availabilitySnapshot: availability,
  };
}
