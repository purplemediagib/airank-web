# Connections and server configuration

This document contains names and public service addresses only. It is not an
export of live environment values, and does not assert that each service is
correctly configured. Configure secrets through the hosting provider's secret
manager, never in Lovable chat, source files or browser-prefixed variables.

## Current architecture

| Component | Address / source | Responsibility |
| --- | --- | --- |
| Live frontend | https://app.airank.me | Current public app, EN/FI UI |
| Web BFF/proxy | `artifacts/api-server/`, same-origin `/api/*` | Cookie/CSRF/origin enforcement, allowlisted calls |
| Bunny API | https://mc-u87t7nkvtg.bunny.run | Auth, ownership, projects, monitoring APIs, analytics, Content Studio APIs |
| Monitoring worker | https://mc-0wuu8m6e4z.bunny.run | Queued provider collection and daily/immediate work |
| Content worker | https://mc-a793cb4lba.bunny.run | Separate Content Studio processing |
| Google connector | https://mc-kvj7j25914.bunny.run | Google consent, GA4/GSC imports and cached reports |
| Database | Existing Bunny libSQL database | Persistent app data; do not create a replacement during frontend migration |
| Backend authority | https://github.com/purplemediagib/airank.me | API/worker/connector source |

The preview URL is a temporary Replit development origin, not a new production
deployment. Obtain the approved destination URL from the operator.

## Frontend/proxy

The React app uses relative URLs. Do not add provider or database credentials to
the frontend. A static-only Lovable deployment still needs a server-side gateway.

| Variable | Where | Handling |
| --- | --- | --- |
| `AIRANK_PUBLIC_ORIGIN` | BFF | Exact approved HTTPS browser origin, no trailing path |
| `AIRANK_API_ORIGIN` | BFF | Existing Bunny API origin |
| `AIRANK_OAUTH_CLIENT_ID` | BFF | Existing registered app-client identifier; register a separate approved preview client if needed |
| `PUBLIC_CHECK_PROXY_SECRET` | BFF + API | Secret; matching signing configuration, never sent to browser |
| `PUBLIC_CHECK_TRUST_PROXY_HOPS` | BFF | Set only after verifying the real trusted proxy chain |
| `NODE_ENV`, `PORT`, `LOG_LEVEL` | BFF | Host-specific runtime configuration |
| `BASE_PATH`, `PORT` | Original Vite build/dev server | `/` for root hosting; original config requires explicit values |

`REPLIT_DEV_DOMAIN` and Replit instrumentation are development-only. They are not
production URLs or portable authentication. The server rejects unsafe origins;
do not disable that check to make a preview work.

## Existing backend settings to preserve

These are configuration **names**, not confirmation of current values. This is a
high-level inventory; `inventory/ENVIRONMENT-NAMES.json` generated during transfer
adds statically discovered names by component.

- Persistence/auth: `BUNNY_DATABASE_URL`, `BUNNY_DATABASE_AUTH_TOKEN`,
  `SESSION_SECRET`, `RATE_LIMIT_SECRET`, `SESSION_DAYS`, `COOKIE_SECURE`,
  `APP_URL`, `WEB_URL`, `API_URL`, `CORS_ALLOWED_ORIGINS`, `AIRANK_OAUTH_CLIENTS_JSON`.
- Application Google sign-in: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI`. This is separate from Google data-import consent.
- Email: `EMAIL_AUTH_ENABLED`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`. Report
  delivery is capability-gated separately; preserving a key is not proof that
  report email is enabled or that a sender is verified.
- Direct model routes: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `OPENROUTER_API_KEY`, `XAI_API_KEY`, `PERPLEXITY_API_KEY`,
  `ENABLED_PROVIDERS`, `API_BUDGET_CONFIG_JSON`.
  Use the pinned backend's actual route configuration; do not assume all routes
  use these providers or that adding a key enables consumer-web collection.
- Consumer/search collection: `CONSUMER_COLLECTION_ENABLED`,
  `CONSUMER_COLLECTION_PROVIDERS`, `CONSUMER_MAX_DAILY_COST_USD`,
  `CONSUMER_UNIT_COSTS_JSON`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`,
  `SCRAPELESS_API_TOKEN`.
- Scheduler/capacity: `PROJECT_SCHEDULER_ENABLED`, `MONITORING_CONCURRENCY`,
  `MONITORING_RUN_TIMEOUT_MS`, `MONITORING_PROVIDER_TIMEOUT_MS`,
  `MONITORING_MAX_TASKS_PER_RUN`, `MAX_DAILY_PROVIDER_CALLS`,
  `MAX_PROVIDER_CALLS_PER_SCAN`, `FREE_PROMPTS_PER_PROVIDER`.
- Sentiment: `SENTIMENT_ENABLED`, `SENTIMENT_MODEL`,
  `SENTIMENT_TIMEOUT_MS`, `SENTIMENT_MAX_DAILY_CALLS`.
- Website profile/suggestions: `FIRECRAWL_API_KEY`,
  `WEBSITE_PROFILE_ENABLED`, `WEBSITE_PROFILE_MODEL`, `CONTEXT_PROMPT_MODEL`.

Different containers do **not** inherit secrets from Replit or each other.
Do not copy all secrets to every component: retain the existing least-privilege
ownership. Content worker model/budget/storage options belong to that worker;
consult `backend-reference/content.env.example` and its code for the exact
contract, without treating example prices as approved spending limits.

## Google connector

The API uses server-only `GOOGLE_CONNECTOR_BASE_URL`,
`GOOGLE_CONNECTOR_API_KEY` and `GOOGLE_CONNECTOR_RETURN_URL`.
Keep the existing connector identity derived from the authorised project owner,
not an arbitrary browser tenant/workspace ID.

GA4/GSC consent and app Google login have different callbacks. Read the pinned
connector source for its callback path; do not guess it from the frontend route.
Keep imported tokens and reports on the connector's existing persistent storage.

Current app callback/return conventions include:
- App Google sign-in through the BFF:
  `<approved-app-origin>/api/airank/v1/app/google/callback`.
- Settings return:
  `<approved-app-origin>/en/settings?tab=connections` (or the explicitly supported
  locale return contract).

Before changing domains, review:
1. Registered backend OAuth/web clients and exact origins/redirects.
2. Google Cloud app-login redirect allowlist.
3. Connector consent callback and its own registered Google client.
4. Connector return-URL allowlist and API return configuration.
5. Verified auth-email links, sender/domain and reset/verification destinations.
6. Framer embed CSP and approved marketing origins.

Do not change these during source transfer. A new host's secure cookies create a
new browser session; existing sessions cannot be exported. Google connections
can persist if the same authorised backend tenancy/records are preserved, but
that must be verified rather than assumed.

## Health and readiness

Read-only health paths from `release/targets.json`:
- API: `/healthz`, `/readyz`.
- Monitoring worker: `/healthz`, `/readyz`.
- Content worker: `/health`, `/ready`.
- Google connector: `/health`.
- Web BFF: `/api/healthz`.

The release readiness script checks the declared response flags/service versions
and protected-route rejection. Health is not proof of valid model responses,
email delivery, Google consent, successful imports or usable measurements.

## Configuration not supplied by source control

Actual secret values, configured Bunny environment values, OAuth registrations,
sender verification, external quotas/balances, database content, production
sessions, deployment/DNS permissions and an isolated QA account are not copied
by Git. Establish an isolated environment explicitly before mutation testing.
