import {
  type Quote,
  type QuoteLine,
} from "../domain/commerce";
import {
  isProductType,
  products,
  type ProductType,
} from "../domain/catalog";
import { checkAvailabilityForProduct } from "./availability.server";

export type PrototypeQuoteInput = {
  type: ProductType;
  optionId?: string;
  pax: number;
  serviceDate?: string;
};

function vnd(amount: number) {
  return { amount: Math.round(amount), currency: "VND" as const };
}

function defaultServiceDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function earlierExpiry(a: string, b?: string) {
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

/**
 * Temporary server-side Quote boundary.
 *
 * Price is still prototype catalog pricing, but availability already travels
 * through the ProviderAdapter contract. The current adapter intentionally
 * returns "request" instead of pretending supplier inventory is live.
 */
export async function createPrototypeQuote(
  input: PrototypeQuoteInput,
): Promise<Quote> {
  if (!isProductType(input.type)) {
    throw new Error("INVALID_PRODUCT_TYPE");
  }

  const product = products[input.type];
  const option =
    product.options.find((item) => item.id === input.optionId) ??
    product.options[0];

  const pax = Math.max(1, Math.min(20, input.pax));
  const quantity = product.type === "transfer" ? 1 : pax;
  const now = new Date();
  const serviceDate = input.serviceDate || defaultServiceDate();
  const productId = `product:${product.type}`;
  const offerId = `offer:${product.type}:${option.id}`;
  const totalAmount = product.fromPrice * option.multiplier * quantity;

  const availability = await checkAvailabilityForProduct(product.type, {
    productId,
    offerId,
    serviceDate,
    pax,
    optionId: option.id,
  });

  const priceExpiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const expiresAt = earlierExpiry(priceExpiry, availability.expiresAt);

  const lines: QuoteLine[] = [
    {
      code: "base",
      label: option.label,
      quantity,
      unitPrice: vnd(product.fromPrice * option.multiplier),
      total: vnd(totalAmount),
    },
  ];

  return {
    id: crypto.randomUUID(),
    status: "active",
    productType: product.type,
    productId,
    offerId,
    optionId: option.id,
    serviceDate,
    pax,
    lines,
    total: vnd(totalAmount),
    createdAt: now.toISOString(),
    expiresAt,
    availabilitySnapshot: availability,
  };
}
