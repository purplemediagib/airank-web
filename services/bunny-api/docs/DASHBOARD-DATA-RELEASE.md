# Dashboard data update

## Scope

The analytics response now includes `competitors`: metrics and per-run history
for the cohort frozen into the selected comparable monitoring runs.
Quick-check snapshots are fetched separately by the frontend through the
existing authenticated report endpoint; they are never merged into monitoring.

## Rollout

1. Load the prepared, uniquely tagged API image with the PowerShell steps in
   `WINDOWS-POWERSHELL-RELEASE.md`. Confirm the immutable tag is unused before
   pushing; do not overwrite an existing release.
2. Push that image and update the existing Bunny **API** Magic Container.
3. Publish the frontend after the API responds successfully. It also tolerates older APIs without
   the new optional competitor field, and shows the tracked-brand fallback.

No new environment variables, database migrations, worker changes, or Framer
embed changes are required for this update. Keep existing credentials and
monitoring settings unchanged. The image build script builds locally and never
pushes or deploys.

## Verify

- An authenticated project analytics request returns `competitors`.
- Runs that saved a cohort yield owned and competitor brand metrics, with
  eligible/expected answer counts. Missing cohorts return an empty array.
- Visibility change is percentage points between the latest two eligible
  comparable runs in the selected period, not a fabricated period comparison.
- Failed responses and diagnostic runs never become zero-valued measurements.
- Another user's project cannot be read.
- The frontend shows the saved quick-check result separately from monitoring
  filters/history; the original report remains accessible.

Historical cohorts are not retroactively invented. If an old monitoring run did
not capture a cohort, confirm the tracked competitors and run new monitoring.
Multiple comparable runs are needed for an actual historical trend.
