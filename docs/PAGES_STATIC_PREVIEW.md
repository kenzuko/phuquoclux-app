# GitHub Pages static preview from main

- Canonical source: `main`.
- Static preview: https://kenzuko.github.io/phuquoclux-app/next/ (separate from the legacy HTML prototype at the Pages root).
- On pull requests targeting `main`, run typecheck, a static build and iPhone/desktop Playwright checks. **No publishing on pull requests.**
- After a qualifying push to `main` passes those checks, publish only the compiled `/next/` folder to `gh-pages`. The existing Pages root stays unchanged.
- This preview reuses application UI, catalog and pricing domain logic, but replaces server checkout with a non-transactional illustration and deliberately omits Cloudflare-only API calls.
- **Do not enter real guest data or treat prototype prices/pins as verified offers.** Pages does not provide a production booking backend or payment provider.
- Production Cloudflare deployment has a separate gated workflow and is not configured by this Pages PR. Review production gates and QA independently before activating it.
- The historical `preview/pages-react-v1` branch generated the first static preview. Once this PR is merged, let `main` own subsequent Pages builds; avoid publishing new commits from the historical branch.
