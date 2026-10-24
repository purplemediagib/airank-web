# App identity/projects extension (unpublished 0.3.0)

## 0.8.0 dashboard data update (prepared, not pushed)

Adds real per-brand measurements from each monitoring run's frozen competitor
cohort. Also includes first-check dashboard support in the frontend release.
No schema migration, environment-variable change, or worker code change is
required. Build and update the existing API container only; see
`docs/DASHBOARD-DATA-RELEASE.md` and `docs/WINDOWS-POWERSHELL-RELEASE.md`.

Release preparation update: source/images are now versioned 0.5.0. See RELEASE-LOGIN.md for Docker-machine build/push and exact current preview callback configuration. A new release entrypoint supports explicit operator opt-in migrations; default startup still never migrates. Nothing has been pushed or applied externally.

Batch 05 adds explicit `node src/monitoring/migration.mjs` after earlier app migrations. Release API and worker together; see `../../docs/BATCH-05-REPORT.md` for activation switches and bounded worker defaults. Monitoring is disabled until explicitly enabled. Never start paid verification or migrate production as part of a local fixture test.

Batch 04 adds explicit migration `node src/app/scan-migration.mjs`, after the original app migration. It creates durable project-scan linkage without changing old jobs. App-client scan requests use the existing /v1/scans paths with ownership/CSRF and confirmation checks; public guest requests retain their original contract. The BFF refuses legacy-only deployments before sending scan POSTs. See docs/BATCH-04-REPORT.md in the workspace for activation and verification details. No migration or release has been executed.

This directory is the supplied 0.2.0 API source plus additive Batch 03 changes. Existing checker routes, Google identities, sessions and observations are retained. No code in this directory is automatically started or deployed by Replit. The original attached archive stays unchanged.

## Operator prerequisites

The existing Bunny API keeps its existing BUNNY_DATABASE_URL/AUTH_TOKEN, Google client credentials and checker redirect settings. Do not create a new identity/database.

Add server-only `AIRANK_OAUTH_CLIENTS_JSON`, an exact client registry:

```json
{
  "replit-preview": {
    "origin": "https://YOUR-APPROVED-PREVIEW-HOST",
    "redirectUri": "https://YOUR-APPROVED-PREVIEW-HOST/api/airank/v1/app/google/callback"
  },
  "app": {
    "origin": "https://app.airank.me",
    "redirectUri": "https://app.airank.me/api/airank/v1/app/google/callback"
  }
}
```

These are configuration examples, not claims of approved/live domains. Register those exact callback URLs with the EXISTING Google OAuth client alongside the existing checker callback. State binds the configured client, origin and callback; no browser-provided redirect origin is trusted. App OAuth uses a separate state table/cookie, while users and sessions are shared with the checker.

The Replit BFF uses AIRANK_PUBLIC_ORIGIN and AIRANK_OAUTH_CLIENT_ID. Development can derive its single HTTPS origin from REPLIT_DEV_DOMAIN and uses `replit-preview`; production requires explicit AIRANK_PUBLIC_ORIGIN and defaults to `app`. AIRANK_API_ORIGIN defaults to the supplied Bunny API. Browser headers cannot override either origin or client ID. No Bunny DB or Google credentials belong in the BFF.

## Additive migration and release

Only after isolated testing, backup/restore preparation and operator approval:

1. Install the external release's declared dependencies with its existing release process.
2. Run `node src/app/migration.mjs` against the intended existing Bunny database. This verifies users exists, executes additive app_* DDL in a write transaction, records checksum and is repeatable. Does not alter or delete existing tables/data. Not called on API startup.
3. Deploy this API release by the existing external process. New routes fail closed unless the migration checksum and client registry match. Keep the checker OAuth configuration intact.
4. Configure Google callbacks/BFF origin and verify live two-account login, create/edit/archive, logout and expiry. That live verification is still blocked pending operator setup.

App routes are `/v1/app/session`, `/v1/app/google/start`, `/v1/app/google/callback`, `/v1/app/logout`, `/v1/projects`, `/v1/projects/:id`, `/v1/projects/:id/versions`, `/v1/projects/:id/archive`, `/v1/me/preferences`. BFF mirrors under `/api/airank`.

Rollback: disable new client registration/capability and revert app-facing API/BFF code. Keep populated additive tables/history. Never drop evidence or restore over newer data as a routine rollback.

## Offline verification

`node --test test/*.test.mjs` tests legacy checker plus extension ownership, session/CSRF, signed Google JWT validation, migration repeatability/data preservation, optimistic conflicts, archive and persistence after SQLite close/reopen. Uses fixture identities and injected Google exchange, not live accounts.

Run root `pnpm test` for frozen-release regression suites plus modified API and BFF tests. The browser fixture lives under api-server/test, binds loopback only and is never imported by production; it is not a development login bypass.
