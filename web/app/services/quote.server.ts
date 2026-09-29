import type { Quote } from "../domain/commerce";
import {
  getProductById,
  type ProductId,
} from "../domain/catalog";
import { getOffer } from "../domain/offer";
import {
  priceOffer,
  type UnitQuantities,
} from "../domain/pricing";
import { normalizeServiceDate } from "../domain/service-date";
import { checkAvailabilityForOffer } from "./availability.server";

export type PrototypeQuoteInput = {
  productId: ProductId;
  offerId?: string;
  pax: number;
  unitQuantities?: UnitQuantities;
  serviceDate?: string;
  requestId?: string;
};

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

  const priced = priceOffer(
    offer,
    input.pax,
    input.unitQuantities,
  );
  const now = new Date();
  const serviceDate = normalizeServiceDate(input.serviceDate, now);

  const availability = await checkAvailabilityForOffer(
    offer,
    {
      productId: product.id,
      offerId: offer.id,
      serviceDate,
      pax: priced.pax,
    },
    input.requestId,
  );

  const priceExpiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const expiresAt = earlierExpiry(priceExpiry, availability.expiresAt);

  return {
    id: crypto.randomUUID(),
    status: "active",
    productType: product.type,
    productId: product.id,
    offerId: offer.id,
    serviceDate,
    pax: priced.pax,
    lines: priced.lines,
    total: {
      amount: priced.totalAmount,
      currency: "VND",
    },
    createdAt: now.toISOString(),
    expiresAt,
    availabilitySnapshot: availability,
  };
}
