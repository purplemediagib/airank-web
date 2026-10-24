# AI Rank 0.14.1 — workspaces and email accounts

## Included

- No workspace/project-count limit for authenticated accounts. The New project
  button remains available when other projects exist.
- Each workspace keeps its own tracked prompts, identity, results and daily
  Helsinki schedule. Daily deduplication is scoped to owner + workspace + date.
- Creating another workspace no longer stops existing workspaces from tracking.
- Existing account-wide prompt allowances, provider-call limits, consumer
  collection budgets, email rate limits and ownership checks are unchanged.
- Email authentication defaults enabled in the API image, but still requires
  an email sender, credentials and the email-auth migration. Verification codes,
  hashed passwords, reset protections and Google sign-in remain intact.
- Read-only email readiness diagnostics contain booleans and missing variable
  NAMES only. They never expose credentials.

Creating a workspace does not itself call AI providers. Empty workspaces have no
prompts to measure. However, when the existing scheduler and monitoring flags
are enabled, **each active workspace with valid prompts becomes eligible for its
own daily run**, including workspaces previously blocked by the single-workspace
restriction. More tracked workspaces can therefore increase provider costs.

## PowerShell — upload both images

Extract the ZIP completely and open PowerShell in its extracted folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Load
if ($LASTEXITCODE -ne 0) { throw "Load failed. Stop." }
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Push
if ($LASTEXITCODE -ne 0) { throw "Push failed. Stop." }
```

The archive includes prebuilt Linux/amd64 images. No Bash or WSL is needed.
For a source-only package, use `-Action Build` instead of `-Action Load`.

## Bunny API container

Before updating either container, set `PROJECT_SCHEDULER_ENABLED=false` on both
to pause new daily submissions during rollout. Keep monitoring running until
already-paid collecting tasks have saved their results before restarting the
worker. Review the active workspaces before deliberately restoring any previously
enabled scheduler setting. Do not turn on paid collection merely to enable signup.

1. Preserve current settings and image tag. Set the image to:
   `vtcarrie/bunny-mcp-connector:airank-api-0.14.1`
2. Keep the default startup command. Remove any old custom migration command.
3. Add/update these NON-secret values:

   ```text
   EMAIL_AUTH_ENABLED=true
   AUTH_EMAIL_FROM=AI Rank <accounts@airank.me>
   AIRANK_RUN_APP_MIGRATIONS=true
   ```

   The airank.me domain was verified and sending enabled in the connected Resend
   account during preparation. The API's Resend key must have permission to send
   from this domain.
4. In Bunny's secret environment fields, ensure `RESEND_API_KEY` is set on the
   **API**, not only the worker. Keep the existing `RATE_LIMIT_SECRET`; it must
   be at least 24 characters. Do NOT rotate it just for this update and do not
   paste either secret into chat. Replit secrets do not automatically reach Bunny.
5. Update/restart the container. Confirm:
   `AI Rank app migrations 001–014 verified successfully.`
   This includes the existing additive email authentication migration. There is
   no new database migration or destructive conversion in this patch.
6. Find the startup `email_auth_configuration` log. It must show:

   ```json
   {"event":"email_auth_configuration","enabled":true,"available":true,"missing_variables":[],"rate_limit_secret_valid":true,"migration_ready":true}
   ```

   `available` confirms configuration, not actual email delivery. If false,
   resolve the named missing setting or migration; do not bypass verification.
7. Set `AIRANK_RUN_APP_MIGRATIONS=false` again and restart.
8. `/healthz` must show version `0.14.1`; `/readyz` must show `ready:true`.

Optional read-only command inside a running API container:

```text
node src/app/auth-config-check.mjs
```

It changes no data and sends no email.

## Bunny worker container

Set the image to:
`vtcarrie/bunny-mcp-connector:airank-worker-0.14.1`

Keep the default startup command and existing credentials, budgets and collection
flags; leave scheduling paused during rollout as described above.
Update/restart and confirm `/healthz` version `0.14.1` and `/readyz`.
Do not leave the old single-workspace worker running with the new API: it would
still refuse to schedule accounts with multiple workspaces.

No workspace-limit environment variable is required. Account prompt allowances
still require `TRACKED_PROMPT_LIMIT` (and optional account overrides) on both
services. This patch removes only workspace count restrictions.

## Frontend

Publish the updated Replit frontend/BFF. No Framer changes are required.
Then reload the sign-in page. The create-account form becomes available when
the live session response reports `emailLoginAvailable:true`.

Do not use a fake availability flag in the frontend to conceal a disabled API.

## Acceptance check

1. Select EN or FI, register with name, email and a 12–128 character password.
2. Receive the six-digit code, verify it, and confirm the selected UI language
   remains selected in the dashboard. An account is created only after verification.
3. Sign out and sign back in with the verified email/password.
4. Existing Google accounts must continue using Google; matching email addresses
   are not automatically linked to password credentials.
5. Create two workspaces from the switcher. Switch between them, reload, and
   confirm each retains its own business details and prompt list.
6. Creating workspaces must not itself call AI providers. With intentionally
   enabled daily tracking and valid prompts, each workspace can have at most one
   scheduled run per Helsinki date. Pause/resume affects only that workspace.

The package was checked with isolated backend fixtures. No real verification
email, production account creation, migration or paid provider collection was
performed while preparing it.
