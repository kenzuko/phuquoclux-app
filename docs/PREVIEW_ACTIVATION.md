# PhuQuocLux preview activation

This runbook activates an **isolated Workers.dev preview**. It does not merge branches, alter production DNS, connect real payments or enable live commerce.

## Current gate

Only PR #2 from `feat/react-router-v1`, carrying the `preview-approved` label, is eligible. Visual QA and strict CI must pass first.

The preview job requires these repository settings. Configure them in GitHub at:

**Repository → Settings → Secrets and variables → Actions**

Under **Variables**, add:
- `PHUQUOCLUX_PREVIEW_ENABLED` = `true`

Under **Repository secrets**, add:
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token scoped to the intended account with Workers Scripts edit permissions.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID for that account. The workflow currently reads it from Secrets for compatibility.

Do not paste your API token into an issue, chat, commit, variable, or workflow log.

After configuration, rerun the preview workflow on the feature branch. If GitHub does not display a manual dispatch for the unmerged workflow, remove and re-add `preview-approved` on PR #2 to retrigger the labeled event, or push another change.

## Isolation

- Worker name: `phuquoclux-app-preview`.
- Public host after successful deployment: the account's Workers.dev route for this worker (confirm the exact URL from Wrangler deployment logs, do not assume the account subdomain).
- `COMMERCE_MODE=prototype` is always enforced by the preview command.
- Weather context points at the specialized Open Phu Quoc Weather runtime.
- Map defaults to the globally covered OpenFreeMap Liberty style for QA; this is an external third-party dependency, with automatic map attribution and no availability SLA. Production style choice remains gated separately.

## Acceptance

1. strict typecheck and domain checks pass;
2. iPhone WebKit and desktop Chromium visual journeys pass;
3. Home/Full Map basemap **actually loads**, not merely the page shell;
4. prototype prices and unconfirmed booking state are clearly labeled;
5. transfer capacity and checkout validation are intact;
6. the preview Workflow reports a successful deploy step and actual Workers.dev URL.

Do not approve production launch based only on browser screenshots or a green build.
