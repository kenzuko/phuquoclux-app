# Production stack decision V1

Date: 29/09/2026  
Status: **LOCKED FOR IMPLEMENTATION AFTER VISUAL REVIEW**

## Decision

### Web application
- React Router v8
- React + TypeScript
- Vite
- Cloudflare Vite plugin
- Cloudflare Workers

Why:
- first-class full-stack React Router support on Workers;
- SSR is useful for public product/detail pages and search discovery;
- route loaders/actions fit Product → Quote → Booking flows without putting business logic in map components;
- same Worker runtime can host the initial modular-monolith API;
- avoids introducing a second hosting platform.

Official references:
- https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- https://developers.cloudflare.com/workers/vite-plugin/

## Map rendering
- MapLibre GL JS
- provider-agnostic vector style/tile configuration

Why:
- open-source renderer;
- strong control over the visual map language;
- vector layers, routes, clustering and camera interactions;
- MapLibre Native exists for future iOS/Android paths;
- avoids coupling Product / MapEntity logic to Google Maps or one tile provider.

Official reference:
- https://maplibre.org/maplibre-gl-js/docs/

### Important provider rule

MapLibre is the **renderer**, not the map-data contract.

Production tile/style provider stays configurable:

```
MAP_STYLE_URL
MAP_TILE_PROVIDER
MAP_ATTRIBUTION
```

Do not hard-code one provider into discovery/domain code.

## Backend shape

Initial system remains a modular monolith.

```
React Router / Worker
  ├── UI routes
  ├── Discovery
  ├── Catalog
  ├── Pricing
  ├── Availability
  ├── Checkout
  ├── Booking
  ├── Payment
  ├── Customer
  └── Provider adapters
```

Map components consume Discovery view models. They never own Booking state.

## Data

Transactional source of truth should be PostgreSQL when commerce wiring starts.

Cloudflare edge/cache products may hold:
- read models;
- map/discovery cache;
- short-lived quote/cache data;
- non-authoritative projections.

Do not make cache or map state the booking ledger.

## Prototype vs production

The current static prototype intentionally uses Leaflet + OpenStreetMap tiles to validate interaction quickly.

Production implementation will replace that layer with MapLibre without changing:
- MapEntity model;
- product links;
- category/filter state;
- viewport search contract;
- booking flow.

## Migration gate

Do not scaffold/migrate the production framework until:
1. Home + Map visual direction is accepted.
2. Product detail flow is accepted.
3. Checkout flow is accepted.
4. My Bookings flow is accepted.

This keeps framework work from hiding unresolved product problems.
