# AI Rank 0.11.2 — one tracked prompt list

The signed-in first/one-off check now takes its exact question text from the
project's active neutral tracked prompts for the selected market and question
language. It no longer falls back to generated Finnish defaults. Future
monitoring already reads this same project prompt list. The one-off result
remains a saved measurement record, not a second prompt library.

No migration or environment-variable changes are required. The backend changes;
publish the updated Replit frontend for the clarified bilingual explanation.
No scan or backfill is started by this release.

## Build with Windows PowerShell

Extract the source archive and run PowerShell in the extracted folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build-Prompt-Analytics.ps1
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Stop here.' }
docker login
if ($LASTEXITCODE -ne 0) { throw 'Docker login failed. Stop here.' }
docker push vtcarrie/bunny-mcp-connector:airank-api-0.11.2
if ($LASTEXITCODE -ne 0) { throw 'API push failed. Stop here.' }
docker push vtcarrie/bunny-mcp-connector:airank-worker-0.11.2
if ($LASTEXITCODE -ne 0) { throw 'Worker push failed. Stop here.' }
```

The build script sets its own working directory. Keep Docker Desktop running
with Linux containers. These commands build and push images only after the
operator runs them; this archive contains source, not prebuilt Docker images.

## Update Bunny

Update the existing `airank-api` Magic Container image to
`vtcarrie/bunny-mcp-connector:airank-api-0.11.2`. The matching worker image is
included; update it to `vtcarrie/bunny-mcp-connector:airank-worker-0.11.2`
only if you want both containers on the same release tag. No worker code
changed for this behavior.

Leave ports, startup commands, database, OAuth and provider environment values
unchanged. There are no new variables. Keep `MONITORING_ENABLED` and current
provider/budget settings as configured.

## User-visible behavior

- Add or accept prompts under **Prompts** for the selected project, market and
  question language first.
- The first-check preview shows the wording from that active tracked set.
- If no active neutral prompt matches that project context, preview is blocked
  and directs the user to Prompts; it will not silently substitute templates.
- Future monitoring uses the same tracked set. Editing a prompt creates a
  version; earlier measurements remain attached to their original wording.
- The one-off check remains a distinct run/history type. Existing historical
  saved checks are not relinked to prompts based on text similarity.

This change does not expand scan limits. If a tracked list is larger than the
configured provider-call budget, the existing worker budget behavior still
applies; no new provider calls are enabled.
