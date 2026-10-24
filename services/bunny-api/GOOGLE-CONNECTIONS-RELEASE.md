# Google connections release — 0.18.0

## What changes

The existing **airank-api** authenticates and authorises project operations, then calls your separate Google Connector. The web app exposes Settings → Connections in EN/FI. The connector owns Google OAuth, tokens, property access, imports and cached reports. No Google credentials go to the browser.

The existing product has owner-managed project workspaces, not separate team memberships. Only the active project's stored owner can read or manage its connection. The upstream workspace header uses that authorised project's ID; neither user nor workspace IDs are accepted from the browser. Keep this mapping stable when adding teams later.

No new app/database migration is required. The existing monitoring worker does not run these Google imports and needs no Google credentials. The bundled worker image is version-aligned but has no Google behavior change.

## PowerShell / Docker Desktop

Extract this release ZIP. Open PowerShell inside the extracted release directory, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Release-Collectors.ps1 -Action Load
if ($LASTEXITCODE -ne 0) { throw "Image load failed. Stop here." }
.\Release-Collectors.ps1 -Action Push
if ($LASTEXITCODE -ne 0) { throw "Image push failed. Stop here." }
```

The script verifies image checksums, version labels and Linux/amd64. No Bash, WSL or build environment is needed for the prebuilt image package. If a script throws, stop; do not update Bunny.

## Existing Bunny airank-api container

Update image to `vtcarrie/bunny-mcp-connector:airank-api-0.18.0`.
Set these server-only variables:

| Name | Value |
| --- | --- |
| GOOGLE_CONNECTOR_BASE_URL | https://mc-kvj7j25914.bunny.run |
| GOOGLE_CONNECTOR_API_KEY | The same private value as CONNECTOR_API_KEY on the Google Connector |
| GOOGLE_CONNECTOR_RETURN_URL | https://app.airank.me/en/settings?tab=connections |

Never paste the shared key into chat, source code, Framer or a VITE_/public variable. Keep all existing API variables. Leave its startup command at the image default (or existing `node src/app/start-release.mjs`). No migration/startup override is needed for this feature.

The worker may remain on its current version for this change. If updating it as part of your normal paired release, use `vtcarrie/bunny-mcp-connector:airank-worker-0.18.0` and preserve its current configuration.

## Existing Google Connector container

Keep its deployed 0.1.0 image; this release does not replace it.
Ensure all its required variables are populated:
`PUBLIC_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CONNECTOR_API_KEY`, `TOKEN_ENCRYPTION_KEY`, `APP_RETURN_URLS`.
Use a persistent `/data` volume and the existing encryption key; changing it risks making stored connections unreadable.

Set PUBLIC_BASE_URL to `https://mc-kvj7j25914.bunny.run`.
Add this exact URL to the comma-separated APP_RETURN_URLS allowlist:
`https://app.airank.me/en/settings?tab=connections`

The Google OAuth client must allow:
`https://mc-kvj7j25914.bunny.run/v1/oauth/google/callback`

This is separate from the app's existing Google sign-in callback. Do not replace or remove that login callback.
Keep Google Analytics Admin, Analytics Data and Search Console APIs enabled. Confirm OAuth consent/test-user access and applicable verification.
Preserve its sync configuration and persistent storage. `/health` only proves it runs; `/ready` must return HTTP 200 with `ready:true` before consent testing.

## Replit web app and Framer

Publish the updated AI Rank web app and BFF after deploying airank-api. Replit's BFF still calls the existing API; the connector key belongs on Bunny airank-api. Replit's secure copy is only needed for supported direct-server development/integration checks, never frontend access. Do not add secrets to Framer. There are no Framer changes for this feature.

Fixed published return URL (confirmed from deployment metadata):
**https://app.airank.me/en/settings?tab=connections**

The browser stores initiating project and locale before leaving. A Finnish interface is restored on return; callback query parameters are informational only and never authenticate a connection.

## Checks requiring your Google consent

1. Open a project → Settings → Connections. Connect GA4, approve read-only access, select a property, wait for import. Repeat separately for Search Console.
2. Confirm connected account, property, timezone/currency, import dates and status; close/reopen the page during sync.
3. Compare cached report rows against equivalent Google reports, using the same dates, timezone, dimensions and filters. Missing dates, thresholding, sampling and truncation must remain visible.
4. GA4 reports are **identified AI referrals only**, not all AI traffic or prompt-to-visit attribution. GSC includes AI features in Web search; it does not isolate AI Overview traffic. GSC totals are separate from query rows; rates must not be added.
5. Cancel one OAuth attempt, revoke access in Google and reconnect, and test a Google account with no accessible property.
6. Use a different app account/project: the first project's connection must be unreadable and unchangeable.
7. Test disconnect only on a disposable test connection after reading confirmation: it removes imported data and stored tokens, not the Google grant itself.

Offline tests/fixtures are not evidence of live Google consent or a completed production import.
