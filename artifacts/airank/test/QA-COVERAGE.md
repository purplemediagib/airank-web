# AI Rank automated QA coverage

This map describes the local test suites in this repository. It is a hand-off
for the separate `airank-qa` repository; it does not claim that repository was
read or updated.

## Coverage map

| Area | Existing or added coverage | Safe test boundary |
| --- | --- | --- |
| API health and readiness | `services/bunny-api/test/app-entry-routing.test.mjs`, `services/bunny-api/test/app.test.mjs`; live `/healthz` and `/readyz` were checked read-only | Health contracts only; no production writes |
| Email login, failed login, sessions, expiry, recovery and logout | `services/bunny-api/test/email-auth.test.mjs`, `services/bunny-api/test/app.test.mjs`, `artifacts/airank/test/scripts/offline-browser.mjs` | In-memory SQLite, synthetic accounts, injected mail delivery |
| Public checker profile validation, limits, preview, scan completion, partial results and email delivery | `services/bunny-api/test/public-check.test.mjs` | Fake provider and mail functions; no live scan or email |
| Checker UI validation, profile review, preview-before-start, explicit consent, partial-score display and email gate | `artifacts/airank/test/public-check-ui.test.tsx` | React test fixtures; no requests to the real provider |
| Scoring, denominators, failed/missing results and partial provider coverage | `services/bunny-api/test/scan-profile.test.mjs`, `services/bunny-api/test/monitoring.test.mjs`, `services/bunny-api/test/public-check.test.mjs` | Synthetic observations and provider results |
| Projects, ownership and project settings | `services/bunny-api/test/app.test.mjs`, `services/bunny-api/test/email-auth.test.mjs` | Isolated accounts and SQLite fixtures |
| Competitor/research data and ownership | `services/bunny-api/test/research.test.mjs`, `services/bunny-api/test/monitoring.test.mjs` | Synthetic brands and frozen evidence cohorts |
| Google connections, property selection and permissions | `services/bunny-api/test/google-connections.test.mjs`, `services/bunny-api/test/app.test.mjs`, `artifacts/airank/test/traffic.test.tsx` | Injected connector responses; no real OAuth or customer property changes |
| Dashboard protected routes and realistic data rendering | `artifacts/airank/test/overview.test.jsx`, `artifacts/airank/test/navigation.test.tsx`, `artifacts/airank/test/scripts/offline-browser.mjs` | Actual frontend and app service with in-memory data; no production database |
| Billing | Not applicable: no app billing, checkout or subscription routes were found | Do not add simulated charge tests until billing exists |

## Commands

Run from the workspace root:

```sh
pnpm --filter @workspace/airank test
pnpm --filter @workspace/airank typecheck
cd services/bunny-api && pnpm test
cd ../.. && node artifacts/airank/test/scripts/offline-browser.mjs --check
```

The offline browser harness is available for local manual inspection at
`http://127.0.0.1:4178` when started with the documented script. It uses the
real frontend and backend service with synthetic in-memory data, blocks
outbound network access, and does not seed sessions. Do not expose it publicly
or point it at a preview or production API.

## Explicit boundaries

- Do not run a real `/v1/public-check/scans` request in CI: it can consume
  provider credits and is subject to live guest/domain quotas.
- Do not send real report email, start Google OAuth, sync a customer property,
  or test a charge in automated QA.
- Use injected provider, mail and Google connector fixtures for positive and
  failure cases.
- The offline fixture exercises real password authentication; it is not an
  authentication bypass and does not make the harness a production staging
  environment.
- The private GitHub Actions workflow and its six skipped test definitions
  remain unverified because this Repl did not receive a usable GitHub
  repository connection. Compare this map against those six cases when access
  is available rather than assuming a one-to-one match.
