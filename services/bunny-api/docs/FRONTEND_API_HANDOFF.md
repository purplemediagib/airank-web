Update the EXISTING AI Rank Replit project. Preserve the current logo, branding, pages, articles, Finnish/English routes and existing authentication. Change the free checker only. Do not publish publicly or change domains.

The backend is Bunny API 0.2.0 + worker 0.4.0. API base URL:
https://mc-u87t7nkvtg.bunny.run

Implement the following complete flow against the real backend. Do not fabricate results or substitute a frontend-only score. Never put OpenRouter, OpenAI, Anthropic, database or Bunny Storage keys into Replit frontend code.

1. CONNECTION
Prefer the existing same-origin server proxy if present. Otherwise add a small server-side proxy with the fixed Bunny base URL from AIRANK_API_BASE_URL. Allow only GET /v1/status, POST /v1/scans/preview, POST /v1/scans and GET /v1/scans/{uuid}; forward Content-Type and X-Scan-Token, preserve backend status codes, and do not forward arbitrary destinations, cookies or provider credentials. Use guest requests for this free flow. Do not log scan tokens or full report bodies. If using direct browser requests instead, the Replit origin must already be on the Bunny API CORS allowlist. Never use no-cors.

GET /v1/status returns capabilities.confirmed_profiles, capabilities.prompt_preview, capabilities.visibility_score and enabled_providers. Require these capabilities before enabling the new form. Values such as providers.openai="worker_managed" are expected: API credentials are not a provider-readiness check. Do not block scans based on missing provider keys in the API. Show a graceful backend-update-needed state when capabilities are missing.

2. BRAND CONFIRMATION
Use a calm, modern two-step form:
A. Website and business details.
B. Review questions, confirm, then start.
Required editable fields: domain, brand_name (actual trading/product name, 2-100 characters), category_fi (plain Finnish product/service category, 8-240 characters). Optional aliases array: up to 8 genuine alternate spellings, each 2-100 characters. Market is FI and language fi. Do not silently use a page title as the brand or an English slogan as the category. The new backend does not auto-detect or translate these fields: ask the user to supply/confirm them. Any existing client suggestion must remain editable and unconfirmed.

Help text: describe what the business offers, without its brand, aliases, domain or links. Explain that aliases should be real brand spellings, not generic product categories. The API rejects categories containing the supplied brand/aliases/domain. A user confirmation is not a claim of legal ownership.

POST /v1/scans/preview with JSON:
{
 "domain":"purpleplus.ai",
 "brand_name":"Purple+",
 "aliases":["Purpleplus","Purple Plus"],
 "category_fi":"tekoälypohjainen markkinointialusta sosiaaliseen mediaan, mainontaan, hakukoneoptimointiin ja sähköpostimarkkinointiin",
 "market":"FI",
 "language":"fi"
}
These are example values only; do not prefill Purple+ for other users.

Response: {profile, prompts: string[], providers: string[], methodology: "confirmed-fi-mentions-v2", paid_calls:0}.
Show the exact returned questions and selected providers, and a confirmation checkbox. Changing any field invalidates the preview and confirmation. Preview makes no paid provider calls and does not reserve a scan. Keep Finnish questions unchanged on the English UI; explain that this is a Finnish-market check. Do not invent arbitrary client-side questions.

On the user's explicit Start action, POST /v1/scans using the confirmed profile fields plus:
{"profile_confirmed":true,"methodology":"confirmed-fi-mentions-v2"}
Use the methodology returned by the preview. The API regenerates the questions from the confirmed profile and stores the selected providers and prompt count for this run.

202 response: {id,status,domain,scan_token,results_endpoint,...}.
Keep scan_token only in page memory; never put it in a URL, analytics, logs or localStorage. Keep the existing warning that the page must remain open. Disable double submission. Do not automatically retry a POST after a network timeout: the backend might already have queued paid work, and this API does not provide an idempotency key. Show an honest uncertain-submission message.

Poll GET /v1/scans/{id} using X-Scan-Token, roughly every 3-5 seconds. Stop polling on completed, no_measurements or failed, on unmount and on definitive access errors. Retrying GET is safe; do not queue another scan. Handle 422 validation, 429 limits, 503 backend unavailability and 403 private-report access clearly.

3. RESULTS AND SCORE
The report returns id, domain, brand_name, profile, status, timestamps, prompts, observations, metrics and score. The score object contains:
value: number|null; out_of:10; band:"low"|"limited"|"moderate"|"high"|null;
state:"pending"|"complete"|"partial"|"unavailable"|"legacy";
mentions; valid_answers; expected_answers; providers_requested; providers_measured;
methodology; sample_label:"quick_check"; formula; recommendations_included:false.

Use score.value directly. Never recalculate, average provider scores, fabricate confidence, or coerce null to zero. Pending, unavailable and legacy scans have null values. Legacy reports remain viewable with “Earlier methodology — run a new check”; they must not receive a new /10 gauge. Partial results may have a numeric value: display “Partial result” prominently with actual provider/answer coverage. A valid zero is a real 0/10; no valid answers means “Unable to measure”.

Render a polished responsive 180-degree semicircle using SVG/CSS, with a large score centred inside, endpoints 0 and 10, and a short text label. Keep the existing brand colours for the surrounding UI. Gauge bands:
low: <5, red, “Low visibility” / “Heikko näkyvyys”
limited: 5 to <6, orange, “Limited visibility” / “Rajallinen näkyvyys”
moderate: 6 to <9, yellow/amber, “Moderate visibility” / “Kohtalainen näkyvyys”
high: 9–10, green, “High visibility” / “Vahva näkyvyys”.
Use the returned band. These are product display bands, not industry benchmarks or a percentile ranking. Make the 1-point orange range proportionate on a scale, not equal-sized misleading segments. Score to one decimal where needed; use Finnish decimal formatting on /fi. Avoid suggesting that 10 means “best in the industry”.

Under the gauge show “Your brand appeared in {mentions} of {valid_answers} valid AI answers” and “Quick check · {prompt count} questions per provider”. Use report data; do not hardcode six or nine answers. Show measured/requested provider counts, observed/expected answer counts, market and date. Label the evidence as API-based AI answers, not the consumer ChatGPT/Claude/Gemini websites.

Each provider card uses metrics[provider]: sample_size, mentioned, owned_domain_citations, unavailable, expected, missing, score, band; recommended is null. Display names: openai = OpenAI (ChatGPT models), claude = Claude, gemini = Gemini via OpenRouter. Render requested providers dynamically from the report snapshot. Do not show DataForSEO/Google AI Overviews as active. Do not hide failed providers. Remove the recommendations card from the new score UI.

Use plain text, labels and accessible contrast as well as colour. Give the numeric gauge an accessible meter label/value or an equivalent visible text description; decorative SVG should be aria-hidden. For null scores use a neutral placeholder rather than a red arc. Respect reduced motion, support keyboard access and announce status changes politely without moving focus.

4. EVIDENCE AND EXPLANATION
Add expandable “Questions and answers” with each exact Finnish question, provider, returned model, answer_text, citations and observation status. Render provider text safely, no unsanitised HTML. Only HTTP(S) citations are clickable; external links use rel="noopener noreferrer". Use friendly labels for no_grounding, incomplete, failed, unconfigured and budget_blocked; do not describe them as zero visibility.

Collapse technical details under “How is this calculated?”:
Score = 10 × valid answers mentioning the confirmed brand or an alias ÷ valid answers.
Each answer counts once. Website citations are separate. Only completed responses with structured source citations are eligible; failed/ungrounded/incomplete responses are excluded. Recommendations do not affect the score. Three questions per provider are a quick snapshot, not a comprehensive market benchmark; repeating questions/models can change results. Mention detection is literal alias matching, not a claim that a mention is positive or an endorsement.

5. VALIDATION
Verify responsive mobile/desktop form, preview invalidation and real payloads. Test 4/6 → 6.7, 0/6 → 0, no valid answers → null/unavailable, partial provider outage, pending, legacy, 422 errors and a lost POST response without automatic resubmission. Use mocks only in tests, never as production results. Report changed files and any remaining integration blockers. Do not make a paid scan unless the user explicitly clicks Start or separately authorises one.
