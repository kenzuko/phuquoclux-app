import {
  type AvailabilityResult,
  type Quote,
  type QuoteLine,
} from "../domain/commerce";
import {
  isProductType,
  products,
  type ProductType,
} from "../domain/catalog";

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

/**
 * Temporary server-side quote boundary.
 *
 * This is intentionally NOT a real availability service. It always returns
 * state=request so the UI never implies inventory was confirmed.
 */
export function createPrototypeQuote(input: PrototypeQuoteInput): Quote {
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
  const expires = new Date(now.getTime() + 15 * 60 * 1000);
  const totalAmount = product.fromPrice * option.multiplier * quantity;

  const availability: AvailabilityResult = {
    state: "request",
    checkedAt: now.toISOString(),
    source: "manual",
    expiresAt: expires.toISOString(),
    note: "Prototype only: provider availability has not been connected.",
  };

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
    productId: `product:${product.type}`,
    offerId: `offer:${product.type}:${option.id}`,
    optionId: option.id,
    serviceDate: input.serviceDate || defaultServiceDate(),
    pax,
    lines,
    total: vnd(totalAmount),
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    availabilitySnapshot: availability,
  };
}
