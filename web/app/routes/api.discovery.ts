import type { LoaderFunctionArgs } from "react-router";
import {
  discover,
  type BoundingBox,
  type DiscoveryQuery,
} from "../domain/discovery";
import type { MapCategory } from "../domain/catalog";

function number(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bounds(url: URL): BoundingBox | undefined {
  const west = number(url.searchParams.get("west"));
  const south = number(url.searchParams.get("south"));
  const east = number(url.searchParams.get("east"));
  const north = number(url.searchParams.get("north"));

  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined
  ) {
    return undefined;
  }

  return { west, south, east, north };
}

function category(value: string | null): DiscoveryQuery["category"] {
  const allowed: Array<"all" | MapCategory> = [
    "all",
    "tour",
    "ticket",
    "transfer",
    "place",
  ];
  return allowed.includes(value as "all" | MapCategory)
    ? (value as "all" | MapCategory)
    : "all";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pax = number(url.searchParams.get("pax"));

  const result = discover({
    bounds: bounds(url),
    category: category(url.searchParams.get("category")),
    q: url.searchParams.get("q") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    pax,
  });

  return Response.json(result, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
    },
  });
}
