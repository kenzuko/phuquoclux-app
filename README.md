# My Phu Quoc

Map-first mass travel marketplace for Phu Quoc, operated by JoTrip.

> Repository and infrastructure identifiers still use the legacy `phuquoclux` name intentionally. They are internal compatibility names and are not the public brand.

## Current product direction

The public consumer product is **My Phu Quoc** with the line **“Your Island, Your Way.”**

- search + date/pax remain first-class for mass users;
- a large embedded Phu Quoc map remains the visual backbone;
- map/category/results are synchronized;
- full-map exploration exists without forcing every buyer to use the map;
- quick services prioritize clear purchase intent;
- Tours, Tickets and Transfers are visually prioritized;
- post-booking / commerce architecture remains separate from the map layer;
- JoTrip remains the local operator / commerce layer rather than a competing header brand.

## Production web app

The current implementation lives under `web/` and uses:

- React Router v8 + TypeScript
- Vite + Cloudflare Vite plugin
- Cloudflare Workers
- MapLibre GL JS with provider-agnostic tiles/styles

The root-level plain HTML/CSS/JS files are legacy prototype material and are not the canonical production frontend.

## Product locks

See:
- `docs/PRODUCT_LOCK.md`
- `docs/BRAND_UI_DIRECTION.md`
- `design/tokens.css`

## Core UX spine

```text
Home / Map → Product → Checkout → My Bookings
```

Commerce remains fail-closed until its production gates are explicitly cleared.
