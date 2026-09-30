# PhuQuocLux Map data contract V1

Date: 29/09/2026

## Map is a first-class product surface

The Map is the primary visual and marketing backbone, but it must not trade accuracy for visual density.

## MapEntity fields

Every MapEntity carries:

- coordinate;
- category;
- verification status;
- coordinate scope;
- display priority;
- minimum zoom;
- optional Product link.

Verification states:

- `verified` - coordinate/anchor is trusted for its declared scope;
- `reference` - useful geographic reference, but not authoritative enough for a precise commerce/pickup claim;
- `demo` - development-only data.

Coordinate scopes:

- `area` - representative point for a named area, not an exact meeting point;
- `site` - representative point for a facility/site;
- `exact` - precise point that may be presented as an exact location.

Verification and precision are separate. A verified area point must still be labeled as a verified area, not as an exact pickup point.

## Commerce rule

Product detail maps only render `verified` anchors.

A `reference` point can still help discovery, but the UI must label it as a reference point.

Do not convert a broad place/area centroid into a pickup point.

## Progressive disclosure

At island zoom:

- high-priority destination anchors only;
- no attempt to render every POI.

As zoom increases:

- entities become eligible using `minZoom`;
- ordering uses `priority`;
- the current DOM-marker implementation caps visible markers to protect interaction performance.

Current caps:

- embedded Map: 80;
- full Map: 220.

## Scale boundary

The DOM-marker approach is acceptable for the current prototype/small verified dataset.

When visible production data grows beyond this range, migrate bulk entities to MapLibre GeoJSON sources with:

- clustering;
- layer-based rendering;
- server-side viewport queries;
- selected-entity overlay kept separate.

This change must not alter the MapEntity or Discovery contracts.

## Verification UX

Reference points are visually differentiated and their sheet explicitly says `Vị trí tham chiếu`.

This is deliberate: a clean map is not more valuable than a truthful map.

## Relationship to Open Phu Quoc

Shared destination/POI data may be consumed from the wider ecosystem when a stable shared source exists.

PhuQuocLux should not silently fork coordinates into a second untraceable dataset.

Commerce-specific anchors can remain in PhuQuocLux, but they require their own verification status.


## MapEntity does not own commerce navigation

A MapEntity is spatial context, not a product shortcut.

It does not store a single Product URL.

Related Products are resolved by Product → `mapEntityIds` relationships.

This matters because one place may support many products:

```
An Thới
  ├── Tour 3 đảo
  ├── Private canoe
  ├── Fishing trip
  └── future experiences
```

The Map sheet may render several related products while the MapEntity itself remains reusable destination data.


## Current location

Full Map mode may expose an opt-in, one-shot browser geolocation control.

Rules:

- never request location automatically on page load;
- browser permission is required;
- use one-shot recentering in V1 rather than continuous location tracking;
- PhuQuocLux does not persist the raw browser coordinate in Booking, Quote or customer records;
- current-location coordinates are not sent to commerce APIs by the Map component;
- after the map recenters, the configured map/tile provider may receive normal map resource requests for the viewed area, so provider privacy terms still matter.

Embedded Home/Product maps do not request current location.


## Current V1 precision labels

- Dương Đông: verified `area`
- An Thới: verified `area`
- Gành Dầu: reference `area`
- PQC: reference `site`

This prevents a trusted area anchor from being accidentally described to travelers as an exact meeting or pickup point.
