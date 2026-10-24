# AI Rank API contract

## Batches 09–10 source extensions

- Owned `GET/POST /v1/projects/:id/opportunities`: list or explicitly refresh versioned evidence rules; refresh performs no model call.
- Owned `PATCH /v1/projects/:id/opportunities/:id`: version-checked notes/status and persistent history, including explicit reopening.
- Owned `GET/POST /v1/projects/:id/reports`: list metadata or freeze a full filtered measurement snapshot.
- Owned `GET /v1/projects/:id/reports/:id`: private immutable snapshot for reopening/export; returns 410 after 30 days and 404 for foreign records.
- Owned `GET/PATCH /v1/projects/:id/measurement-settings`: route availability, selection, version and computed capacity; writes affect future runs only.

Report snapshot payloads also retain immutable source run snapshots as provenance. PDF/CSV are generated from the authorised snapshot in the browser; neither public file URLs nor database file blobs are used. Authenticated research/analytics/report responses have a bounded 32 MiB BFF allowance; other response limits remain 2 MiB.

## Batches 07–08 source extensions

- Owned `GET/POST /v1/projects/:id/research`: complete research dataset and version-checked create/update/archive/accept/dismiss/merge actions. Source counts are unique answer IDs, not summed citation counts.
- Owned `GET /v1/projects/:id/evidence/:evidenceId`: derived evidence plus redacted stored envelope; not fabricated provider transport data.
- Owned `GET/PATCH /v1/projects/:id/schedule`: durable timezone/weekday/hour configuration, pause/resume, next timestamp and slot history.
- Authenticated `GET /v1/industries` and `/v1/industries/:id`: draft directory, published/legacy panels, immutable measurement history and latest coverage/evidence.
- Administrator-only `POST /v1/industries`: explicit import, publish, schedule and manual-run actions. Admin IDs come only from server configuration.

Mutations retain existing CSRF/origin/session checks. OpenAPI is authoritative for generated types. These endpoints require the final backend release and additive migrations; they are not present in the existing external 0.5.0 ZIP. See FINAL-RELEASE-DELTA.md.

## Batch 06 analytics extension (source only)

`GET /v1/projects/:projectId/analytics` requires the existing authenticated owner and exact app client registry. BFF exposes `/api/airank/v1/projects/:projectId/analytics`. Query: `from`, `to` (inclusive UTC YYYY-MM-DD), `provider`, `topic`, `group`, `runId`. Invalid filters return 422; foreign projects and unknown/filtered-out runs return 404. Queries are read-only and never call a provider.

Additive measurement filters: legacy `tag`, `tags` (a JSON-encoded array of up to 12 nonblank strings, each at most 40 characters), `tagMode=or|and` (default `or`), `market` (uppercase two-letter code), `language` (lowercase two-letter code), `surface`, `promptId` and `promptVersion`. Tags are trimmed and deduplicated, and a legacy singular tag joins the selected set. JSON encoding preserves commas within tag names. AND requires every selected tag on the same frozen prompt; OR requires any selected tag. Market and language match independent frozen run values, never the current project settings. Historical options are returned as `availableTags`, `availableMarkets` and `availableLanguages`. Identical matching applies before expected-answer counts, evidence, source/competitor aggregates and prior-period comparisons. The paginated results endpoint accepts the same measurement filters; matching occurs before pagination and totals. Results also accepts `group=<composition ID>` or `group=latest` to resolve the analytics default group. Group matching reuses the exact analytics task selection, including unfinished tasks and mixed-surface partitions, rather than filtering only run IDs. URL resets and browser-local saved presets include these filters, and drill-down/back links retain them. Shared sidebar navigation propagates an allowlist of measurement context between Overview, Results, Sources, Competitors and Perception, not administration or traffic routes. Results links materialize preset ranges as inclusive UTC dates and retain the selected composition (or resolve `latest` when analytics used its default).

OpenAPI `ProjectAnalytics` defines metrics with explicit numerator/denominator counts; provider breakdown; all filtered monitoring runs; composition groups; selected-group/run evidence and extraction spans; date-filtered identity/prompt changes; topics/providers and separate all-time quick-check count. The UI quick-check list applies its own date filter to the complete owned list. Provider/topic filters apply to monitoring, not identity change events or quick checks.

Aggregates select the latest neutral composition by default. Run drill-downs select one immutable run. History preserves incompatible and diagnostic runs, marks comparability, and never adds fake dates/zeroes. Missing chart days are null UI slots, not API observations. Quick-check report routes and score semantics are unchanged. See BATCH-06-REPORT.md and METHODOLOGY.md. Source extension is not yet on the external 0.5.0 service.

Batch 05: project-owned prompt/version/suggestion and monitoring APIs are implemented in the unpublished Bunny extension. See BATCH-05-REPORT.md and generated OpenAPI for exact input/output types. All writes require existing session/CSRF. Monitoring POST uses owner-scoped submission IDs; edits/archive create prompt versions; no write silently measures. Prompt GET supports status/search/topic/tag/provider/outcome/sort/page with total and fixed pageSize 20. Run reports distinguish expected, completed terminal evidence and valid answers.

Audit: 2026-10-12. **Existing source**, **observed deployed** and **planned extension** are separate categories. New paths below are a design contract, not implemented endpoints.

## Batch 03 implementation update

Batch 04 adds typed QuickCheckInput/Submission/Preview/Accepted/Report in the generated OpenAPI contract. App-client requests use existing /v1/scans/preview, POST /v1/scans, GET /v1/scans/:id plus GET /v1/projects/:id/scans. project_id/project_version are mandatory for the app; preview_hash/submission_id are also mandatory on submit. The public guest contract remains unchanged. Migration app-002-project-scans stores immutable linkage; details and offline verification are in BATCH-04-REPORT.md. All new endpoints remain unpublished externally.

The OpenAPI in lib/api-spec/openapi.yaml now defines implemented app sessions, project CRUD/archive/identity versions and preferences. These are implemented locally in services/bunny-api and exposed through the local strict BFF, but not yet released to the supplied live Bunny API.

- New auth namespace: GET /v1/app/session, GET /v1/app/google/start, GET /v1/app/google/callback, POST /v1/app/logout. Existing /v1/auth/* is unchanged for the checker. App session returns authenticated/user/csrfToken/loginAvailable. All app writes, including logout, send JSON and X-CSRF-Token; no separate /auth/csrf request is needed.
- Project list currently returns Project[] (active and archived); identity versions return ProjectIdentity[]. This implemented MVP contract supersedes the generic future list envelope for these two lists only.
- Project create/update uses brandName, aliases, ownedDomains, categoryFi. Market FI and promptLanguage fi are server-owned. Update/archive require expectedVersion; each archives/edits by appending an immutable identity version and audit event, leaving prior observations unchanged.
- Preference PATCH requires expectedVersion and optional locale/timezone/lastProjectId. Archived project selection is rejected; archive clears its saved active selection atomically.
- New error responses currently expose safe error.code and optional fieldErrors, not arbitrary upstream messages. Public 0.2.0 missing app-session route is normalized to APP_NOT_CONFIGURED/503.

The other planned families below remain unimplemented.

## Read-only deployed observations

Fixed upstream supplied by the pack: `https://mc-u87t7nkvtg.bunny.run`.

| Request              | Actual result                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GET /healthz         | 200, service airank-api, version 0.2.0, environment staging                                                                        |
| GET /readyz          | 200, ready true                                                                                                                    |
| GET /v1/status       | 200, database and OAuth configured; enabled openai/claude/gemini; all worker_managed; provider_readiness unknown_until_measurement |
| GET /v1/openapi.json | 200, minimal path inventory matching source; no typed request/response schemas                                                     |

Capabilities advertised: confirmed_profiles, prompt_preview, visibility_score. Methodology confirmed-fi-mentions-v2. This does not verify worker version, provider keys/models, benchmark activation, storage access, actual Google login or production domain configuration. No scans or writes were sent.

## Existing source endpoints

Source reference: uploaded `airank-api-0.2.0/src/api/server.mjs`.

| Method/path                  | Input/access                                         | Output and behavior                                                                                           |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET /healthz                 | Public                                               | ok/service/version/uptime_seconds/environment                                                                 |
| GET /readyz                  | Public                                               | ready; 503 database_not_linked or database_unavailable                                                        |
| GET /v1/status               | Public                                               | Configuration/capability metadata, not provider verification                                                  |
| GET /v1/openapi.json         | Public                                               | Minimal route inventory                                                                                       |
| GET /v1/auth/google/start    | return_to, allowed fi/en dashboard/start/settings    | Sets state cookie, saves one-use state, redirects to Google                                                   |
| GET /v1/auth/google/callback | code/state plus matching state cookie                | Validates OAuth; sets session; redirects                                                                      |
| GET /v1/auth/session         | Optional session cookie                              | authenticated and user {id,email,name}, or false/null                                                         |
| POST /v1/auth/logout         | Session cookie, allowed Origin when present          | Revokes session, clears cookie, {ok:true}                                                                     |
| POST /v1/scans/preview       | JSON confirmed identity, allowed Origin when present | profile/prompts/providers/methodology/paid_calls:0; no provider calls                                         |
| POST /v1/scans               | JSON identity + profile_confirmed:true + methodology | 202 {id,status,domain,scan_token,results_endpoint,message}; owner when session present, otherwise guest token |
| GET /v1/scans/{id}           | Owner session OR X-Scan-Token                        | Job/profile/prompts/observations/metrics/score/methodology; 403 wrong access, 404 absent                      |

Preview/create identity: domain; brand_name 2–100; category_fi 8–240; optional aliases array max 8, each 2–100; market FI, language fi. Category must not contain brand/aliases/domain/URLs. Input changes invalidate preview. Source permits prompt count 1–6; defaults are not live configuration facts. Exact questions and providers come from preview; frozen profile includes provider list/prompt count.

Create is **not idempotent**. Disable duplicate submission; do not auto-retry an ambiguous timeout. Poll report every 3–5s with backoff; stop on completed/no_measurements/failed, definitive access errors and unmount. Refresh of authenticated linked runs must query, never enqueue. Guest token stays in page memory only. Existing scan ownership exists, but project linkage/listing does not.

Report contains answer_text and structured citations, not private raw payload. Source response does not select observation id or raw_storage_key; a new authorized observation endpoint is required. Original answer text is capped to 15,000 characters by quick-check storage code: do not claim the report is lossless raw evidence. Existing errors vary between free text and coded responses; the BFF must safely normalize known errors without hiding upstream status.

Source statuses: queued, processing, completed, no_measurements, failed at job level. Score state: pending, complete, partial, unavailable, legacy. Provider status and score coverage drive truthful rendering even when job status says completed or failed.

## Planned common contract

BFF prefix `/api/airank`; upstream `/v1`. All new owned operations use the session, never body user IDs. All writes require Origin/CSRF checks. Ownership applies to project and every nested resource; return 404 for inaccessible new owned entities, 401 for missing/expired session. Admin routes require server-side panel-admin permission.

New JSON error: `{error:{code,message,fieldErrors?,retryable,requestId}}`; FI/EN text is selected by stable code in UI. 400 invalid query/JSON, 401 session, 403 CSRF/admin, 404 inaccessible/missing, 409 stale version/idempotency conflict, 422 field validation, 429 capacity, 503 missing capability/readiness. Preserve Retry-After where valid.

Lists: `{items,page:{nextCursor,total},appliedFilters}`. Default limit 25, maximum 100; stable allowlisted sorting plus ID tiebreaker. Aggregates use all matching eligible rows, not a list page. Filters: inclusive from/exclusive to UTC boundaries, providers, topics, prompt versions and methodology; return actual applied set and timezone. Versioned edits carry expectedVersion; conflicts cannot overwrite silently.

Timestamps for new contracts are ISO 8601 UTC; adapter explicitly converts legacy epoch-milliseconds. IDs are opaque. Text lengths/body caps, validation schemas and operationIds will be encoded in OpenAPI per implementing batch, then codegen run before use.

## Planned resources and API families

| Batch | Paths/methods (upstream /v1 prefix)                                                                                                        | Payload/result and persistence                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03    | GET/POST /projects; GET/PATCH /projects/{id}; POST /projects/{id}/archive                                                                  | Project {id,brandName,aliases,ownedDomains,categoryFi,market,promptLanguage,industryId,status,identityVersion,createdAt}; immutable identity edit, owner-only archive |
| 03    | GET/PATCH /me/preferences                                                                                                                  | {locale:fi/en,timezone,lastProjectId}; check project ownership before selection                                                                                       |
| 03    | Auth routes above + GET /auth/csrf                                                                                                         | Existing identity; configured client/redirect binding and session-bound CSRF; capability flag for new flow                                                            |
| 04    | POST /projects/{id}/scans; GET /projects/{id}/scans                                                                                        | Existing confirmed fields; create scan/link atomically under session. Existing public /scans behavior unchanged; not automatically retryable                          |
| 05    | GET/POST /projects/{id}/prompts; GET/PATCH /projects/{id}/prompts/{promptId}; POST .../archive and .../restore                             | Prompt {id,text,version,topic,intent,tags,market,language,status}; stable ID, immutable versions                                                                      |
| 05    | GET .../prompts/{promptId}/versions; GET .../suggestions; POST .../suggestions/{suggestionId}/accept or /reject                            | Suggestion {id,text,source,rationale,state,acceptedPromptId}; accepted once, template source labelled honestly                                                        |
| 05    | POST/GET /projects/{id}/runs; GET /projects/{id}/runs/{runId}                                                                              | Explicit snapshot of prompt/identity/cohort versions, route/model/methodology, expected coverage; progress, completed/requested counts and safe errors                |
| 06    | GET /projects/{id}/aggregates; GET .../trends; GET .../history; GET .../changes; GET .../prompts/{promptId}/trends                         | Metric {value,numerator,denominator,state}; coverage and comparability metadata, null gaps; changes with actor/type/time/version references                           |
| 07    | GET/POST /projects/{id}/competitors; GET/PATCH .../competitors/{competitorId}; POST .../competitors/{competitorId}/archive                 | Confirmed names/aliases/domains, immutable cohort versions; remove only from future snapshots                                                                         |
| 07    | GET .../discovered-brands; POST .../discovered-brands/{candidateId}/accept, /dismiss, /merge                                               | Evidence observation IDs, verification status, duplicate resolution and audit; no guessed domains                                                                     |
| 07    | GET .../sources/domains; GET .../sources/urls                                                                                              | Citation-bearing answer counts, unique URL counts, prompt/brand associations and drill-down filters                                                                   |
| 07    | GET .../observations; GET .../observations/{observationId}; GET .../observations/{observationId}/raw                                       | Original evidence, citations, matched spans/classification version, status/route/model/time; authorized/redacted bounded raw JSON/text or private download            |
| 08    | GET /industries; GET /industries/{id}; GET /panels/{id}; GET /panels/{id}/runs; GET /panels/{id}/aggregates; GET /panels/{id}/observations | Published fixed panel metadata, denominators, neutral questions, real history/leaderboard; enforce panel access policy on evidence                                    |
| 08    | POST /admin/panels/import; PATCH /admin/panels/{id}; POST .../validate and .../publish; POST /admin/panels/{id}/runs                       | Draft validation/source verification, immutable published version, permission enforcement; manual run idempotency                                                     |
| 08,10 | GET/PATCH /projects/{id}/schedule; GET/PATCH /admin/panels/{id}/schedule                                                                   | enabled, cadence, timezone, nextRunAt,lastOutcome,capacityState,version; audit pause/resume, stable slot and missed-slot policy                                       |
| 09    | GET .../opportunities; GET/PATCH .../opportunities/{opportunityId}; POST .../opportunities/{opportunityId}/notes                           | Versioned rule, evidence links, rationale/priority, new/in_progress/completed, notes/change history; explicit reopen                                                  |
| 10    | POST /reports/preview; GET/POST /reports; GET /reports/{id}; GET /reports/{id}/download                                                    | Owned project or authorized panel, filters, locale, format PDF/CSV; frozen run selection, private job/file status, real bytes                                         |
| 10    | GET/PATCH /projects/{id}/monitoring-settings                                                                                               | Allowed providers, configuration versions, cadence/timezone; measured/configured/disabled status distinction and operational limits                                   |
| 06    | GET /methodologies/{version}                                                                                                               | Versioned FI/EN definitions/eligibility/extraction caveats, distinct checker/monitoring                                                                               |

`...` in the table means the same `/projects/{id}` prefix unless an explicit full prefix is present. Each mutation is a real endpoint requirement, not a cosmetic UI action.

## Run idempotency and measurements

New monitoring POSTs require Idempotency-Key scoped to owner/project/operation. Persist key, canonical payload hash and response/run ID atomically; same key/body returns same run, differing body yields 409. Preserve records for the lifetime of the run; do not automatically expire and accidentally requeue. Manual remeasurement needs a new explicit intent/key and links to original run. Scheduling uniqueness is project/panel + stable UTC slot + schedule version.

Snapshot fields: promptVersionIds, identityVersionId, cohortVersionId, providerRoutes/models/searchMode, methodologyVersion, extractionVersion, market, promptLanguage, repeats, scheduleSlot, expectedAnswers, timestamps. Observation fields: original prompt/answer, success/error status, structured citations, private evidence pointer, matched spans and classification provenance. Raw original evidence is immutable; extraction updates append derived versions.

Aggregates return matched run IDs, requested/valid/classified counts, exclusions by reason, provider breakdown, cohort and prompt/methodology composition. Recommendation unknown is null. Comparator supplies comparable boolean, reason codes, matched subset and coverage; never average provider percentages or rank unrelated quick checks as industry benchmarks.

Capability additions must be version-advertised alongside existing booleans. Clients against API 0.2.0 explicitly show unsupported feature state until required extension is deployed. No invented data fallback.
