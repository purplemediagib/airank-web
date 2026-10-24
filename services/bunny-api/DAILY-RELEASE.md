# AI Rank 0.12.0 — daily prompt sets

The source ZIP contains source only. The images ZIP contains tested prebuilt
Linux/amd64 API and worker images. If using the images ZIP, extract it,
open PowerShell there and load both images:

```powershell
docker load --input .\airank-docker-images-0.12.0.tar.gz
if ($LASTEXITCODE -ne 0) { throw "Image load failed. Stop." }
```

Then use the login/push commands below (skip the build command).
If using the source ZIP instead, extract it, open PowerShell there, and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Build-Daily-Release.ps1
if ($LASTEXITCODE -ne 0) { throw "Build failed. Stop." }
docker login
if ($LASTEXITCODE -ne 0) { throw "Login failed. Stop." }
docker push vtcarrie/bunny-mcp-connector:airank-api-0.12.0
if ($LASTEXITCODE -ne 0) { throw "API push failed. Stop." }
docker push vtcarrie/bunny-mcp-connector:airank-worker-0.12.0
if ($LASTEXITCODE -ne 0) { throw "Worker push failed. Stop." }
```

No Bash/WSL or Python is needed. Dockerfiles run the backend tests.
Both Docker images were built successfully in the development environment;
the Docker build runs the complete backend test suite.

## Bunny deployment — do this in order

1. Preserve current image tags and environment settings for rollback.
   Set `PROJECT_SCHEDULER_ENABLED=false` on the worker and restart it before
   upgrading. This prevents the old worker submitting old schedules.
2. Update API image to `vtcarrie/bunny-mcp-connector:airank-api-0.12.0`.
   Use the image's default command (`node src/app/start-release.mjs`), not
   an old custom migration command. Set `AIRANK_RUN_APP_MIGRATIONS=true`
   on the API, restart and confirm the log says migrations 001–013 verified.
   This is an additive migration; it cancels unsubmitted old schedule slots,
   resets old schedule times to daily, and preserves pauses and evidence.
   It does not merge conflicting accounts or make provider calls.
3. Set `AIRANK_RUN_APP_MIGRATIONS=false` after successful migration and
   restart the API normally. Update the worker image to
   `vtcarrie/bunny-mcp-connector:airank-worker-0.12.0`, default command.
4. Set these on BOTH API and worker:
   - `MONITORING_ENABLED=true`
   - `PROJECT_SCHEDULER_ENABLED=true` **only when ready for recurring paid calls**
   - `TRACKED_PROMPT_LIMIT`: your approved active-prompt cap (integer 0–5000).
     There is deliberately no default plan allowance. Missing/invalid values
     block adding/reactivating prompts and daily submissions explicitly.
   - Optional `TRACKED_PROMPT_LIMITS_JSON`: JSON mapping account IDs to integer
     caps, overriding the default for those accounts. This is an interim
     entitlement configuration, not a billing/plan catalogue.
5. Keep existing provider keys, `ENABLED_PROVIDERS`, models, database,
   OAuth/client registry and sentiment settings. Keep your existing
   `MAX_DAILY_PROVIDER_CALLS` and `MONITORING_MAX_TASKS_PER_RUN` limits.
   On the worker, `MONITORING_CONCURRENCY=2` is the existing safe default.
   Raising a budget can increase spend; do not raise it just to hide errors.
6. Restart API and worker, then publish the updated Replit frontend/BFF.
   No new Framer settings are needed; anonymous marketing scans are unchanged.

## Behavior and checks

- One active set per account. Legacy accounts with several active projects
  must explicitly archive the extras in Settings; no automatic data merge.
- All active prompts must match the current market/language and be neutral.
  Review/convert or archive diagnostic/context-mismatched prompts; no silent
  subset sampling. Over-limit sets are retained and reported, not truncated.
- Prompts automatically enroll on the next worker sweep or schedule read.
  Reads enroll metadata only; they never make provider calls.
- Each account has a stable time between 04:00 and 04:59 Europe/Helsinki,
  daily, DST-aware. First setup waits until the next scheduled time.
  Pause/resume uses the same daily schedule; no weekly editor or manual run.
- Runs use exact saved prompt IDs/versions and frozen identity/provider/cohort
  context. Owner/date submission keys prevent a second daily run, including
  after changing the active project. Legacy monitoring runs and submitted
  schedule slots on the same Helsinki date also prevent a new paid run
  during an upgrade. Missed slots more than six hours late
  are skipped; no automatic backfill or retry of ambiguous provider calls.
- Confirm API/worker health version 0.12.0, then sign in normally.
  Prompts should show the configured usage/cap, status and next Helsinki time.
  Add/edit/archive/restore a prompt; check the count after refresh.
  Pause/resume and check the next time. Historical answers must still open.
- After the first scheduled time, check run status and original answers.
  `capacity_blocked`, provider errors and partial completion are not success;
  investigate the stated reason and worker logs, not only health endpoints.
- Sentiment still requires its existing separate configuration and budget;
  this release does not enable extra paid historical sentiment analysis.

## Rollback

Disable `PROJECT_SCHEDULER_ENABLED` and `MONITORING_ENABLED` on the worker
and restart before reverting images. Preserve database/evidence; do not
delete migration records or run destructive reverse migrations. Old images
must not run the converted schedules. Keep scheduling disabled until a
compatible release is restored. Revert frontend separately if needed.
