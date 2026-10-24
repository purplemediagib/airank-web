# AI Rank 0.17.0 — evidence intelligence

Includes 0.15 and 0.16; update directly to 0.17.0.

## Features and definitions

- Detected-brand extraction considers company/product brands beyond the tracked
  competitor list. It is automated extraction, not a guarantee of perfect entity
  recall or identity resolution. Review controls confirm/reject/reset candidates
  without changing tracked competitors or their frozen historical metrics.
- Rankings order literal first mentions among active detected brands per analysed
  answer. They are not explicit recommendation/list rankings. A compound product
  mention is not counted again as an overlapping parent-company mention.
- Quotes/UTF-16 offsets are resolved against original text; URL-only inferred
  brands are rejected. Finnish inflections are supported. Model context quotes
  and fabricated offsets are not displayed as evidence.
- Visibility/win-rate denominators include all successfully analysed answers,
  including answers with no brands. Failed, truncated, unanalysed or incompatible
  outputs cannot silently become zero-brand answers. Ambiguous/rejected entities
  are excluded from positions until appropriately reviewed.
- Results are versioned by extractor/model. Originals remain immutable. Reviews
  are current workspace annotations, with an append-only audit, and intentionally
  affect the current detected-brand view; no old tracked-cohort score is rewritten.
- Source publisher/platform types: corporate, UGC, editorial, institutional,
  unknown. Conservative curated host rules carry provenance. Workspace overrides
  can set any type or reset to default. These are publisher-host categories, not
  claims about every page's author/content. Ownership remains a separate field.
- Source-type filtering and explicit URL-count denominators; counts are not
  inferred retrieval events.
- Search fan-out aggregates actual captured supplier query fields, with coverage,
  variants/provenance/providers, search/pagination and original-answer drilldowns.
  Unknown is distinct from an explicitly empty captured array. Suggested
  follow-ups are never treated as searches.
- Gemini's huge global locale catalogue exceeded the existing 8 MB response
  limit. Country-scoped location lookup fixes this without increasing the bound
  or silently substituting a different market/language.

## PowerShell

Extract the ZIP fully. Open PowerShell in the extracted release folder.
Docker Desktop must be running in Linux containers mode.

```powershell
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Load
if ($LASTEXITCODE -ne 0) { throw "Load failed. Stop." }
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Push
if ($LASTEXITCODE -ne 0) { throw "Push failed. Stop." }
```

The package has prebuilt Linux/amd64 images. No Bash/WSL/build is needed.
The script verifies the archive checksum and image labels/platform.

## Existing Bunny containers — one new migration

Back up the database and record current image tags/flags. Pause new scheduled
submissions on API/worker (`PROJECT_SCHEDULER_ENABLED=false`), letting already-paid
in-flight work finish and persist before restarting. Preserve all other budgets,
credentials, guest limits, unlimited-workspace policy and existing startup defaults.

1. Keep `ENTITY_ANALYSIS_ENABLED=false` initially.
2. Update API to `vtcarrie/bunny-mcp-connector:airank-api-0.17.0`.
3. Set `AIRANK_RUN_APP_MIGRATIONS=true` temporarily on API and restart using its
   default startup command. This idempotently adds `app-015-evidence-intelligence`;
   it does not reprocess answers or submit paid work.
4. Confirm `AI Rank app migrations 001–015 verified successfully.` in startup logs.
   Remove/set false the migration opt-in afterward and restart API.
5. Update the existing worker to
   `vtcarrie/bunny-mcp-connector:airank-worker-0.17.0`.
6. Confirm version/health, then publish the updated frontend AND BFF.
   The BFF now allows the ownership/CSRF-protected intelligence mutation route.
7. Restore daily scheduling only if previously authorized and wanted.

No extra Magic Container or Framer change is needed. Publisher review and captured
fan-out views work after migration without enabling paid brand extraction.

## Optional paid brand analysis — separate activation decision

The one-off $5 pilot does NOT authorize recurring production analysis.
Only when the operator chooses to activate it, set these on API and worker:

```
ENTITY_ANALYSIS_ENABLED=true
ENTITY_ANALYSIS_MODEL=gpt-4.1-mini-2025-04-14
ENTITY_ANALYSIS_MAX_DAILY_CALLS=25
```

Keep model/flag consistent on both. Worker needs its existing `OPENAI_API_KEY`.
The daily call cap is independent of provider collection and sentiment budgets;
0 pauses new paid entity calls. Failures/interrupted calls count toward the cap.

Enabling starts future evidence only. The UI's explicit confirmation can queue
up to 50 selected saved answers; this is a paid backfill, not a page-view side
effect. Original answers above 24,000 characters are marked skipped. Failed,
unknown, or expired paid attempts are not automatically resubmitted. Database
save failures retry storage only. Changing model creates a separate analysis
version and future-only activation boundary, not a silent historical backfill.

## Validation scope / blockers

See LIVE-VALIDATION.md for the approved isolated Finnish pilot. No tracked prompt
sets, production database rows, or recurring schedules were changed by that pilot.
Consumer Claude remains unsupported: a shared-chat scraper or Claude model API is
not a new consumer-prompt collector. Do not add Claude to
CONSUMER_COLLECTION_PROVIDERS. Existing separately labelled Claude API access
remains unchanged. This is not a claim of complete Peec collection parity.

## Rollback

Restore prior API/worker tags and prior frontend/BFF. Leave the additive migration
tables intact; do not delete original answers, reviews or audit rows.
