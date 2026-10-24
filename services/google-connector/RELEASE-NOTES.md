# Google connector 0.1.1 — safe import diagnostics

Source imported from the supplied 0.1.0 archive (1792345975095); deploy this directory as a separate connector, alongside the Bunny API diagnostic allowlist update.

- `sync.lastError` remains a nullable string. New failures preserve only allowlisted category, HTTP status, Google status and Google ErrorInfo/legacy reason codes. No upstream message, error description, metadata, property ID, token or request headers are included. Unknown/old errors remain generic.
- OAuth, workspace isolation, encrypted storage, report shapes, backfill bounds and retry limits are unchanged. Failed jobs retain their cursor and completed report cache; an explicit sync resumes the failed date. Existing completed jobs are not reset.
- No schema or secret changes. Docker build context: `services/google-connector`; build its Dockerfile, tag/push an operator-selected 0.1.1 image, then update the existing connector deployment. Retain its persistent `/data` volume and all existing environment settings, especially `TOKEN_ENCRYPTION_KEY`. Back up the encrypted volume before rollout; never rotate that key as part of this update.
- Deploy the Bunny API changes too; otherwise its old generic-error filter still hides diagnostics. Existing 0.1.0 failures contain no recoverable structured details. Reading status alone cannot reconstruct them.

## GA4 source investigation (not a root-cause claim)

Each date performs five sequential `runReport` requests (overview, sources, pages, countries, devices), each with `sessions`, `engagedSessions`, `engagementRate`, `keyEvents`, `sessionKeyEventRate`, `totalRevenue`. Pages additionally requests `landingPagePlusQueryString`; country/device views add their respective dimension to session source/medium. A date is cached only after all five requests succeed, so 0/90 does not identify which request failed. No metric/dimension changes or fallback reports were invented.

Fixtures verify request shape and simulated structured failures, not Google's live compatibility. A generic `INVALID_ARGUMENT` is classified as invalid_request, **not** report_incompatible unless an explicit allowlisted reason says so. API enablement, permissions, quota and compatibility remain hypotheses until genuine diagnostics are obtained.

## Operator verification and bounded recovery

1. Confirm connector `/health` reports 0.1.1 and readiness; this is not collection-success evidence.
2. Through the existing authenticated, ownership-checked project status route, inspect only sync status/progress and sanitized lastError. Never export OAuth credentials or raw Google errors.
3. If the old failed job must be reproduced, obtain approval before using the existing explicit sync action for the affected property only. It resumes at the saved cursor but may continue remaining backfill dates, up to the pre-existing 90-day bound; this is not a single-request probe. Do not disconnect, change selection or clear `/data` to retry.
4. Use the resulting safe category/status/reason to investigate the relevant configuration. If compatibility remains suspected, an authorized operator can use Google's `checkCompatibility` against the exact selected property's metric/dimension sets; this release does not call it or establish compatibility.
5. Confirm cached reports and other workspaces remain intact. Rollback: restore the prior connector image/API build with the same volume/configuration; no migration is required. Older API builds will display generic errors again.

No live import, production mutation, secret access or deployment was performed for this release.
