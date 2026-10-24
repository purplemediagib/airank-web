# Historical login-only handover — release 0.5.0

**Superseded and unsafe for the current release. Do not run these old 0.5.0 build/push or container-update instructions.** Use `docs/BATCH-12-HANDOVER.md` and `docs/FINAL-RELEASE-DELTA.md` with the versioned 0.6.0 release bundle. Those instructions cover current additive migrations and the API/worker environment split.

Source prepared and 67 backend tests passed. Images have NOT been built/pushed, migrations have NOT run on Bunny, and live Google login has NOT been verified.

## 1. Build on your Docker machine

Use this entire updated folder, not the original 0.2.0 ZIP. Authenticate to your existing Docker Hub account locally; do not send credentials in chat.

Windows PowerShell: `.\build-and-push.ps1`

macOS/Linux: `bash build-and-push.sh`

The scripts build/test/push linux/amd64 images:

- `vtcarrie/bunny-mcp-connector:airank-api-0.5.0`
- `vtcarrie/bunny-mcp-connector:airank-worker-0.5.0`

Stop if either build/test/push fails. These tags must not overwrite existing 0.2.0/0.4.0 images.

## 2. Prepare the existing services

Take a backup of the existing Bunny database using your established backup process. Keep the prior image references for rollback. Do NOT recreate the apps, database, users or storage.

Preserve existing database, Google, checker, storage and provider settings. Set `MONITORING_ENABLED=false` explicitly on BOTH apps; existing container settings can override image defaults. Do not submit any quick checks or monitoring runs during login verification. Existing public-checker traffic remains existing behaviour, not disabled by this switch.

In the existing Google OAuth client, ADD the following authorised redirect URI without removing the checker callback:

`https://79189840-76dd-4103-9cd4-94e86b73459e-00-1z3g8gj8qzabv.archer.replit.dev/api/airank/v1/app/google/callback`

This is the current development preview, NOT the production address. If Google OAuth is in Testing mode, ensure the account you use is an allowed test user.

On the API container, add/merge `AIRANK_OAUTH_CLIENTS_JSON` using the value in `oauth-clients-preview.json`. This file contains public origin/callback configuration, not credentials. Preserve any existing entries. Production app.airank.me registration should be added separately when that frontend is actually published.

## 3. Explicit migrations and image update

The user has authorised additive migrations. After backup, set `AIRANK_RUN_APP_MIGRATIONS=true` on the API container for this release.

Update the EXISTING API container to `airank-api-0.5.0`, port 3000. Use the image's default command: `node src/app/start-release.mjs`. An existing command override pointing directly to `src/api/server.mjs` MUST be removed or updated, otherwise the requested migrations will not run.

The opt-in release entrypoint runs app migrations 001, 002 and 003 against the EXISTING database before starting the API. It does not run the baseline schema migration, enqueue scans or call any AI providers. Failure stops startup rather than serving a partially migrated app. The migrations are checksum-verified and repeatable across replicas.

Wait for the log:

`AI Rank app migrations 001–003 verified successfully.`

Verify API `/healthz` reports 0.5.0 and `/readyz` is healthy. Then set `AIRANK_RUN_APP_MIGRATIONS=false`; normal startup does not migrate.

Update the EXISTING worker container to `airank-worker-0.5.0`, port 3001, default command `node src/worker/worker.mjs`. Keep monitoring disabled. Existing quick-check compatibility remains; existing jobs/traffic can still be processed.

If startup fails, capture only redacted error messages. Do not paste environment dumps or credentials. Restore the prior image if needed; do not drop additive tables or restore a backup over newer data as a routine rollback.

## 4. Verify login only

- API `/v1/app/session` with header `x-airank-client: replit-preview` should return HTTP 200, not 404.
- The Replit preview `/api/airank/v1/app/session` should return HTTP 200 with login available, not `APP_NOT_CONFIGURED`.
- Open `/en/sign-in` or `/fi/sign-in` in the current preview and use Google.
- Confirm you reach the dashboard, can save a project and reload it, then log out.
- Do not click Start check or Start monitoring during this verification.

A Google `redirect_uri_mismatch` points to the callback registration; `CLIENT_NOT_CONFIGURED`/`APP_NOT_CONFIGURED` points to the registry, origin or migration prerequisites. Do not bypass authentication or weaken redirect validation.
