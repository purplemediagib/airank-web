# AI Rank 0.15.0 — analytics milestone

This is the first implementation milestone of the larger Peec-parity work.
It is not a claim of complete Peec collection or product parity.

## Included

- First-mention position and win rate **within the frozen tracked-brand cohort**.
  These are not rankings against every possible untracked brand.
- Exact original-answer quotes and UTF-16 offsets supporting each first mention.
- Separate, unchanged explicit numbered-list rank and recommendation metrics.
- Brand comparison columns for visibility, tracked-cohort share of voice,
  assessed per-brand sentiment, tracked position, win rate and visibility change.
- Brand-row and KPI drilldowns to their underlying filtered original answers.
- Correction preventing an own-brand legacy sentiment assessment from being
  reused for a competitor with no per-brand assessment.
- Missing cohorts, overlapping aliases and unresolved normalized-only offsets
  are excluded from ranking denominators, not converted into zeroes.
- Old API-only and impossible-win-rate claims removed from the Overview.

Definitions are additive, versioned as tracked-literal-first-mention-v1. Existing
answer text, snapshots, explicit-list rank, collection records and historical
sentiment assessments are not rewritten. This read-only extraction sends no AI
requests and requires no database migration or new secret.

### Definitions

Position = mean first-mention order over comparable answers mentioning the brand.
Win rate = answers where the brand is first / all comparable eligible answers,
including valid answers that do not mention that brand. Failed, truncated,
diagnostic, ambiguous and unavailable-cohort answers are excluded.
Share of voice retains the existing measured-cohort denominator.
Recorded quotes are exact substrings, not generated supporting text.

### Still outside this milestone

Comprehensive untracked-brand entity detection, consumer Claude validation,
complete retrieval/citation/link analytics, content-type source classification,
fanout views, saved filters, GSC/GA4 integration and live recurring collection
validation remain part of the wider roadmap. Missing fields are not invented.

## PowerShell

Extract the ZIP completely. Open PowerShell in the folder containing the script:

```powershell
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Load
if ($LASTEXITCODE -ne 0) { throw "Load failed. Stop." }
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Push
if ($LASTEXITCODE -ne 0) { throw "Push failed. Stop." }
```

The archive contains prebuilt Linux/amd64 images. No Bash, WSL or local image
build is required. Source and tests are also included.

## Bunny rollout — same two containers

1. Record the current image tags and flags. Pause new daily submissions with
   PROJECT_SCHEDULER_ENABLED=false on API and worker. Allow already-paid
   collections to finish and save their results before restarting the worker.
2. Update the existing API image to:
   vtcarrie/bunny-mcp-connector:airank-api-0.15.0
3. Update the existing worker image to:
   vtcarrie/bunny-mcp-connector:airank-worker-0.15.0
4. Keep both default startup commands and all existing database, authentication,
   provider, budget and prompt allowance settings. No new environment variable
   or migration is needed when upgrading from a verified 0.14.1 installation.
   Do not rotate secrets or enable additional providers for this analytics patch.
5. Update/restart and confirm both health endpoints report version 0.15.0 and
   readiness is healthy. Health checks alone do not prove provider success.
6. Publish the updated frontend/BFF only after the API update. The older API is
   tolerated but new position/win-rate cards remain unavailable until it is upgraded.
   No Framer changes are required.
7. Restore scheduling only if it was previously intentionally enabled and you
   want paid daily tracking to continue. This release does not authorize a new
   live test, backfill, re-analysis or recurring spend.

## Read-only acceptance

Open an existing workspace containing valid monitoring answers with a recorded
brand cohort. Inspect the new KPI denominators and brand comparison. Click a
brand and confirm the answer list is scoped to that brand; clear it explicitly.
Open an answer and inspect its first-mention order, quotes and offsets.
Position and win rate must be unavailable for absent cohorts, and an observed
absence must remain a genuine zero win rate rather than unavailable.

For rollback, restore the previous API/worker image tags and frontend build.
There is no database rollback: this release has no schema or original-data changes.
