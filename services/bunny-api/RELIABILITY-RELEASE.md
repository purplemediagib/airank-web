# Reliability release 0.20.0

These are source changes, not a production deployment.

## Monitoring worker

The Claude output default remains **1400**, not 8192. `CLAUDE_MAX_TOKENS`
is the preferred setting; the legacy `CLAUDE_MAX_OUTPUT_TOKENS` alias is
supported only when the preferred variable is absent. Both adapter dispatch and
reservation planning use that same precedence. The allowed integer range is
256–16384; invalid configuration fails explicitly.
The one permitted pause-turn continuation shares the remaining output allowance.
Unknown usage prevents continuation; max_tokens failures never silently retry.
Incomplete historical answers remain unchanged and excluded.

Do not increase the allowance above 1400 without an approved monetary reservation.
Configure `API_BUDGET_CONFIG_JSON` with an explicit positive `dailyUsd` and a
matching `routes.claude` transport/model, `contextWindowTokens`, `maxInputBytes`,
`maxReplayBytes`, and operator-verified `inputUsdPerMillion`,
`outputUsdPerMillion`, and `searchUsdPerCall`. No supplier prices are assumed.
The worker reserves conservatively for two full input contexts, two configured
output allowances and up to six searches before dispatch. Frozen limits, rather
than later environment edits, govern the requests. Actual cumulative requested
output uses the remaining configured allowance after reported usage; input and
search charges remain additional. Failed or ambiguous calls retain reservations
and never silently retry or refund.

Without explicit API pricing, only Claude at or below 1400 may use the existing
call-count-only compatibility path; that path is not a monetary guarantee.
The consumer-collector dollar ledger remains separate:
`CONSUMER_MAX_DAILY_COST_USD` is not a Claude dollar limit. Verify current
Anthropic pricing and provider account spending controls before activation.
No paid validation or backfill was performed for this release.

AI Overview task failures now retain the numeric upstream task error code for diagnosis;
this does not retroactively recover discarded errors or assert the prior failure cause.

## API and Google connector

Deploy the API to receive safe import error classifications. See the separate
Google connector release instructions for the upstream diagnostic update.
Google imports remain separate from the monitoring worker.
Monetary API reservations require the additive `app-017-api-reservations`
migration. Follow `docs/RECONCILIATION-ROLLOUT.md`; apply it only to the intended
database with operator approval. It does not rewrite historical evidence.

## PowerShell — build from this source

Run from the extracted source root with Docker Desktop running:

```powershell
docker build --platform linux/amd64 -f services/bunny-api/Dockerfile -t vtcarrie/bunny-mcp-connector:airank-api-0.20.0 services/bunny-api
if ($LASTEXITCODE -ne 0) { throw "API build failed" }
docker build --platform linux/amd64 -f services/bunny-api/Dockerfile.worker -t vtcarrie/bunny-mcp-connector:airank-worker-0.20.0 services/bunny-api
if ($LASTEXITCODE -ne 0) { throw "Worker build failed" }
docker login
if ($LASTEXITCODE -ne 0) { throw "Login failed" }
docker push vtcarrie/bunny-mcp-connector:airank-api-0.20.0
if ($LASTEXITCODE -ne 0) { throw "API push failed" }
docker push vtcarrie/bunny-mcp-connector:airank-worker-0.20.0
if ($LASTEXITCODE -ne 0) { throw "Worker push failed" }
```

Update the two existing Bunny containers to their corresponding tags. Preserve
all current credentials, scheduler and budget settings. No additional container
is required. Confirm health version and worker_configuration output allowance.
Health proves liveness only; a new authorized measurement must confirm Claude completion.
Publish the frontend separately to expose Traffic and usability changes.
Rollback: restore the prior image tags; no measurement records need deleting.
