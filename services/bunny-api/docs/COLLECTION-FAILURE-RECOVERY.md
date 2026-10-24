# Collection failure recovery — implementation in progress

This is not a parity completion or activation report. No live calls, import
retries, migrations, scheduling changes or production deployments were made.

## Claude

`CLAUDE_MAX_TOKENS` optionally sets the cumulative output allowance, from 256
through 16384 inclusive. The default remains 1400 so this patch does not silently
increase the existing spending envelope. An operator must approve a larger
allowance before changing it on the API and worker. The legacy
`CLAUDE_MAX_OUTPUT_TOKENS` alias is used only when `CLAUDE_MAX_TOKENS` is absent;
reservation planning and the adapter share this precedence.

There can be at most two requests per adapter invocation: the original request
and the existing single `pause_turn` continuation. The continuation uses only
the remaining allowance after valid reported output usage; unknown or invalid
usage never authorizes a continuation.
`max_tokens` is terminal, not a trigger for a retry. Failed continuations retain
the first response; empty truncated responses retain their failure category.
None of these incomplete responses qualify as valid visibility observations.

### Cost reservation update

Tracked API calls now have a separate atomic monetary ledger. See
`../COLLECTOR-RELEASE.md` and `RECONCILIATION-ROLLOUT.md` for the explicit price
configuration, full input-context/replay/output/tool allowance, frozen request
limits and additive migration. The old logical invocation ledger remains a call
cap, not money accounting. Only direct Claude <=1400 without monetary configuration
retains the labelled legacy call-cap-only path; increasing its budget requires a
committed monetary reservation. No production prices or allowance were changed.

## Google AI Overviews

New failures distinguish supplier task failure (`SERP_TASK_FAILED`, with a
machine-readable supplier status), missing parsed results (`SERP_RESULT_MISSING`)
and missing overview text (`AI_OVERVIEW_TEXT_MISSING`). Supplier messages are not
echoed. An actual parsed result with no overview remains `no_overview`, not zero
visibility.

These diagnostics do not establish the cause of the two historical
`PROVIDER_REQUEST_FAILED` records. Obtain redacted existing operator logs:
timestamp, provider, task/run correlation, HTTP status, supplier numeric status,
and safe failure code. Do not send prompts, authorization headers or tokens.
If those fields were discarded, the historical cause remains unknown; a new
paid diagnostic run requires explicit approval.

## Gemini

The supplied frozen run has no Gemini answers. This is absence from that run,
not evidence of a failed Gemini response. Compare its frozen provider/route list
with the selection and availability at creation. Do not use today's settings to
invent a historical explanation.

## GA4 and review evidence

The connector stores its import state independently. Request an existing,
redacted authenticated job diagnostic from its operator, with project ownership
checked: import status, completed dates, last successful import, HTTP status,
Google canonical error status/reason and request correlation. Never request or
include OAuth tokens or the connector API key in a chat or diagnostic artifact.

API enablement, property access, incompatible metrics/dimensions and quota are
hypotheses, not established causes. Preserve the prior successful report during
recovery. Only demonstrate genuine successfully imported data for Google review.
The broad Traffic, methodology, navigation and parity work remains unfinished.
