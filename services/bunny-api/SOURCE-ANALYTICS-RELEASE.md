# AI Rank 0.16.0 — source evidence and measurement workflow

This release includes the 0.15.0 tracked-brand position/win-rate milestone.
Use this package instead of 0.15.0; two successive upgrades are unnecessary.
It is an additive analytics update, not a claim of complete Peec parity.

## What changes

- Sources uses the same dated, ownership-checked, compatible monitoring cohort
  as Overview, not an unrelated historical research pool.
- Explicit citations, supplier source references, reported search results and
  literal answer URLs remain four separate evidence kinds.
- Domain/URL grouping, ownership filters, search, sorting, pagination, deep links
  and original-answer navigation with provenance, snippets and passage context.
- Unique answer counts are unions of evidence IDs, never sums of URL counts.
- Supplied occurrence counts are max per answer/URL, then summed. They are not
  independently verified fetches or total retrieval events. Missing counts stay
  unavailable. Domain rows deliberately do not sum occurrences across URLs.
- Observability/coverage is shown separately. Unsupported citation or retrieval
  observations must not be presented as measured zeroes.
- Overview top domains/categories use explicit citations on this API; legacy
  mixed references remain labelled as such on older servers.
- Shared prompt, prompt-version, tag, collection-method and custom UTC-date
  filters. The BFF forwards the same real input contract.
- Browser-only measurement filter presets are scoped to account and workspace;
  up to five presets can be saved, loaded or deleted. They are not account-wide
  synced filters, and do not store answer text or source-search state.
- Invalid-date and filter reset recovery, stale-source drawer protection, safe
  external links and immutable original answers.
- Analytics loads original payloads only for the selected and preceding
  comparison windows and indexes them by run in memory. Sources renders 25 rows
  per page; this is not a new server-side paginated analytics contract.

Existing evidence is read, not overwritten or reclassified in the database.
Frozen workspace ownership/cohort facts govern historical attribution. This
release requires no schema migration, new secrets or new Magic Container.

## PowerShell — prebuilt Linux/amd64 images

Extract the ZIP completely and open PowerShell in its extracted release folder.
Docker Desktop must be running in Linux containers mode.

```powershell
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Load
if ($LASTEXITCODE -ne 0) { throw "Load failed. Stop." }
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Push
if ($LASTEXITCODE -ne 0) { throw "Push failed. Stop." }
```

No Bash, WSL or local image build is needed. The script verifies the archive
checksum and image labels before pushing. Source and offline tests are included.

## Bunny rollout — existing API and worker

1. Record the current tags/flags. Pause new scheduled submissions with
   PROJECT_SCHEDULER_ENABLED=false on API and worker. Let already-paid
   in-flight collections finish and persist before restarting.
2. Update API to vtcarrie/bunny-mcp-connector:airank-api-0.16.0.
3. Update worker to vtcarrie/bunny-mcp-connector:airank-worker-0.16.0.
4. Keep default startup commands and existing database, authentication, provider,
   prompt allowance and budget settings. No new env variables or migrations
   are needed from the verified 0.14.1 or 0.15.0 release.
5. Confirm both versions/health/readiness. These do not prove paid provider
   collection or verification-email delivery succeeds.
6. Publish the updated Replit frontend AND BFF after updating Bunny. Both the new
   UI and proxy allowlist are required for tag/method filters. No Framer change.
7. Restore scheduling only if it was intentionally enabled and paid daily
   monitoring is wanted. This release does not itself authorize a live test,
   recurring collection, backfill or paid re-analysis.

## Read-only acceptance

Open a workspace with saved valid monitoring answers. In Sources, switch between
the four evidence kinds, domain/URL grouping, and ownership/search filters.
Open a source and then its original answer. Previous/Next must stay within the
matched evidence. Source text and snippets are untrusted plain text, not HTML.
Change the date or workspace: an incompatible old source drawer must disappear.

Apply/reset custom dates, tag, method and prompt filters and reload the URL.
Save/load/delete a browser preset; verify a different workspace has its own list.
Data missing from older supplier captures remains unknown rather than fabricated.

## Boundaries / remaining parity work

Consumer Claude validation, comprehensive untracked-brand detection/ranking,
editorial/UGC/institutional source-type classification, supplier fan-out query
normalization/analytics, account-synced saved views, additional large-history
server pagination and GSC/GA4 traffic outcomes are not delivered by this patch.
Actual collection surfaces still need live validation under explicit approval.

Rollback: restore the previous two image tags and frontend/BFF build. There is
no database rollback because original data and schemas are unchanged.
