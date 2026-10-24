# API 0.1.1 — staging scan limits

Build and push using build-and-push.ps1. Select vtcarrie/bunny-mcp-connector:airank-api-0.1.1 in the EXISTING API application, preserving port 3000 and its environment.

Both APP_ENV=staging and DISABLE_FREE_SCAN_LIMITS=true are required to bypass guest daily and domain weekly limits. Other environments always enforce existing limits. Set the switch false to restore them. Rate events remain recorded; old events still count after restoration. No database migration required. Worker provider budgets are separate. No authentication, ownership, input validation or CORS controls are changed.

The misleading provider fields in /v1/status are unchanged in this focused patch. No successful provider scan is claimed.
