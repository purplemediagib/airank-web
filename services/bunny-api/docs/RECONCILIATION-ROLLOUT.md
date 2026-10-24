# Reconciliation, cost reservations and filter release

This is an operator-controlled release. Local fixture verification is not live
activation, real collector validation, a successful Google import or Google
review evidence. No paid calls, production migrations or deployments were made.

## Before enabling the new worker

1. Retain the current API/worker/frontend image or release references and take a
   database backup using the existing operator process. Pause the worker during
   the upgrade so old/new workers cannot claim the same queue concurrently.
2. Read the API monetary reservation section of `../COLLECTOR-RELEASE.md`.
   Configure `API_BUDGET_CONFIG_JSON` with verified route/model-specific rates,
   full input-context ceilings, input payload limits and a daily USD ceiling.
   Configure `CLAUDE_MAX_TOKENS` only after approving its reservation cost.
   Do not copy test prices into production. No credential values belong in this
   guide, exported source, browser code or logs.
3. **Without the budget configuration, non-Claude tracked API routes will block
   before submission.** Claude <=1400 retains explicitly labelled legacy call
   limits, not a dollar guarantee. Direct Perplexity Agent is blocked as an
   unbounded route; do not silently replace it with a consumer route. Consumer
   collection flags, approvals and its separate monetary ledger are unchanged.
4. Apply the additive `app-017-api-reservations` migration with the provided
   `migrate:api-budget` package command, or the normal release runner. It creates
   a new reservation ledger; it does not rewrite answers or historical metrics.
   Run this only against the intended production database after approval.
5. Build and deploy API and worker from the same source revision, using the
   existing PowerShell/Bunny workflow and distinct immutable image tags. Update
   the frontend together: generated query types and new observation/filter UI
   depend on this API release. Preserve existing namespaces, keys and volumes.
6. Resume only the already-authorized scheduler configuration. New observations
   use the new method; existing frozen runs keep their historical eligibility.
   Do not initiate a backfill, rerun failures or activate consumer collection as
   an incidental smoke test.

## Verification

- Check API and worker health, then inspect actual run/task/evidence and
  reservation records. Health alone does not establish successful collection.
- Confirm `tags` JSON-array, `tagMode`, market and language survive navigation,
  saved filters, source drilldowns and reports. Table pagination must not change
  population totals.
- Confirm an API and consumer observation in the same run occupy different
  comparison groups. Verify an uncited complete new API answer is eligible,
  historical uncited failures remain excluded, and truncated new answers remain
  excluded. Original prompt/answer text must not change.
- On the first already-approved measurement, compare reserved amounts to the
  frozen limits. Reservations are conservative internal accounting, not actual
  invoice costs. Never release an uncertain charge or retry because the result
  is missing.
- Google Traffic must display actual cached import availability. Missing days
  remain missing even when the Google account is authorized.

## Backout

Pause the worker; restore the previous matching API/worker/frontend releases.
Keep the new ledger and all evidence; do not drop tables or rewrite snapshots.
**Do not resume an old worker against newly queued or ambiguous API tasks
without operator review:** it may not enforce the new reservations or understand
the new observation method. Old frontends may ignore additive evidence fields;
they are not a valid verification surface for new-method measurements.

## Offline verification

`artifacts/airank/test/scripts/README.md` describes a synthetic isolated browser
environment using the actual password/session backend and frontend. It blocks
outbound network access and has no schedulable tasks. Its data is explicitly not
real provider output or Google review evidence. It is suitable for testing
filters, access control, displays and navigation only.

## Remaining external gates

The GA4 historical import failure is not diagnosed by an empty report. Existing
diagnostic connector logs and a genuinely authorized recovery are still needed.
New live consumer pilots, supplier pricing confirmation, recurring activation,
production migrations and successful daily-run validation require their own
operator approval. This release does not establish exact Peec numerical parity
or validated untracked-brand detection across all languages.
