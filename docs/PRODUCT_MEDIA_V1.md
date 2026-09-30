# PhuQuocLux product media V1

Date: 30/09/2026

## Purpose

Product photography is part of trust, not decoration.

Until a verified image is available, PhuQuocLux uses an explicit branded illustration placeholder instead of inserting a generic tropical photo that may not match the product or location.

## Product media states

`Product.media` is one of:

- `placeholder`
- `photo`

A photo carries:

- controlled app asset path;
- alt text;
- optional credit;
- optional source URL for editorial traceability.

## Photo acceptance rules

A product photo must satisfy all of these before replacing a placeholder:

1. correct product or genuinely representative activity;
2. correct or clearly relevant Phu Quoc location;
3. adequate resolution for card and hero crops;
4. known usage rights / source;
5. no watermark in the customer-facing crop;
6. no stretched or distorted aspect ratio;
7. no AI-generated scene presented as documentary photography.

## Location accuracy

Do not use a beautiful but wrong beach, island or resort merely because the visual mood is similar.

If the exact product photo is unavailable, keep the branded placeholder.

Accuracy is more important than filling every media slot.

## Asset handling

Production product images should be copied into the controlled app/media pipeline and referenced from local or managed asset paths.

Do not hotlink third-party hotel, OTA, social or editorial images.

## UI behavior

The same `ProductVisual` component renders both:

- current branded placeholders;
- future verified photography.

This allows photography to be added later without changing Product card or Product detail layout.

## Current state

All V1 sample products remain on `placeholder`.

That is intentional until real media is selected and rights/source checks are complete.
