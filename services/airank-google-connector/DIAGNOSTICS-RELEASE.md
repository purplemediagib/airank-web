# Google connector diagnostic update (0.1.1)

Based on the user-supplied 0.1.0 source archive. This is the existing standalone
connector, not a replacement for app login or the monitoring worker.
No production service has been changed by adding this source.

## What this can and cannot fix

The original connector discarded structured Google errors and did not log handled
job failures. This update records a fixed safe category and logs only the service,
category, HTTP status, allowlisted Google status/reason, progress and attempt count.
No Google message, ErrorInfo metadata, property, email, token, prompt, or request
headers are logged. API-disabled is reported only when Google supplies
SERVICE_DISABLED; HTTP 403 alone does not prove its cause.

Old generic failures cannot be reconstructed. The observed GA4 0/90 failure
remains undiagnosed. This release enables diagnosis, not a claim of repair.

## Operator installation (approval required)

1. Back up the existing connector's persistent `/data` volume and retain its
   previous image reference. Keep the same encryption key, API key, OAuth client,
   return allowlist, volume mount and all existing settings. Do not paste secrets.
2. Build from this directory using the existing operator's image registry:

   ```powershell
   $Image = Read-Host "Existing registry/repository with a new diagnostic tag"
   docker build -t $Image .
   docker push $Image
   ```

   The Docker build runs the offline fixture suite. No Google calls are made.
3. After approval, update the **existing** Google connector Bunny container to
   that image. Do not create a new connection namespace or empty data volume.
   This update does not change the existing sync scheduler; an already-enabled
   scheduler resumes its normal work on startup.
4. Deploy the accompanying application API and frontend changes using the
   existing release process. API status passes only known diagnostic categories;
   older arbitrary error text remains redacted. No database migration is needed.
5. Check `/health` for 0.1.1 and `/ready` independently. Neither proves import
   success. Inspect Connections without selecting another property or disconnecting.
6. With the user's permission, use **Sync now** once for the failed GA4 job.
   It resumes the stored date cursor, retains already-imported reports and does
   not reset a completed GSC import. Existing transient-error retry limits remain.
7. If it fails, read the localized category and safe `google_import_failed`
   container event. Correct only what that evidence establishes. If it succeeds,
   verify imported dates and actual report rows, not just a Connected badge.

## Rollback

Restore the previous connector image on the same volume and settings. The error
category occupies the existing string field and needs no schema rollback.
Restore the previous application API/frontend releases if necessary.
Do not delete the volume, disconnect accounts or change property selection to
roll back: those actions can delete imported data.

## Scope

This does not activate paid AI collection, change Google scopes, prove Google
review readiness, or complete the broader Peec parity task. No real import was
run in this workspace. No claim is made about the cause of the historical failure.
