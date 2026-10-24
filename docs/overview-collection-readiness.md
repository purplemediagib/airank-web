# Overview repair and collection prerequisites

Inspected 23 October 2026. These are diagnostic findings, not a claim that
production provider settings have been fixed. No scans, emails, paid requests,
customer-data writes or Bunny configuration changes were made.

## Overview changes

The overview now displays brand series from the selected frozen cohort rather
than composition groups as competitor lines. The metric selector exposes
visibility, share of voice, sentiment, owned citations, recommendations,
tracked-brand win rate/position and explicit list rank. No new measurements or
competitors are inferred from today's settings.

When the default group has no eligible answers, the client requests the newest
completed/partial group with eligible answers and explains the selection.
Explicit group/run deep links are never overridden. Both the trend and source
impact chart respect run selection. Sparse measurements remain points and null
gaps; an absent metric displays an empty state rather than an empty set of axes.

Coverage and provider exclusions are shown separately from visibility. Missing
topic/tag metadata, frozen cohorts and failed/incomparable sentiment have
specific explanations. Recommendations retain the classified-answer denominator;
visibility score is the existing server's visibility-normalised 0–10 score.

## Verified production evidence

Read-only aggregate queries found:

- Four partial neutral monitoring runs across two projects, and one unavailable
  run. Each project has only two completed/partial runs.
- 48 successful answer records among 186 recorded outcomes.
- No frozen competitor cohort in those run snapshots.
- 32 frozen prompt entries, none with topics or tags.
- Sentiment jobs: 34 done, 10 `INVALID_SENTIMENT_OUTPUT`, four `SENTIMENT_TIMEOUT`.
- No intelligence jobs stored.
- Two enabled daily schedules at 04:00 Europe/Helsinki. Next scheduled slots
  were 24 October 2026; a running schedule is not proof of successful collection.

These aggregate counts describe the inspected database, not every user's
current filter selection. Public-checker scans are a separate data source.

## Collector blockers and safe next actions

| Stored failure | What is verified | Required action |
| --- | --- | --- |
| Claude `API_BUDGET_NOT_CONFIGURED` | The route did not pass the direct-model budget gate. This is not evidence of a missing Anthropic key. | Review worker `API_BUDGET_CONFIG_JSON` and the selected `CLAUDE_MODEL` / `CLAUDE_MAX_TOKENS` (legacy alias `CLAUDE_MAX_OUTPUT_TOKENS`). Supply a route-matching, explicitly priced budget. Do not raise spending or weaken the gate implicitly. |
| Claude `OUTPUT_TOKEN_LIMIT` | Earlier replies were truncated and correctly excluded. | After an approved monetary reservation is configured, review the output allowance. Preserve incomplete answers as excluded and do not retry them automatically. |
| AI Overviews `API_BUDGET_NOT_CONFIGURED` | Its model/transport budget route was missing or unavailable at claim time. | Review the `google_aio` entry in `API_BUDGET_CONFIG_JSON`, including the live SERP request price and actual configured route. `CONSUMER_MAX_DAILY_COST_USD` does not cover this separate direct/API budget. |
| Gemini `UNSUPPORTED_MARKET_OR_LANGUAGE` | The consumer collector's catalogue check did not match the requested context. | Validate supplier catalogue support for the exact market/language. Distinguish genuinely unsupported context from a catalogue/adapter defect using read-only supplier documentation/catalogues. Never silently switch to English, another country or model-API results. |
| OpenAI `COLLECTOR_LOCALE_CATALOG_UNAVAILABLE` | Catalogue preflight failed before submission; this code alone does not identify credentials versus supplier/transport/response failure. | Inspect sanitized worker transport diagnostics. Test only the read-only catalogue endpoints before any collection submission. |
| Gemini `COLLECTOR_DEADLINE_EXCEEDED` | Collection did not finish within its recorded run deadline. | Compare supplier completion times with `MONITORING_RUN_TIMEOUT_MS`, `MONITORING_PROVIDER_TIMEOUT_MS` and queue load. |
| `RUN_DEADLINE_EXCEEDED` | Tasks expired before execution. | Review run capacity, `MONITORING_CONCURRENCY`, the above deadlines and overlapping work. Raising concurrency or deadlines requires bounded-cost and load review, not a blind retry. |
| Grok `COLLECTOR_EXECUTION_FAILED` | Supplier execution failed; no more specific cause is established here. | Obtain sanitized supplier task diagnostics. Do not replay the paid task automatically. |
| Sentiment `INVALID_SENTIMENT_OUTPUT` / `SENTIMENT_TIMEOUT` | Validation/time failures, not neutral classifications. | Inspect the exact validator failure safely against immutable saved evidence and use synthetic fixtures to reproduce it. Review `SENTIMENT_MODEL` / `SENTIMENT_TIMEOUT_MS`. Retain exact-quote validation and avoid unsolicited paid backfill. |

The published source authority is `purplemediagib/airank.me`, API/worker 0.22.0
at revision `b34d7c39231dd1e85a37385627f72a47a8d3c09e`.
The inspected bundled analytics service/overview match that source, but this does
not make the entire bundled older backend a release candidate.

There is no callable Bunny management connection here to inspect/change worker
environment settings. Diagnostic database access is read-only. Do not copy
production secrets into source or request them in chat. No backend fix or
deployment is claimed by this frontend change.

## Restoring future comparison data

The backend already freezes the versioned reviewed competitor cohort and prompt
metadata when it queues a run. A missing cohort cannot be repaired by reading
the current competitor list into old measurements.

Review/accept competitor proposals and save topics/tags through the normal
workspace settings. Confirm they are included in the next authorized run's
snapshot. Preserve the earlier measurements unchanged.

## Acceptance and release

Offline tests exercise the actual frontend with synthetic measurements, explicit
nulls, distinct groups, frozen cohorts and exact-run drilldowns. Browser checks
use an isolated in-memory database and normal fixture authentication. Neither
proves production collector success.

Publish the reviewed frontend separately after approval. Backend configuration,
any collector fixes, and a small real Finnish acceptance run remain separate
operator actions requiring access and an explicit spend cap. No real run should
be claimed successful until persisted provider outcomes confirm it.
