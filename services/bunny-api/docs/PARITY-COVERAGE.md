# Collection and analytics coverage

Implementation audit: 21 October 2026. Not a live activation certificate.
Vendor claims below refer to the documented comparison checked on 16 October,
not a new live vendor audit. Reference:
https://docs.peec.ai/understanding-your-performance ,
https://docs.peec.ai/your-overview ,
https://docs.peec.ai/metrics/brand-metrics/position ,
https://docs.peec.ai/metrics/brand-metrics/sentiment .

## Supported target and observations

Core target: ChatGPT, Gemini, Claude, Grok, Perplexity and Google AI Overviews.
Consumer parity is surface-specific, not inferred from an API model name.
Copilot is deferred. No new pilot or recurring collector activation is authorized
by this document.

| Provider/surface | Existing collection | Locale and search | Source/fanout limits and validation |
|---|---|---|---|
| ChatGPT consumer | DataForSEO LLM Scraper, separately selectable from OpenAI API | Country/language catalogue preflight; platform controls search | Prior approved pilot evidence in COLLECTOR-EVALUATION.md. Source references, search-result elements and passage associations are not an exhaustive retrieval trace. Query fanout not established. |
| Gemini consumer | DataForSEO LLM Scraper, separately selectable from model API | Country-scoped catalogue required; platform controls search | Prior pilot exists. Catalogue acceptance is not proof of all locale combinations. Missing background query access remains unavailable, not zero. |
| OpenAI model API | Direct Responses API with required web search | Prompt context describes locale; not a geographically verified browser session | Citation annotations and search-call count; not consumer ChatGPT parity or a complete retrieval trace. |
| Gemini model API | Configured OpenRouter model, no fallback | Requested search engine and prompt context | Completion budget includes reasoning; truncated answers excluded. Returned citations do not establish full source coverage or consumer parity. |
| Claude model API | Direct Anthropic web-search tool | Context instruction; max three search uses per request, at most one pause-turn continuation | Bounded configurable output; incomplete evidence retained. No validated new-prompt consumer collector. Shared-chat extraction is not a substitute. |
| Grok consumer | Scrapeless asynchronous collector | Country input and auto mode; geographic routing not independently established | Prior US/GI successes; FI execution failure is not proof of unsupported country. Footnotes, web/X result entries and inline occurrences are distinct. |
| Perplexity consumer | Scrapeless asynchronous collector | Country input; prior US/FI/GI samples succeeded | Sources with zero citations exist. Related questions are not background fanout queries. Prior successful Finnish sample does not validate every locale. |
| Grok / Perplexity APIs | Separate direct API routes | Context/request-specific controls | Never silently substitute for a selected consumer route. Consumer pilot results do not validate these API surfaces. |
| Google AI Overviews | DataForSEO Google desktop SERP with asynchronous overview loading | Validated catalogue selection, independent country/language | Missing overview is its own state; source extraction is not exhaustive retrieval telemetry. Two historical generic failures remain undiagnosed. |

Read COLLECTOR-EVALUATION.md for actual pilot dates, counts, evidence limitations
and costs. Old planned-pilot prose in that document is superseded by its recorded
outcome sections, not permission to repeat those calls.

## Existing / partial / unresolved

| Requirement | Current assessment | Remaining acceptance |
|---|---|---|
| Canonical prompts, daily Helsinki slots | Existing | Preserve unlimited workspaces, account limits, idempotency and no surprise backfills |
| Original answers, frozen prompt/identity cohorts | Existing | Keep immutable; never backfill unknown historical fields with fabricated zeroes |
| Consumer occurrence/source provenance | Partial | Consumer evidence stays unchanged. Additive API occurrence annotations preserve supplied spans/repetition, not an exhaustive retrieval trace |
| Visibility and tracked-cohort SOV | Explicit future API method implemented, offline fixtures only | New API snapshots opt into complete-answer eligibility. Historical citation-required observations and consumer cohorts remain separate and unchanged |
| Mention-order position and win rate | Partial | Existing literal tracked-cohort scope is not Peec's all-detected-brand universe |
| Explicit-list recommendation rank | Existing separately versioned | Preserve separate name and denominator |
| Per-brand sentiment | Existing evidence-backed pipeline | Unknown and failed analysis remain distinct; no paid work on viewing |
| Source/citation/link frequency | Existing with limitations | Keep citation multiplicity; do not call supplier search-result entries verified retrievals |
| Topic/tag matrix and filters | Multi-tag AND/OR and frozen market/language filters implemented | Reviewed intent and branded-history reconciliation remain outside this increment |
| Source categories and ownership | Existing classifiers | Review provenance/confidence and full category coverage; never infer absent source URLs |
| Overview and source/answer drilldowns | Authenticated fixture journey verified | Overview/Results/Sources retain selected population; broader large-data latency baselines remain unverified |
| Collection failure status | Conservative API reservations implemented | Exact tariffs and provider ceilings require operator validation; old AIO failure causes and Gemini selection need frozen-run evidence |
| Google connection/import diagnostics | Implemented diagnostic patch | Genuine failed-import diagnosis and successful GA4 recovery remain unverified |
| Google traffic destination | Implemented, offline tests pass | Separate from citation analytics; genuine authenticated imported-data demonstration remains unverified |
| Responsive navigation, controls, saved filters | Changed authenticated desktop/mobile, keyboard and EN/FI paths verified with fixtures | Not an exhaustive audit of every archived, long-label and zoom state |
| Google approval evidence | Not ready | Real consent, exact live scopes and successful imported data required; no fabricated demonstration |

## Metric rules to preserve

### Versioned API collection reconciliation (offline implementation)

New monitoring snapshots explicitly freeze
`collectionMethod: complete-answer-visibility-v2`; API routes freeze
`measurement_surface: model_api`. API adapters continue returning their original
`no_grounding` status when a completed answer lacks citations. Only monitoring
reconciliation against an opted-in snapshot converts that status to `success`,
and only with a nonempty answer and an `api-occurrence-evidence-v1` observation
whose `complete` flag is true. Failed, refused, unfinished, locally truncated,
missing-completeness and unknown observation-contract versions stay excluded.
No automatic retry, new prompt cohort, cap increase, historical rewrite or paid
re-analysis is part of this change.

The new metric version is `neutral-complete-answer-weighted-v3`. Legacy API
snapshots retain `neutral-valid-weighted-v2-citation-coverage` and the
citation-required denominator; absent historical metadata is not upgraded.
Consumer collection objects and originals are not transformed, even in a new
mixed API/consumer run. Analytics partitions such a run into independently
selectable composition groups before computing totals, provider summaries,
source frequencies, comparisons or report snapshots. A run can therefore have
multiple history rows with the same run ID and distinct group/surface.
`group` selects one universe, including when `runId` is supplied. Reports retain
the selected group, filters and original frozen run snapshots.

The additive API `observation` object stores ordered `citationOccurrences`
(URL, provider provenance, optional title, block index and original start/end
offsets). Repeated annotations are not collapsed. Offsets are provider-local
to the indicated text block/segment, not invented global answer spans. API
source analytics reports annotation occurrences separately from answer counts;
deduplicated citations without occurrence telemetry never become an invented
count. Perplexity search-result sources and AIO supplier references remain
source evidence, not invented inline spans. `retrievalObservation` and
`fanoutObservation` remain `unavailable`: search tool counts, related questions,
source lists and grounding chunks do not establish exhaustive retrieval or
background fanout.

Citation-observable complete uncited answers contribute an observed zero to
owned-citation coverage. If an adapter cannot observe citations, that denominator
stays unavailable rather than guessed. Literal answer links remain a separate
source kind. Existing consumer occurrence maxima keep their original semantics.
Different frozen cohorts, collection methods, surfaces, identities, context,
routes and models are not pooled for cohort metrics or prior-period deltas.

This remains **tracked-cohort, partial coverage**, not complete Peec parity or
all-detected-brand SOV/position/win-rate. Entity-discovery analysis, when enabled,
is a separately labelled analysed-answer subset; it does not expand this metric
universe. Validation here uses fixture responses and local SQLite only; there is
no new live supplier validation or production activation.

- Visibility: mentioned valid answers / valid answers. Failed or truncated answers
  are not zero-visibility answers. Legacy neutral-only eligibility remains labelled.
- Tracked-cohort SOV: target mentions / all frozen tracked-brand answer mentions.
  It is not share among all brands on the internet.
- Mention-order mean: only resolved ranked observations; inspect exact original
  spans and denominator. Win rate must name its eligible population.
- Citation coverage: own-source answers / citation-observable valid answers.
  Citation frequency, literal link frequency and supplier result frequency are
  different measures; use their own observable populations.
- Daily/weekly/monthly and prior-period metrics must aggregate raw numerators and
  denominators. Do not average percentages or let table pagination change totals.
- Missing capability, not captured, captured-empty, pending and failed are not
  interchangeable. A source list cannot establish background search queries.

## Open gates

No production migration, paid re-analysis, new live collector pilot, recurring
consumer activation or full parity declaration without the relevant approvals.
GA4 missing imported dates do not prove that historical reporting is unsupported.
Continue existing-data UI work independently of that unresolved diagnosis.
