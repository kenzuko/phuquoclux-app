# PhuQuocLux App

Map-first mass travel marketplace for Phu Quoc, operated by JoTrip.

## Current design prototype

The first UI pass validates the locked direction:

- compact PhuQuocLux consumer identity with a quiet `by JoTrip` signature;
- search + date/pax remain first-class for mass users;
- a large embedded Phu Quoc map remains the visual backbone;
- map/category/results are synchronized;
- full-map exploration exists without forcing every buyer to use the map;
- quick services prioritize clear purchase intent;
- Tours, Tickets and Transfers are visually prioritized;
- post-booking / commerce architecture remains separate from the map layer.

### Prototype tech

This design branch intentionally uses plain HTML/CSS/JS plus Leaflet/OpenStreetMap so the UX can be reviewed without prematurely locking the production frontend stack or map vendor.

OpenStreetMap tiles here are **development-only**. Production map provider, caching, tile policy, clustering and map styling remain architecture decisions.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Product locks

See:
- `docs/PRODUCT_LOCK.md`
- `docs/BRAND_UI_DIRECTION.md`
- `design/tokens.css`


## Current review flow

Routes in the prototype:

- `/` - Home + embedded Map
- `/product.html?type=tour`
- `/product.html?type=ticket`
- `/product.html?type=transfer`
- `/checkout.html`
- `/bookings.html`

The current branch now covers the full UX spine:

```
Home / Map → Product → Checkout → My Bookings
```

## Production stack decision

After UX acceptance, production implementation is locked to:

- React Router v8 + TypeScript
- Vite + Cloudflare Vite plugin
- Cloudflare Workers
- MapLibre GL JS with provider-agnostic tiles/styles

See `docs/STACK_DECISION_V1.md`.
