import type { Product } from "./catalog";
import { normalizeServiceDate } from "./service-date";

export type TripIntent = {
  date: string;
  pax: number;
};

export function normalizePax(value: unknown, fallback = 2) {
  // Number(null) and Number("") are zero, not evidence that the user chose 1.
  if (value === null || value === undefined ||
      (typeof value === "string" && value.trim() === "")) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

export function tripIntentFromUrl(url: URL): TripIntent {
  return {
    date: normalizeServiceDate(url.searchParams.get("date") ?? undefined),
    pax: normalizePax(url.searchParams.get("pax"), 2),
  };
}

export function appendTripIntent(
  params: URLSearchParams,
  intent: TripIntent,
) {
  params.set("date", intent.date);
  params.set("pax", String(intent.pax));
  return params;
}

export function productSlugUrl(
  slug: string,
  intent: TripIntent,
) {
  const params = appendTripIntent(new URLSearchParams(), intent);
  return `/product/${slug}?${params.toString()}`;
}

export function productUrl(
  product: Product,
  intent: TripIntent,
) {
  return productSlugUrl(product.slug, intent);
}

export function mapUrl(
  intent: TripIntent,
  extra?: URLSearchParams,
) {
  const params = new URLSearchParams(extra);
  appendTripIntent(params, intent);
  return `/map?${params.toString()}`;
}


export function homeUrl(intent: TripIntent) {
  const params = appendTripIntent(new URLSearchParams(), intent);
  return `/?${params.toString()}`;
}
