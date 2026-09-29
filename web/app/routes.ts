import {
  index,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("product/:type", "routes/product.tsx"),
  route("checkout/:type", "routes/checkout.tsx"),
  route("bookings", "routes/bookings.tsx"),
] satisfies RouteConfig;
