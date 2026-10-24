# AI Rank 0.11.1 — prompt analytics

This is a **source release**, not a prebuilt Docker image archive. It incorporates
the supplied 0.11.0 source and adds read-only prompt analytics. It has not been
pushed or deployed. The Dockerfiles run the backend test suite during your build;
the container build itself has not been executed in Replit.

## Windows PowerShell

Extract the ZIP, open the extracted `airank-prompt-analytics-0.11.1` folder,
then open PowerShell in that folder. Docker Desktop must use Linux containers.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build-Prompt-Analytics.ps1
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Stop here.' }
docker login
if ($LASTEXITCODE -ne 0) { throw 'Docker login failed. Stop here.' }
docker push vtcarrie/bunny-mcp-connector:airank-api-0.11.1
if ($LASTEXITCODE -ne 0) { throw 'API push failed. Stop here.' }
docker push vtcarrie/bunny-mcp-connector:airank-worker-0.11.1
if ($LASTEXITCODE -ne 0) { throw 'Worker push failed. Stop here.' }
```

The build script changes to its own directory, so nested Downloads extraction
folders are safe. Do not use `bash`; no WSL setup is needed.

## Bunny Magic Containers

After successful pushes, update the **existing** API image to
`vtcarrie/bunny-mcp-connector:airank-api-0.11.1`.
The prompt analytics change is API-only; the worker can remain at the deployed
0.11.0, or use the matching `airank-worker-0.11.1` built from the same source.
Do not replace it with an earlier worker.

Keep existing ports, origins, OAuth clients, database URLs/tokens and provider
credentials unchanged. Leave startup-command overrides empty to use image CMD,
unless your deployment has a separately verified required override.

### Environment values to verify

No new variables are introduced by prompt analytics.

| Container | Existing variable | Required for |
|---|---|---|
| API and worker | `MONITORING_ENABLED=true` | Accepting and processing tracked-prompt monitoring |
| API and worker | `SENTIMENT_ENABLED=true` | Sentiment reads and worker analysis |
| Worker | `OPENAI_API_KEY` | Existing sentiment analyst credential |
| API and worker | `ENABLED_PROVIDERS` | Your intended configured provider selection |
| Both | `APP_ENV=production` | Existing production environment |

Keep existing model overrides and provider keys. Do not paste keys in commands
or frontend code. Preserve your configured spending limits. Enabling processing
can process already queued work; inspect queues before changing enablement.

**No new database migration is required.** The existing sentiment migration
`app-012-sentiment` was confirmed in the database. Do not enable an automatic
migration runner solely for this release.

## Replit and Framer

Publish the Replit frontend/proxy changes after updating the API. There are no
new Replit environment variables or Framer changes. Until the updated API is
active, prompt metrics show an explicit update-required state rather than
mislabeling project-wide metrics as prompt metrics.

## Verification

- API `/healthz` should report `0.11.1`; this alone does not verify analytics.
- Sign in normally: Overview must expose saved quick checks and original answers.
- Prompt detail must show its exact current-version scope and no measurements
  when no monitoring exists, not a fabricated score.
- Starting monitoring remains a paid action requiring explicit confirmation.
  No scans or backfills were started by preparing this release.
- After a confirmed successful run, verify eligible counts, prompt metrics,
  Results evidence and sentiment states. Sentiment may finish after collection.

If a release fails, retain the prior image reference for a container rollback.
No database rollback is needed for this additive read-only endpoint change.
