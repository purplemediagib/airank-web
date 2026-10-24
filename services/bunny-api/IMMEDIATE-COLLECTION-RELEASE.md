# AI Rank 0.19.0 — immediate tracked collection

New active prompts queue collection automatically, including prompts accepted
during onboarding. An account/project without prompts does not submit requests.
Meaningful text/context changes queue new evidence; tag/topic-only edits do not.
The existing daily Helsinki schedule remains. Incremental runs do not replace
daily full-set runs. A full initial run counts toward that day's measurement.

Existing workspaces are NOT automatically backfilled on deployment. Use
Settings → Tracking → Collect new prompts for Elisa after publishing the web
app. This collects previously unsubmitted prompts, not retries of old paid work.
Saved/failed/uncertain attempts are never silently repurchased.

## Install

1. Preserve current images/settings and back up the database. Pause daily
   scheduling on API and worker; allow in-flight collections to finish.
2. In PowerShell in this extracted directory:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Load
   if ($LASTEXITCODE -ne 0) { throw "Load failed. Stop." }
   powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Push
   if ($LASTEXITCODE -ne 0) { throw "Push failed. Stop." }
   ```

3. Update API image to vtcarrie/bunny-mcp-connector:airank-api-0.19.0.
   Temporarily set AIRANK_RUN_APP_MIGRATIONS=true on API and use its default
   startup command. Confirm "AI Rank app migrations 001–016 verified successfully."
   Set AIRANK_RUN_APP_MIGRATIONS=false and restart API.
4. Update worker image to vtcarrie/bunny-mcp-connector:airank-worker-0.19.0.
5. Preserve all existing credentials, budgets and prompt allowances.
   MONITORING_ENABLED=true is required on API/worker. Keep consumer collection
   enabled for consumer routes. Restore the existing PROJECT_SCHEDULER_ENABLED
   values. Immediate collection does not depend on daily scheduling being on;
   MONITORING_ENABLED=false is the global stop for immediate monitoring.
6. Publish the updated Replit frontend/BFF. No Framer or Google Connector changes.
7. In Elisa, choose Collect new prompts once. Check Results for the run.

No additional API keys, containers or budget increases are required. New prompt
mutations authorize paid collection under the existing limits. Automatic
requests survive restart; workers check ownership, context, archived state,
prompt allowance and paid budgets. Missing configuration is shown as blocked.

The agent's production DB access was read-only; it did NOT queue Elisa's run.
Updating local code does not activate this feature on Bunny.
