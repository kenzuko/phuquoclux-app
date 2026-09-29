import type { Quote } from "../domain/commerce";
import { isProductId } from "../domain/catalog";

export type PrototypeQuoteReceipt = {
  id: string;
  productType: Quote["productType"];
  priceState: Quote["priceState"];
  productId: Quote["productId"];
  offerId: string;
  serviceDate: string;
  pax: number;
  totalAmount: number;
  currency: Quote["total"]["currency"];
  lineSignature: string;
  createdAt: string;
  expiresAt: string;
};

function lineSignature(quote: Quote) {
  return quote.lines
    .map(
      (line) =>
        `${line.code}:${line.quantity}:${line.unitPrice.amount}:${line.total.amount}`,
    )
    .join("|");
}

export function serializePrototypeQuoteReceipt(quote: Quote) {
  const receipt: PrototypeQuoteReceipt = {
    id: quote.id,
    productType: quote.productType,
    priceState: quote.priceState,
    productId: quote.productId,
    offerId: quote.offerId,
    serviceDate: quote.serviceDate,
    pax: quote.pax,
    totalAmount: quote.total.amount,
    currency: quote.total.currency,
    lineSignature: lineSignature(quote),
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
  };

  return JSON.stringify(receipt);
}

export function parsePrototypeQuoteReceipt(
  raw: string,
  now = new Date(),
): PrototypeQuoteReceipt {
  if (raw.length > 2000) {
    throw new Response("Invalid quote receipt", { status: 400 });
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Response("Invalid quote receipt", { status: 400 });
  }

  if (!value || typeof value !== "object") {
    throw new Response("Invalid quote receipt", { status: 400 });
  }

  const receipt = value as Partial<PrototypeQuoteReceipt>;
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    typeof receipt.id !== "string" ||
    !uuidLike.test(receipt.id) ||
    !["tour", "ticket", "transfer"].includes(String(receipt.productType)) ||
    !["estimated", "final"].includes(String(receipt.priceState)) ||
    typeof receipt.productId !== "string" ||
    !isProductId(receipt.productId) ||
    typeof receipt.offerId !== "string" ||
    typeof receipt.serviceDate !== "string" ||
    typeof receipt.pax !== "number" ||
    !Number.isInteger(receipt.pax) ||
    receipt.pax < 1 ||
    receipt.pax > 20 ||
    typeof receipt.totalAmount !== "number" ||
    !Number.isFinite(receipt.totalAmount) ||
    receipt.totalAmount < 0 ||
    receipt.currency !== "VND" ||
    typeof receipt.lineSignature !== "string" ||
    receipt.lineSignature.length > 1000 ||
    typeof receipt.createdAt !== "string" ||
    typeof receipt.expiresAt !== "string"
  ) {
    throw new Response("Invalid quote receipt", { status: 400 });
  }

  const createdAt = new Date(receipt.createdAt);
  const expiresAt = new Date(receipt.expiresAt);
  if (
    Number.isNaN(createdAt.getTime()) ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= createdAt.getTime()
  ) {
    throw new Response("Invalid quote receipt", { status: 400 });
  }

  if (expiresAt.getTime() <= now.getTime()) {
    throw new Response("Quote expired", { status: 409 });
  }

  return receipt as PrototypeQuoteReceipt;
}

export function reconcilePrototypeQuote(
  receipt: PrototypeQuoteReceipt,
  freshQuote: Quote,
): Quote {
  const changed =
    receipt.productType !== freshQuote.productType ||
    receipt.priceState !== freshQuote.priceState ||
    receipt.productId !== freshQuote.productId ||
    receipt.offerId !== freshQuote.offerId ||
    receipt.serviceDate !== freshQuote.serviceDate ||
    receipt.pax !== freshQuote.pax ||
    receipt.totalAmount !== freshQuote.total.amount ||
    receipt.currency !== freshQuote.total.currency ||
    receipt.lineSignature !== lineSignature(freshQuote);

  if (changed) {
    throw new Response("Quote changed. Refresh before continuing.", {
      status: 409,
    });
  }

  return {
    ...freshQuote,
    id: receipt.id,
    createdAt: receipt.createdAt,
    expiresAt: receipt.expiresAt,
  };
}
