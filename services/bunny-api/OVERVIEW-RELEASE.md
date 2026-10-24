# AI Rank 0.13.0 Overview release

This source release includes the daily scheduler from 0.12.0 and the new
read-only Overview aggregates. No additional migration beyond app-013 is
needed if 0.12.0 was fully deployed. Existing keys and caps remain unchanged.
No viewing/filtering action starts paid measurements or sentiment backfills.

Extract the source ZIP. Open PowerShell in that folder:

```powershell
docker build --platform linux/amd64 --provenance=false -f Dockerfile -t vtcarrie/bunny-mcp-connector:airank-api-0.13.0 .
if ($LASTEXITCODE -ne 0) { throw "API build failed. Stop." }
docker build --platform linux/amd64 --provenance=false -f Dockerfile.worker -t vtcarrie/bunny-mcp-connector:airank-worker-0.13.0 .
if ($LASTEXITCODE -ne 0) { throw "Worker build failed. Stop." }
docker login
if ($LASTEXITCODE -ne 0) { throw "Login failed. Stop." }
docker push vtcarrie/bunny-mcp-connector:airank-api-0.13.0
if ($LASTEXITCODE -ne 0) { throw "API push failed. Stop." }
docker push vtcarrie/bunny-mcp-connector:airank-worker-0.13.0
if ($LASTEXITCODE -ne 0) { throw "Worker push failed. Stop." }
```

Update BOTH existing Bunny containers to those tags, retain their default
commands, then publish the updated Replit frontend/BFF. No Framer changes.
If upgrading from before 0.12.0, first disable the worker scheduler, apply
app-013 through the API release runner (`AIRANK_RUN_APP_MIGRATIONS=true`),
confirm migrations 001–013, turn that flag off, then update/restart the worker.
The daily scheduler requires `MONITORING_ENABLED=true`,
`PROJECT_SCHEDULER_ENABLED=true` and a deliberate `TRACKED_PROMPT_LIMIT`
on both services; keep existing provider/budget/sentiment configuration.
Enabling recurring measurements incurs provider charges.

Verify health versions 0.13.0 and sign in normally: date/provider/topic/group
filters, counts, answer dialog and stored citations should agree. Earlier
backend versions show a specific upgrade state for missing Overview summaries.
No-data is legitimate until the daily scheduler produces eligible answers;
there are no sample numbers or generated historical trends in production.

Comparison uses the preceding equal-length UTC period and identical frozen
composition only. Domain counts are per eligible answer/domain; categories
overlap and are not shares of a single whole. Topic/tag cells use saved
metadata. Original answer text stays immutable. Opportunities are project-wide
and explicitly labelled as not scoped by Overview filters.

For rollback preserve image tags/settings before upgrading. Disable scheduler
and monitoring on the worker before reverting; never delete evidence or
migration records. Keep scheduling disabled with pre-0.12 workers. Roll back
frontend separately if required.
