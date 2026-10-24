# AI Rank 0.14.0 — test-ready consumer collection

## What this release does

Uses each user's existing tracked prompt set. The daily 04:00 Helsinki schedule
(staggered during the hour, DST-aware) is unchanged. No new quick-check set.

- ChatGPT and Gemini: DataForSEO asynchronous consumer-web collection.
- Grok and Perplexity: Scrapeless asynchronous consumer-web collection.
- Claude: existing model API only; **not** claimed as consumer-web collection.
- Google AI Overviews: existing DataForSEO SERP collector, kept separate.
- Copilot remains deferred.

Paid POST submissions are never replayed after uncertainty. Remote task IDs and
raw result receipts are saved in the existing Bunny database. A restart resumes
GET retrieval, not a new paid prompt. Original answers, source entries, retrievals,
reference occurrences and available fanouts are preserved. Views do not buy data.
API and consumer results are separated by frozen route/methodology composition.

**Limitations:** Grok had one execution failure in three pilot samples. Country
acceptance is not independent geographic verification; no country is silently
substituted. DataForSEO's catalog does not cover Gibraltar. Its ChatGPT/Gemini
rows will explicitly show unsupported context there. Scrapeless returned GI
answers, but did not echo a verifiable collection location. Supplier source
entries are not all explicit citations. Citation coverage can be unavailable.
This is not a claim that every Peec metric or supplier reliability is at parity.

## 1. Docker Desktop / PowerShell

Extract the ZIP fully. Open PowerShell in the extracted folder containing this
file. For the images package, copy/paste:

```powershell
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Load
if ($LASTEXITCODE -ne 0) { throw "Load failed. Stop." }
powershell -ExecutionPolicy Bypass -File .\Release-Collectors.ps1 -Action Push
if ($LASTEXITCODE -ne 0) { throw "Push failed. Stop." }
```

For a source-only ZIP, replace `-Action Load` with `-Action Build`.
Both image builds execute the complete backend test suite. The script verifies
the version and Linux/amd64 platform without the nested template quoting that
previously failed in PowerShell. Do not change Bunny tags if either command fails.

## 2. Bunny — safe rollout, no paid activation yet

Preserve the current API/worker image tags and environment settings for rollback.
Do **not** replace the existing environment with the example file.

1. Set `PROJECT_SCHEDULER_ENABLED=false` on BOTH services. Keep the current worker
   running until any in-flight paid results are saved. Do not stop monitoring
   while remote results still need retrieval; Scrapeless expires them quickly.
2. Update the API to `vtcarrie/bunny-mcp-connector:airank-api-0.14.0`.
   Keep the image default startup command, not an old custom migration command.
3. Set `AIRANK_RUN_APP_MIGRATIONS=true` on the API, restart, and confirm:
   `AI Rank app migrations 001–014 verified successfully.`
   This includes the additive `app-014-consumer-collectors` migration and earlier
   migrations. It does not submit prompts or rewrite historical answers.
4. Set `AIRANK_RUN_APP_MIGRATIONS=false` again, then restart the API.
5. Update the worker to `vtcarrie/bunny-mcp-connector:airank-worker-0.14.0`.
   Keep its default startup command and existing port.
6. On BOTH services, add/align these NON-secret values:

   ```text
   ENABLED_PROVIDERS=openai,claude,gemini,grok,perplexity,google_aio
   CONSUMER_COLLECTION_PROVIDERS=openai,gemini,grok,perplexity
   CONSUMER_COLLECTION_ENABLED=false
   PROJECT_SCHEDULER_ENABLED=false
   CONSUMER_MAX_DAILY_COST_USD=1
   CONSUMER_UNIT_COSTS_JSON={"openai":0.01,"gemini":0.01,"grok":0.01,"perplexity":0.01}
   ```

   **For the existing Gibraltar project:** use
   `CONSUMER_COLLECTION_PROVIDERS=grok,perplexity` on BOTH services instead.
   This retains the explicitly labelled OpenAI/Gemini API routes, because
   DataForSEO does not currently list Gibraltar. Use the four-provider value
   above only for a deliberately chosen supported-context test. This is an
   operator-selected collection profile, never an automatic runtime fallback.

   Preserve your deliberate `TRACKED_PROMPT_LIMIT`, provider-call caps and
   sentiment budget/settings. Do not invent unlimited prompt access. With the
   example reservation values, at most 100 new consumer submissions fit the
   rolling 24-hour $1 reservation budget. This is a conservative internal
   estimate, **not** a supplier-side guaranteed spending limit. Check supplier
   prices and use any available account-level spending caps separately. Other
   model-API, AI Overview and sentiment charges retain their separate controls.

7. The WORKER needs these securely configured credentials:
   `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `SCRAPELESS_API_TOKEN`.
   They are not inherited from Replit. Keep existing `ANTHROPIC_API_KEY` for
   Claude, `OPENAI_API_KEY` where existing features need it, and other existing
   provider/database/storage secrets. No secrets are included in this ZIP.
   API credential-presence badges do not validate worker credentials.
8. Restart the worker after environment changes. Both `/healthz` responses must
   report `0.14.0`; `/readyz` must be healthy. Existing credential/configuration
   diagnostics should show the consumer routes, enabled flag, budget presence
   and missing variable NAMES only—never values.
9. Publish the updated Replit frontend/BFF separately. No Framer changes are
   required. Backend source changes here do not update Bunny by themselves.

## 3. Acceptance test and activation — separate operator approval

The delivered images have collection and scheduling disabled by default.
Do not enable them until deployment/migrations/settings have been checked and
the operator authorizes recurring provider spend.

For an approved small test, retain the user's single existing prompt set and
choose its platforms in Settings. Use a supported context for DataForSEO
(for example FI/en or FI/fi); do not change a real user's country silently.

When approved: set `MONITORING_ENABLED=true`,
`CONSUMER_COLLECTION_ENABLED=true`, and `PROJECT_SCHEDULER_ENABLED=true` on both
services, then restart. This **enables recurring paid collection**. The user
schedule must also be enabled and the prompt allowance configured. First setup
waits for its next daily slot; no backfill or separate quick check is generated.

After the next slot, verify one run per user/Helsinki date:

- Results move queued → running → saved or an explicit failure/skipped state.
- A successful saved answer opens from Results and the Overview drawer.
- Consumer/API provenance is distinct; original text, source entries, citation
  references and retrieved pages are available in the evidence panel.
- Visibility graphs count valid answers, including valid answers without
  citations. Failure and missing citation evidence are not converted into zero.
- Unsupported locales, exhausted budget and provider failures are visible.
- Refreshing/filtering/opening an answer does not submit another paid request.
- A worker restart while collecting resumes the known remote task rather than
  posting the prompt again. Do this only in an approved isolated test.

The development checks use isolated fixtures; they do not activate or establish
readiness of your deployed Bunny containers. No additional live paid test was
run in preparing this release.

## Pause and rollback

Pause new schedules first. Set `CONSUMER_COLLECTION_ENABLED=false` to block new
consumer submissions, but keep monitoring on until collecting tasks finish;
already-paid GET retrieval is still allowed. Preserve the database and evidence.
Do not run an old worker against queued consumer tasks. Drain or explicitly
cancel new tasks before reverting BOTH backend images and the frontend. Never
delete migration records, saved answers or budget reservations to force a retry.

## Additive tracked model-API monetary gate (operator rollout required)

This source change adds migration `app-017-api-reservations`; it does **not**
deploy containers, change production environment variables, or make a live
provider request. The earlier numbered release instructions above are historical:
the current opt-in app migration runner now includes migrations through 017.
Apply the existing baseline/app/monitoring migrations first. Then either use
the existing operator-controlled `AIRANK_RUN_APP_MIGRATIONS=true` runner or run
`pnpm --dir services/bunny-api migrate:api-budget` in the backend source checkout
against the intended database. The migration is additive, transactional,
repeatable and checksum checked. Do not delete or modify its ledger on rollback.

### Explicit worker configuration — no bundled prices

The operator must supply `API_BUDGET_CONFIG_JSON` on the monitoring worker with:

- `dailyUsd`: positive rolling-24-hour model-API reservation budget.
- `routes`: an object keyed by each configured API provider ID. Each entry must
  match the frozen route's `transport` and exact `model`; OpenRouter also requires
  matching `searchEngine` (`native` or `exa`).
- For token-priced routes: `contextWindowTokens`, `maxInputBytes`,
  `inputUsdPerMillion`, `outputUsdPerMillion`, and `searchUsdPerCall`.
  Claude also requires `maxReplayBytes`.
- For `google_aio`/`dataforseo`: `maxInputBytes` and `requestUsd`, an upper bound
  for the complete single live SERP request including its AI Overview options.

All prices must be explicit finite nonnegative JSON numbers; a reservation must
be positive. No provider price, exchange rate, or free-search allowance is
invented or inferred. Explicit zero is allowed only when an operator has verified
that component is unbilled/included. `contextWindowTokens` must conservatively
cover the **entire provider-billable input/context ceiling**, including generated
search context and replay, for that exact model/transport. It is not an estimate
of the short question. `searchUsdPerCall` must cover all additional per-search
charges, including special fixed search-input-token tariffs not already covered
by that context allowance, and any native/Exa supplier surcharges. Use the worst
applicable tariff, including any billable reasoning in the output allowance.
This requires operator verification of actual account/model/tool pricing and
provider limit semantics; local fixtures cannot establish supplier correctness.

`maxInputBytes` is a positive integer local UTF-8 payload ceiling, no larger
than the declared context-token ceiling; it is not a tokenizer approximation.
Claude `maxReplayBytes` limits serialized replay messages before continuation.
If continuation would exceed it, the original response is retained as
`incomplete` / `CONTINUATION_INPUT_LIMIT`; no second request is sent. Context
overflow rejected by the supplier remains a failed, fully reserved attempt.

### Enforcement and compatibility

The engine claims a task and inserts its monetary reservation in **one SQLite
write transaction before dispatch**. Unique task IDs plus the existing claim
state machine prevent duplicate dispatch; a duplicate reservation is not
permission to submit again. The rolling sum uses integer nano-USD and rounds
ceilings upward. `mon_budget` remains only a logical-call counter; it is never
reported as dollars. Existing daily/per-run call caps still apply independently.

Token-priced routes reserve full-context input + bounded completion output +
three searches **per request**. Claude reserves **two** such requests (initial
request and at most one `pause_turn` continuation), thus two input/context and
output allowances and up to six tool uses. OpenAI and Grok send a hard
`max_tool_calls=3`; OpenRouter retains its existing three-tool/search bounds,
disabled fallback, and frozen output allowance. The saved configuration and
prices are immutable for that reservation. Environment changes cannot enlarge
its requests or recalculate its reserved amount.

All configured tracked API routes pass this gate. Missing prices/budget,
invalid configuration, wrong route/model/search engine, missing migration or
unsafe limits block before any paid submission. Exhausted monetary capacity
records `budget_blocked` / `API_BUDGET_EXHAUSTED`. **Perplexity direct Agent
currently fails closed with `API_BUDGET_UNBOUNDED_ROUTE`**, because this adapter
has no verified hard tool-invocation ceiling. It is not silently switched to
another route. Perplexity consumer collection remains separate and unchanged.

Only direct Claude at **1400 tokens or below**, with no monetary configuration
present, retains the explicit `legacy_call_cap_only` compatibility mode. This
mode has **no claimed dollar ceiling**. Higher Claude budgets require a committed
monetary reservation; invalid explicit config cannot fall back to legacy mode.
Evidence labels the mode and, when present, its reserved nano-USD amount.
Non-Claude tracked API routes require explicit monetary configuration.

Reservations are **not refunded or reduced** after success, early completion,
authentication errors, truncation, failed continuation, timeouts, interrupted
workers, storage failures or otherwise ambiguous outcomes. Recovery saves
failure/evidence rather than replaying the paid request. Amounts cease to count
against the rolling window after 24 hours but remain in the ledger permanently.
This is an internal conservative reservation ledger, not an account-level
supplier spending cap or proof of actual reconciled billing. Public/quick
checks, sentiment and other non-monitoring features retain their separate
controls; an increased Claude allowance there is rejected without a reservation.
Consumer monetary prices and collector reservations are unchanged and separate.
