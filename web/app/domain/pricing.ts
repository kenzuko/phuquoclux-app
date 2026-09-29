import type { QuoteLine } from "./commerce";
import type { Offer } from "./offer";

export type UnitQuantities = Record<string, number>;

export type PricedOffer = {
  pax: number;
  totalAmount: number;
  priceState: Offer["pricing"]["certainty"];
  lines: QuoteLine[];
};

function vnd(amount: number) {
  return { amount: Math.round(amount), currency: "VND" as const };
}

function boundedQuantity(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(20, Math.floor(parsed)));
}

export function defaultUnitQuantities(
  offer: Offer,
  pax: number,
): UnitQuantities {
  if (offer.pricing.mode !== "unit_mix") return {};

  const first = offer.pricing.units[0];
  if (!first) return {};

  return {
    [first.code]: Math.max(1, Math.min(20, Math.floor(pax))),
  };
}

export function priceOffer(
  offer: Offer,
  pax: number,
  unitQuantities: UnitQuantities = {},
): PricedOffer {
  const safePax = Math.max(1, Math.min(20, Math.floor(pax)));

  if (offer.pricing.mode === "flat") {
    const quantity =
      offer.pricing.basis === "per_person" ? safePax : 1;
    const totalAmount = offer.pricing.amount * quantity;

    return {
      pax: safePax,
      totalAmount,
      priceState: offer.pricing.certainty,
      lines: [
        {
          code: "base",
          label: offer.label,
          quantity,
          unitPrice: vnd(offer.pricing.amount),
          total: vnd(totalAmount),
        },
      ],
    };
  }

  const lines = offer.pricing.units
    .map((unit) => {
      const quantity = boundedQuantity(unitQuantities[unit.code]);
      if (!quantity) return null;
      const totalAmount = unit.amount * quantity;
      return {
        code: unit.code,
        label: unit.label,
        quantity,
        unitPrice: vnd(unit.amount),
        total: vnd(totalAmount),
      } satisfies QuoteLine;
    })
    .filter((line): line is QuoteLine => Boolean(line));

  const totalPax = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (totalPax < 1) {
    const fallback = defaultUnitQuantities(offer, safePax);
    return priceOffer(offer, safePax, fallback);
  }

  if (totalPax > 20) {
    throw new Error("TOO_MANY_PARTICIPANTS");
  }

  return {
    pax: totalPax,
    totalAmount: lines.reduce((sum, line) => sum + line.total.amount, 0),
    priceState: offer.pricing.certainty,
    lines,
  };
}

export function unitQuantitiesFromSearch(
  offer: Offer,
  searchParams: URLSearchParams,
  fallbackPax: number,
) {
  if (offer.pricing.mode !== "unit_mix") return {};

  const quantities: UnitQuantities = {};
  for (const unit of offer.pricing.units) {
    quantities[unit.code] = boundedQuantity(
      searchParams.get(`u_${unit.code}`),
    );
  }

  const total = Object.values(quantities).reduce(
    (sum, value) => sum + value,
    0,
  );

  return total > 0
    ? quantities
    : defaultUnitQuantities(offer, fallbackPax);
}

export function appendUnitQuantities(
  params: URLSearchParams,
  offer: Offer,
  quantities: UnitQuantities,
) {
  if (offer.pricing.mode !== "unit_mix") return;

  for (const unit of offer.pricing.units) {
    const quantity = boundedQuantity(quantities[unit.code]);
    if (quantity > 0) {
      params.set(`u_${unit.code}`, String(quantity));
    }
  }
}
