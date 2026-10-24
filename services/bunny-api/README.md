# AI Rank API 0.2.0

See the release README below. Build this folder with its build-and-push.ps1.

# AI Rank confirmed checker release

API 0.2.0 + Worker 0.4.0. Docker build contexts, not prebuilt images. Both containers need updating. No deployment or paid provider requests have been made. Docker is unavailable in the preparation environment; build/push locally. Validation: worker 60 offline tests, API 42 offline tests, plus a mocked HTTP API-to-worker test verifying confirmation, private report access and 4/6 → 6.7/10.

## Windows build and push

Extract this folder to C:\Users\vince\Downloads\airank-confirmed-checker-release (Dockerfile is inside each service subfolder). Start Docker Desktop in Linux containers mode. Docker Hub login must already permit pushing vtcarrie/bunny-mcp-connector.

```powershell
Set-Location "C:\Users\vince\Downloads\airank-confirmed-checker-release"
powershell -ExecutionPolicy Bypass -File ".\build-all.ps1"
```

Builds and pushes, stopping on any error:
- vtcarrie/bunny-mcp-connector:airank-worker-0.4.0
- vtcarrie/bunny-mcp-connector:airank-api-0.2.0

Each Docker build runs its offline tests. Do not select new tags in Bunny unless the build and push both succeeded.

## Bunny rollout order

1. Deploy WORKER 0.4.0 first. Keep port 3001, the existing DB/storage settings and direct OpenAI/Anthropic keys/model overrides. Verify worker /healthz says version 0.4.0 and /readyz returns 200. Do not deploy API 0.2.0 against an old worker: it cannot honour the confirmed-profile contract.
2. Deploy API 0.2.0, port 3000. Keep existing database, OAuth, CORS and RATE_LIMIT_SECRET settings. Verify API /healthz says 0.2.0, /readyz returns 200 and /v1/status advertises confirmed_profiles, prompt_preview and visibility_score. The new API deliberately rejects old unconfirmed scan POSTs with 422, so coordinate the frontend update with this deployment.
3. Apply REPLIT_PROMPT.md to the existing Replit project. Do not publish or change domains.
4. Preview a profile (no paid calls), then deliberately run one scan and inspect actual answers/citations. Keep benchmarks paused while checking this path.

Both containers automatically create the additive scan_profiles table if absent. Existing scan_jobs, observations, benchmark tables and Bunny evidence remain intact. No new DB, storage zone or Pull Zone is needed. Existing DB credentials need CREATE TABLE permission; schema failures appear in logs/readiness. On an established DB, AUTO_MIGRATE need not be changed. First-time DB setup still uses API AUTO_MIGRATE=true.

## Environment settings

Set on BOTH API and worker:
```dotenv
ENABLED_PROVIDERS=openai,claude,gemini
FREE_PROMPTS_PER_PROVIDER=3
```

On WORKER only:
```dotenv
OPENROUTER_API_KEY=<your actual OpenRouter key in Bunny Secrets>
OPENROUTER_GEMINI_MODEL=google/gemini-3.8-flash
OPENROUTER_SEARCH_ENGINE=native
BENCHMARK_ENABLED=false
BENCHMARK_SCHEDULER_ENABLED=false
```

If Gemini is not ready yet, use ENABLED_PROVIDERS=openai,claude on BOTH containers. No provider keys belong in the API or browser. Existing native Gemini and DataForSEO variables are unused. Keep google_aio out of the list. Existing storage zone airankme and its regional endpoint/write key remain unchanged.

The API's existing APP_ENV=staging + DISABLE_FREE_SCAN_LIMITS=true testing behaviour is preserved. For temporary authenticated-dashboard testing in production, DISABLE_AUTHENTICATED_SCAN_LIMITS=true bypasses only signed-in scan limits; anonymous/public checker caps remain active. Remove the flag after testing. Keep your existing free-scan budget settings; do not replace the environment with the sample file. The API freezes its prompt count/provider list for each new scan; the worker executes that snapshot. API /v1/status says worker_managed rather than pretending it can check worker credentials.

Replit: server-only AIRANK_API_BASE_URL=https://mc-u87t7nkvtg.bunny.run if adding the suggested same-origin proxy. Preserve CORS_ALLOWED_ORIGINS when using direct browser calls.

## What changed

- Actual brand, genuine aliases and a plain Finnish category are explicitly entered/confirmed. Website page titles and slogans do not overwrite them.
- POST /v1/scans/preview validates the profile and returns exact neutral questions with zero paid calls. Questions target customers operating in Finland, not exclusively Finnish-owned companies.
- POST /v1/scans requires profile_confirmed=true and methodology=confirmed-fi-mentions-v2. Profile and queued job are stored atomically with rate accounting.
- Literal case-insensitive Unicode-normalised whole-phrase matching recognises Purple+, Purpleplus and Purple Plus when supplied. It does not infer sentiment or Finnish inflections beyond the confirmed aliases.
- OpenAI, Claude and OpenRouter responses need completed output and structured citations to be eligible. Plain answer text containing a URL is not sufficient. This is a technical evidence gate, not independent verification of relevance/truth.
- Score is 10 × mention-bearing valid answers / all valid answers, rounded to one decimal. Each answer counts once. Citations remain separate; recommendations are excluded. Null is not zero. Pending/legacy/unavailable states never get a gauge value. Partial results retain an explicit partial label and coverage.
- The exact requested provider list is kept with each scan even after environment changes. Old scans are not rescored from guessed identities.
- New confirmed checks use user-supplied information; they do not crawl/translate the site to infer a category. The frontend should not promise an automatic website audit. Existing legacy queued scans retain their older processing path.

Colour bands are product presentation choices: <5 red, 5–<6 orange, 6–<9 yellow/amber, 9–10 green. The Replit prompt includes accessible labels and complete API response handling.

## Benchmarks

Benchmark processing remains off. Stricter adapter eligibility now uses new-run methodology fi-routed-search-v3. Pending jobs from an older benchmark methodology are marked disabled instead of silently changing their measurement rules; completed history remains unchanged. Do not compare earlier raw success rates directly to the new stricter denominator. The default future pilot key is pilot-routed-v3. Do not reuse an old pilot key to try to trigger a new round. Review budget settings and explicitly enable a new pilot separately after validating free checks.

## Limitations and rollback

No live OpenRouter/provider response was tested with account credentials. OpenRouter native search is a preference and can fall back to Exa; the worker records requested engine, not a verified actual engine. Existing provider budget behaviour is preserved; this release does not add billing or spending controls.

A preview does not prove the user owns the brand or that their category is correct. Questions are deterministic Finnish templates from the confirmed category, not an AI-generated taxonomy or keyword-volume research.

Three questions per provider produce a coarse, variable snapshot. A zero means no literal brand/alias match among this sample, not no AI visibility anywhere.

For rollback, stop new submissions first and coordinate API/worker/frontend versions. Preserve the additive table/evidence. Never run an older worker on newly queued confirmed-profile jobs and present them as v2 measurements. Restoring the old frontend/API will remove confirmation and score features; do not silently translate new reports into older metrics.
