# PhuQuocLux Map data contract V1

Date: 29/09/2026

## Map is a first-class product surface

The Map is the primary visual and marketing backbone, but it must not trade accuracy for visual density.

## MapEntity fields

Every MapEntity carries:

- coordinate;
- category;
- verification status;
- display priority;
- minimum zoom;
- optional Product link.

Verification states:

- `verified` - coordinate/anchor is trusted for product/location presentation;
- `reference` - useful geographic reference, but not a precise commerce/pickup point;
- `demo` - development-only data.

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
