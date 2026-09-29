# Home + Map V1 design spec

## Intent

This pass keeps the original PhuQuocLux/Jotrip map-heavy visual idea but makes the interaction consistent with the locked product architecture.

## Mobile

Order:
1. compact consumer brand;
2. direct search;
3. date / pax context;
4. map filters;
5. large embedded map;
6. quick service intents;
7. product cards;
8. trust / local-operation reassurance;
9. persistent bottom navigation.

Embedded map is intentionally not full screen on entry. It must remain useful without blocking page scroll.

## Desktop

Desktop is not a stretched mobile page.

- Results / commerce content stays left.
- Map becomes a sticky workspace on the right.
- Filters affect both results and pins.
- Full-map mode remains available.

## Interaction locks

- Search can focus the relevant map area.
- Map filter chips are filters, not duplicate service navigation.
- “Search this area” is a deliberate viewport query.
- Full map is opt-in.
- Product cards and map data are conceptually synchronized.
- Map pins are MapEntities; they are not Product records.

## Prototype limitations

- Current product pricing/content is placeholder UI copy.
- The airport marker is explicitly demo data.
- OSM/Leaflet is used only to validate interaction.
- No booking/payment/inventory API is wired yet.
- Weather chip is a visual context placeholder, not live data.

## Next design pass

1. Replace placeholder product visuals with a consistent PhuQuocLux photographic system.
2. Build product-detail pattern for Tour, Ticket and Transfer.
3. Define MapEntity card / area sheet.
4. Define booking drawer / checkout.
5. Define My Bookings / voucher surface.
6. Only after those are stable, select production frontend and map stack.
