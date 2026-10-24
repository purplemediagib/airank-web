# AI Rank measurement methodology

## Batch 06 derived monitoring metrics

This section supersedes the earlier “no aggregate score” scope note. Metric version `neutral-valid-weighted-v1` and extraction version `literal-fi-en-recommendations-v1` are explicit in the analytics response. Immutable evidence remains unchanged; these are version-labelled derived interpretations, not silently rewritten quick-check fields.

- Eligibility: neutral-run, nonempty `success` answers. Diagnostic, failed, ungrounded, unconfigured, disabled, budget-blocked, deadline and interrupted/unknown outcomes do not represent brand absence.
- Visibility = mentioning eligible answers / eligible answers; score = fraction × 10 rounded to one decimal. Combined results sum answer counts, not provider percentages.
- Owned citations = eligible answers citing any confirmed owned domain or its subdomains / eligible answers. Duplicate URLs and repeated mentions count once per answer. Citation-only answers may have positive citation coverage and zero visibility.
- Recommendation rate = explicitly recommending answers / answers with available positive or negative classification. Show classified/eligible coverage separately. Neutral mentions and ambiguous/contradictory text remain unknown, not measured false. Conservative direct FI/EN literal attribution requires a verbatim evidence span; no extra model or inferred Finnish morphology/coreference.
- Position requires an explicitly labelled recommendation list with at least two sequential unique numeric ranks, one tracked-brand entry and no detected tie/warning/negation ambiguity. Unordered lists and unexplained numbers are unavailable.
- Cohort share = own brand-response mentions / all brand-response mentions in the frozen confirmed cohort. Existing snapshots without a cohort return null. Competitor administration belongs to Batch 07.
- Each response exposes the actual counts, expected sample, missing coverage and null states. A valid sample without mentions is zero; no valid sample is null. Quick-check metrics stay on their existing report route, with recommendations unavailable.

Composition hashes include snapshotted identity/version, prompt text/versions, configured routes, actual observed models, cohort, market/language, source methodology and metric/extraction versions. Different compositions are not combined. History shows individual runs and explicit non-comparability; chart points never interpolate missing dates or drop same-day observations. Aggregates cover all matching stored evidence, not a displayed table page.

The deterministic extractor is deliberately limited, not a claim of semantic certainty or general language understanding. Rule changes require a new extraction version and evaluation cases. These are API observations, not verified consumer website rankings or causal improvement estimates.

Batch 05 tracked monitoring uses `tracked-fi-evidence-v1`, separately from the fixed quick-check method. Each explicit run freezes identity, prompt versions, provider routes/models, kind and FI language. Neutral prompts reject the owned brand/aliases/domains; branded diagnostics cannot enter neutral runs. Suggestions are labelled fixed Finnish category templates, not research. A valid observation requires provider success and non-empty original answer; provider grounding rules remain unchanged. Completion count includes terminal failures/skips while valid count does not. No aggregate score, market share or comparability claim is introduced. Immutable evidence is never overwritten by edit/archive/retry.

Batch 04 implementation: quick-check preview and execution use the existing confirmed-fi-mentions-v2 functions. Exact previewed question rows are saved atomically with the job, before any worker claim; provider list, identity, category and prompt count are snapshotted. Confirmation fingerprint includes the project identity version, canonical profile, exact questions, methodology and providers. Changing these invalidates submission. UI uses authoritative server score.value/state/band and real observation counts, distinguishes null from zero, preserves Finnish questions under English UI, and never substitutes translated answers. Scope remains one quick-check sample, not aggregate market share or recommendation inference.

Batch 01 contract, 2026-10-12. Confirmed checker verified in uploaded source; monitoring below is planned, not implemented.

## Confirmed checker: confirmed-fi-mentions-v2

Eligibility is provider_status success; adapters require complete answers and structured grounding/citations. This is a technical evidence gate, not proof of relevance or truth. Mention matching is literal, case-insensitive, Unicode-normalized whole-phrase matching against confirmed name/aliases. It does not infer all Finnish inflections.

Use returned score.value: 10 × answers mentioning brand / valid answers, rounded to one decimal. Each answer counts at most once. No successful eligible answers means null, not zero; a completed eligible sample with no mentions is zero. Pending/legacy are not fabricated numeric results. Terminal failed runs may retain usable partial evidence.

Owned-domain citations are separate. Existing recommendation defaults in storage do not mean a measured negative: report recommended is null and recommendations_included is false. Original text remains in original language. Quick-check report text may be truncated; private raw evidence availability must be explicit.

Band thresholds: <5 low, 5–<6 limited, 6–<9 moderate, 9–10 high. Bands are presentation choices, not percentiles. Use backend bands, proportional display and neutral unavailable state.

## Planned monitoring definition: monitoring-fi-v1

Final version must be frozen with Batch 06 implementation and evaluation fixtures.

| Metric                   | Numerator / denominator                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Visibility               | Eligible answers mentioning the confirmed brand / eligible answers                            |
| Visibility score         | Visibility fraction × 10, one decimal                                                         |
| Recommendation rate      | Explicit recommending answers / answers with available recommendation classification          |
| Owned-site citation rate | Eligible answers citing confirmed owned domain / eligible answers                             |
| Cohort mention share     | Brand-response mentions for this brand / brand-response mentions across fixed cohort          |
| Explicit position        | Position in an actual ordered recommendation list, with qualifying sample size; otherwise N/A |

Recommendations/position require exact evidence spans and versioned extractor/rules/model provenance. Evaluate negation, warning, neutral comparisons, ambiguous lists, ties and unknown. A mention is not a recommendation. Show classified/eligible coverage; unknown is never false. Extra classification model calls are independently budgeted and must be validated against original text.

Use neutral discovery/comparison/selection prompts. Branded diagnostic questions are separate and excluded from discovery visibility. New relevance gates require a new explicit methodology and exclusion reasons, never reinterpret historical eligibility.

Combined visibility is weighted by valid answer count. Comparisons require compatible prompt versions, cohort, provider/model/route, methodology, market/language and sampling interval, or an explicitly matched subset with coverage. Missing chart intervals are null gaps. History starts at the first observation.

Failed, incomplete, no_grounding, unconfigured, disabled, budget_blocked and interrupted are not brand absence. Reuse each neutral answer across cohort brands; do not run it again for each brand.

## Numeric acceptance fixtures for Batch 06

84/132 = 63.6% and 6.4/10; 36/132 = 27.3% owned citations; 84/240 = 35.0% cohort share; 4/6 = 6.7/10; 0/6 = 0; 0 eligible = null. A citation-only answer can increase citation rate with zero visibility. Provider samples 1/1 and 0/9 combine to 10%, not 50%.

## FI/EN presentation and limits

FI: Näkyvyys, Näkyvyyspisteet, Omat lähdeviittaukset, Osittaiset tulokset, Ei saatavilla. EN: Visibility, Visibility score, Owned-site citations, Partial results, Unavailable. UI copy, chart descriptions and report explanations must be fully translated in Batch 06; this technical document is not a completed bilingual methodology UI.

Default interface FI; EN affects formatting and labels only. Market FI and prompt language fi remain independent. Optional display translations are separately labelled/stored. Show sample counts, timestamp, timezone, provider/model and coverage.

These are API-based observations, not verified consumer AI website rankings, total search demand, statistical confidence or causal lift. Completing an opportunity cannot increase a stored measurement.
