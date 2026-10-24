# Consumer observation collection gate

Research checked: 16 October 2026. An approved live pilot subsequently completed
on the same date: six requests, $0.024 total API-reported cost. No production
measurements, schedules or deployments were changed.

## Findings

| Candidate | Documented coverage | Important limitations |
| --- | --- | --- |
| DataForSEO LLM Scraper | ChatGPT and Gemini consumer-interface results; structured responses, sources and search-result elements | Location/language catalogs and output completeness must be tested for each engine. Not the separate LLM Responses product. No documented Claude, Grok or Perplexity coverage in this product. |
| Bright Data AI scrapers | ChatGPT, Perplexity, Gemini, Copilot and Google AI Mode | Technical documentation currently says Grok unavailable and European countries unavailable for Gemini, despite broader marketing claims. Claude not listed. Google AI Mode is not Google AI Overviews. |
| Self-operated browser collectors | No validated coverage in this project | Requires permitted access, maintenance, capacity and locale verification; do not build around access-control bypasses or assume reliable universal coverage. |

Existing DataForSEO code targets Google organic SERP with AI Overview loading.
This does not automatically enable its separate ChatGPT/Gemini LLM Scraper
endpoints. The project already supports DataForSEO configuration but account
entitlement and usable credentials for a live pilot have not been verified here.

## Approved pilot specification

Validate DataForSEO ChatGPT/Gemini first, with at most 20 Live results total,
no automatic paid retries, and a $1 maximum authorized spend. Published Live
unit pricing implies $0.08 for 20 result pages, excluding taxes, account funding
requirements or changed pricing. Check actual account pricing before submitting.
Approval does not authorize daily activation or production migration.

This is a partial-coverage pilot, not proof of full Peec parity. Keep existing
API series unchanged. Perplexity consumer collection remains a separate
candidate validation; Claude/Grok consumer coverage is unresolved. Copilot
remains explicitly deferred.

### Pilot acceptance

- Confirm supported requested markets and languages before paid submission;
  unsupported geography is a blocker, not permission to substitute another.
- Confirm delivered original prompt/answer, observable model/surface and
  collection timestamp; assess whether search is automatic or forced.
- Inspect sources versus citations versus ordinary links and whether repeated
  citation occurrences can actually be recovered. Never infer hidden retrievals.
- Record absent, unavailable and captured-empty fields separately.
- Validate valid uncited answers, evidence integrity, task completion, error
  states and one-submit/resumable-fetch behavior.
- Inspect terms, permitted use and data retention before enabling collection.
- Sandbox fixtures can check contract shape but cannot certify live provenance,
  locale behavior, freshness or collection reliability.
- Do not mark collector parity complete if these checks fail.

## Live pilot results

All six requests returned API/task status 20000 and a nonempty answer. Request
prompt, country code and language matched the returned metadata in every case.
Samples used Finland, with English/Finnish recommendation prompts and an English
factual prompt. They were synthetic public test questions, not changes to any
user's tracked prompt set. ChatGPT used force_web_search=false; Gemini has no
documented equivalent input on this endpoint.

| Engine / sample | Answer characters | Source references | Search-result entries | Fanout queries |
| --- | ---: | ---: | ---: | ---: |
| ChatGPT / English recommendations | 13,549 | 10 | 14 | 2 |
| ChatGPT / Finnish recommendations | 11,800 | 19 | 35 | 6 |
| ChatGPT / English factual | 3,016 | not supplied | not supplied | not supplied |
| Gemini / English recommendations | 5,159 | 6 | not supplied | not supplied |
| Gemini / Finnish recommendations | 2,902 | not supplied | not supplied | not supplied |
| Gemini / English factual | 2,003 | not supplied | not supplied | not supplied |

Each request cost $0.004; no retries were made. Raw results and the spending
ledger are in the ignored generated-artifacts/dataforseo-consumer-pilot directory.
The run lock prevents accidental replay of this pilot.

### Important interpretation constraints

- Source references are NOT certified inline citation counts. In the English
  ChatGPT sample, ordinary links labelled "Website" also appeared in sources.
  Preserve the vendor references and original answer; do not automatically
  classify every reference as a citation.
- Gemini's six English source references contained five distinct URLs, including
  the same URL attached to different answer passages. Deduplicating on ingest
  destroys that passage-level information; summing parent and item-level arrays
  can conversely double-count it.
- Some ChatGPT brand_entities.title values were product descriptions while
  markdown contained the name. These fields are evidence hints, not authoritative
  normalized brand identities. Verify names/spans against the actual answer.
- Gemini did not return search_results, fan_out_queries or brand_entities fields
  in this pilot. Missing capability is not zero activity.
- Null sources on a successful answer must remain a separate observation state;
  they are not proof that the engine performed no search or failed to answer.
- The catalogs returned Finland, UK and US and supported en/fi/sv, but Gibraltar
  was absent from the country entries checked. Never substitute UK for Gibraltar.
  Catalog membership and echoed locale are not independent proof of physical
  collection location.
- Reported model strings were retained as observed vendor metadata, not verified
  independently. API success is not a formal generation finish-reason signal.

### Gate outcome

Pass for a small live ChatGPT/Gemini answer-collection proof of concept in the
tested locale; conditional for production adoption. This does not establish
long-term reliability, complete citation semantics, unrestricted global coverage,
all-engine parity or identical observations to Peec.

Next implementation should preserve the richer evidence contract and use
capability-specific adapters, without reusing the lossy citation-only payload.
Full citation/retrieval parity still needs validation, as do permitted-use and
retention requirements before recurring activation. Existing API data remains
historically separate. Recurring collection has not been authorized or enabled.

## Cost illustration (not an activated budget)

DataForSEO's published prices per result page:
Standard $0.0012; Priority $0.0024; Live $0.004.

For 100 prompts, two engines and 30 days: 6,000 results, or $7.20 Standard,
$14.40 Priority, $24 Live. This excludes all other platforms, sentiment/entity
analysis, storage, hosting, additional collections, taxes and funding minimums.
Daily scheduling can use Standard's documented approximately 45-minute queue;
the worker must persist remote task IDs and poll instead of blocking a worker
slot or blindly resubmitting.

## Claude, Grok and Perplexity follow-on evaluation

Initial documentation review: 16 October 2026. Scrapeless credentials were later
supplied securely and a separate six-request pilot was authorized up to $1.
Live results follow below; no recurring collection was activated.

| Engine | Candidate | Result of documentation review |
| --- | --- | --- |
| Grok | Scrapeless scraper.grok | Takes a new prompt, country and model mode. Documents original answer, web/X results, footnotes and model metadata. Ready for a capped live pilot, not yet operationally validated. |
| Perplexity | Scrapeless scraper.perplexity | Takes a new prompt and country, with optional web-search control. Documents answer text, source URLs/snippets and media. Ready for a capped live pilot, not yet operationally validated. |
| Perplexity | Bright Data | Documented alternative; no account available for live validation. |
| Grok | Bright Data | Technical docs explicitly say currently unavailable; marketing pages are not evidence of working service. |
| Claude | ScrapingBee Claude Web | Reads existing public shared-chat URLs. This is not evidence of an endpoint that executes our canonical prompts daily. Does not meet the requirement on that basis. |
| Claude | Other reviewed options | Model API gateways and unofficial session-based clients do not establish a supported consumer-observation service. Consumer collection remains unresolved, not proven impossible. |

Scrapeless is the recommended next pilot candidate because one account can test
both Grok and Perplexity. Both product pages advertise Basic usage pricing of
$1.80/1,000 requests, but actual account rates, credit requirements and endpoint
availability must be checked before spending. The DataForSEO pilot approval is
not authorization to spend on a different supplier.

Important open checks:

- Country input is documented, but supported Finland/Gibraltar locations and
  actual locale behavior remain unverified. Do not promise global coverage.
- Current scraper documentation uses the asynchronous /api/v2/scraper/request
  endpoint; product pages and older examples use /execute. Resolve the current
  submission/result-retrieval contract before sending a paid request; do not try
  both as an automatic fallback.
- Do not request public share links for user prompts. The optional
  should_fetch_share_link input is unnecessary for the pilot.
- Suggested follow-up prompts are not the model's background search queries.
- Preserve footnote IDs and passage references, verify output completeness and
  actual citation semantics, and inspect permitted use/retention before recurring
  activation. Vendor marketing statements are not independent validation.
- Never label existing direct Claude/Grok/Perplexity API results as consumer-web
  observations while these gaps remain.

References for this evaluation:

- https://docs.scrapeless.com/en/llm-chat-scraper/scrapers/grok
- https://docs.scrapeless.com/en/llm-chat-scraper/scrapers/perplexity
- https://www.scrapeless.com/en/product/web-scraper/grok
- https://www.scrapeless.com/en/product/web-scraper/perplexity
- https://docs.brightdata.com/products/scrapers/chatgpt/introduction
- https://www.scrapingbee.com/scrapers/claude-web-api

### Scrapeless live pilot outcome

Six distinct requests were submitted once each on 16 October 2026 through the
documented v2 asynchronous request/result endpoints. Five returned success with
nonempty answers and matching original prompts; one returned terminal failure.
Public share links were disabled; no production database or dashboard changes.

| Platform | Requested country | Outcome | Answer characters | Search/source entries | Inline reference occurrences |
| --- | --- | --- | ---: | ---: | ---: |
| Grok | US | Success | 6,735 | 70 | 8 |
| Perplexity | US | Success | 2,132 | 10 | 11 |
| Grok | FI | Provider execution failure | unavailable | unavailable | unavailable |
| Perplexity | FI | Success, Finnish answer | 2,138 | 10 | 6 |
| Grok | GI | Success | 8,494 | 71 | 15 |
| Perplexity | GI | Success | 2,525 | 10 | 11 |

Grok's FI failure said "Execution failed. Please try again later. We're working
to resolve the issue." It was not retried, and does not establish a permanent
country restriction. A terminal failed body arrived on a non-success HTTP
response; the pilot initially stopped conservatively, then continued only the
three remaining distinct samples after inspecting the saved failure. No duplicate
submissions occurred.

Billing: five successful requests corresponded to an observed aggregate credit
decrease of 0.009 across the two measured intervals, consistent with advertised
$0.0018/request pricing. The failed request's individual charge was not isolated
across the stop/continuation boundary, so this is not an exact invoice total.
The published-rate estimate for all six submissions is $0.0108, below the $1 cap.

Evidence checks:

- Each inline numeric reference in the inspected successful answers resolved to
  a URL definition. Perplexity's source index/cited_count values agreed with the
  corresponding observed reference occurrences in all three samples.
- Perplexity returned ten source entries per sample, including entries with zero
  citations. Do not count every returned source as an explicit citation.
- Grok's US sample had eight footnote records for seven distinct URLs, eight
  inline occurrences and seven answer reference definitions. These are different
  counts and must not be collapsed or double-counted.
- Grok returned model metadata "fast", which is a mode label, not a verified
  pinned model version. Perplexity returned no model-version field.
- Country inputs FI/GI were accepted for successful samples, but the result
  payloads did not echo the collection country. Prompts themselves named the
  markets; these tests do not independently prove geographic routing. The public
  country page claims 195+ locations but shows only a partial table.
- API result retention is short: the quickstart says four minutes after
  completion, while the FAQ mentions five. Fetch and persist immediately.
- The vendor says it collects publicly accessible, unauthenticated data; this is
  a vendor statement, not independent certification of permission or compliance.

Decision: Perplexity is a validated small-sample integration candidate; Grok is
a partially validated candidate with an observed reliability failure. Neither
gets a production reliability guarantee from this sample. Claude consumer
collection remains unresolved; its existing model API is not an equivalent.
Raw responses and ledger are kept in the ignored
generated-artifacts/scrapeless-consumer-pilot directory.

Additional primary references:

- https://docs.scrapeless.com/en/docs/ai-scraper/quickstart/quickstart/
- https://docs.scrapeless.com/en/docs/ai-scraper/quickstart/task-lifecycle/
- https://docs.scrapeless.com/en/docs/ai-scraper/help/supported-countries/
- https://docs.scrapeless.com/en/docs/ai-scraper/help/faq/

## Original primary references

- https://dataforseo.com/pricing/ai-optimization/llm-scraper
- https://docs.dataforseo.com/v3/ai_optimization/llm_scraper/overview/
- https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/locations
- https://docs.brightdata.com/products/scrapers/chatgpt/introduction
- https://docs.peec.ai/

Documentation claims are not independent validation; none of these sources
guarantees identical responses or sentiment scores to Peec.
