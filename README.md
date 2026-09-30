# PhuQuocLux - temporary GitHub Pages UI preview

This isolated `gh-pages` branch publishes an **older static design prototype** from `design/map-first-v1` so the map-first layout can be reviewed while Cloudflare preview is unavailable. It is **not** the current React Router/MapLibre application in PR #2 (`feat/react-router-v1`).

The demo is public, but carries a prominent warning and `noindex` metadata. Prices, pins, availability and any sample booking statuses are illustrative. Submitting checkout has been disabled; do not type real guest data. Development OpenStreetMap tiles are for small-scope review only and must not serve production traffic.

To publish: repository Settings > Pages > Source: Deploy from a branch > Branch: `gh-pages` > Folder: `/(root)` > Save. Then verify the deployed URL (expected GitHub Pages path: `https://kenzuko.github.io/phuquoclux-app/`). No custom domain or Cloudflare changes.

The latest app stays on PR #2. GitHub Pages does not run Cloudflare Workers, server-side Quote/Booking, server weather API or real payment. Do not equate this design preview with production readiness.
