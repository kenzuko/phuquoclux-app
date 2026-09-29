import type {
  Quote,
  QuoteLine,
} from "../domain/commerce";
import {
  getProductById,
  type ProductId,
} from "../domain/catalog";
import { getOffer } from "../domain/offer";
import { normalizeServiceDate } from "../domain/service-date";
import { checkAvailabilityForOffer } from "./availability.server";

export type PrototypeQuoteInput = {
  productId: ProductId;
  offerId?: string;
  pax: number;
  serviceDate?: string;
  requestId?: string;
};

function vnd(amount: number) {
  return { amount: Math.round(amount), currency: "VND" as const };
}

function earlierExpiry(a: string, b?: string) {
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

export async function createPrototypeQuote(
  input: PrototypeQuoteInput,
): Promise<Quote> {
  const product = getProductById(input.productId);
  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const offer = getOffer(product.id, input.offerId);
  if (!offer) {
    throw new Error("OFFER_NOT_FOUND");
  }

  const pax = Math.max(1, Math.min(20, input.pax));
  const quantity = offer.price.basis === "per_person" ? pax : 1;
  const now = new Date();
  const serviceDate = normalizeServiceDate(input.serviceDate, now);
  const totalAmount = offer.price.amount * quantity;

  const availability = await checkAvailabilityForOffer(
    offer,
    {
      productId: product.id,
      offerId: offer.id,
      serviceDate,
      pax,
    },
    input.requestId,
  );

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
    productType: product.type,
    productId: product.id,
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
