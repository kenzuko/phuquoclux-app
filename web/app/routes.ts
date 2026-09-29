import {
  index,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("map", "routes/map.tsx"),
  route("product/:slug", "routes/product.tsx"),
  route("checkout/:slug", "routes/checkout.tsx"),
  route("trip", "routes/trip.tsx"),
  route("bookings", "routes/bookings.tsx"),
  route("api/health", "routes/api.health.ts"),
  route("api/discovery", "routes/api.discovery.ts"),
] satisfies RouteConfig;
