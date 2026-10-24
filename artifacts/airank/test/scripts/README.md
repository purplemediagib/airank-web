# Isolated offline browser verification

This test-only harness serves the **actual AI Rank Vite frontend** and calls the
current backend `createAppService` directly for same-origin `/api/airank` requests.
It does not use the normal preview API, production database, or a frontend API
mock. All seeded data is **synthetic fixture data, never Google review evidence**.
The frontend source and backend imports are loaded fresh on each process start.

## Start and stop (from the repository root)

```sh
# API/auth/schema assertions only; no browser or listening server:
node artifacts/airank/test/scripts/offline-browser.mjs --check

# Foreground (Ctrl+C stops it):
node artifacts/airank/test/scripts/offline-browser.mjs --port=4178

# Alternatively, start a background process; output and PID are ignored:
mkdir -p artifacts/airank/test/scripts/.offline-generated
nohup node artifacts/airank/test/scripts/offline-browser.mjs --port=4178 \
  > artifacts/airank/test/scripts/.offline-generated/server.txt 2>&1 &
echo $! > artifacts/airank/test/scripts/.offline-generated/server.pid
cat artifacts/airank/test/scripts/.offline-generated/server.txt

# Stop that background process:
kill "$(cat artifacts/airank/test/scripts/.offline-generated/server.pid)"
```

No browser is launched. Open **http://127.0.0.1:4178/en/sign-in** manually when
ready. Use exactly `127.0.0.1`, not `localhost`, a public preview URL, or a proxy.
If running in a remote workspace, forward port 4178 to your machine with a
localhost tunnel that preserves `Host: 127.0.0.1:4178`; without such access,
this loopback-only harness is not reachable in your browser. Do not expose it
publicly or substitute the production preview. The process refuses an occupied
port, unexpected Host, unknown CLI arguments, failing migrations, or startup
assertions rather than falling back elsewhere.

**Test-only login:** `offline-alice@example.test`  
**Password:** `Offline fixture password 42!`  
**Other owner:** `offline-bob@example.test` (same test-only password)

Both accounts are seeded with the backend's real scrypt password hash in the
real email-credential schema. There are **no pre-seeded sessions**. Sign in using
the actual email/password form. The service validates the password and creates a
real hashed session; the frontend obtains the real session CSRF token.
Bob has a separate empty project and cannot read Alice's data.

## URLs and expected results

All paths below use `http://127.0.0.1:4178`; replace `/en/` with `/fi/` for Finnish.

- `/en/dashboard`: project `offline-fixture-alice`, brand **Fixture Atlas**,
  market FI, measurement language English. Four frozen runs, three prompts.
- `/en/dashboard/prompts`: topics **Price**, **Support**; tags **comparison**,
  **fixture**, **service**; providers **openai**, **claude**. Provider/model
  names identify synthetic fixture context, not actual calls.
- `/en/dashboard/results`: 24 observations: **22 successful**, **1 skipped**
  (`not_configured`), **1 failed** (`provider_failed`), no queued/running tasks.
  Provider `claude` + topic `Support` returns four results.
- `/en/dashboard/results/offline-run-0-2`: complete synthetic API answer with
  no citations (`not_observed`), distinct from a failed/unavailable answer.
- `/en/dashboard/sources`: synthetic `.example.test` sources, including repeated
  citation occurrences in the stored observation. Do not navigate external
  source links; these are non-production fixture URLs.
- Analytics filters include topic, provider, tag, prompt/version, dates, and
  **model_api** versus **consumer_web** surfaces. The consumer surface is
  explicitly synthetic (`supplier: offline_fixture`), not scraped evidence.
  Composition groups remain separate; 24 is the result-list total, **not**
  the default selected analytics group's denominator.
- `/en/dashboard/traffic`: the real backend returns `configured:false`,
  `connected:false`, `status:setup_required` for both GA4 and Search Console.
  There are **no fabricated Google reports, traffic counts, or connections**.

The printed startup JSON includes exact UTC observation dates (today and the
two preceding dates). Select that inclusive range if your browser timezone/date
defaults exclude a row. Evidence timestamps are anchored once at startup.

## Isolation and limitations

- Literal in-memory `node:sqlite` database using the serialized-transaction adapter
  from the existing backend tests; real migration functions and checksums.
  No dependency installation or libsql client package is needed.
  No database URL/config is accepted from the environment or CLI.
- Inherited config is discarded before importing the backend or Vite. Only
  explicitly fake email-auth readiness config is passed to the service.
  Mail, Google exchange, and token verification are injected fail-closed
  functions, not fake success responses.
- Node outbound sockets, fetch, HTTP(S), and DNS are blocked process-wide.
  No worker is imported or started. All seeded tasks are terminal; immediate
  trigger outbox entries are cancelled; schedule/scan/collection queues are empty.
- Vite uses a dedicated test config, `configFile:false`, `envFile:false`, no
  preview proxy, no Replit plugins, and an ignored test-only cache.
- A browser CSP blocks remote scripts, fonts, images, frames, forms and fetches.
  Remote font imports/preconnects are removed in the test Vite transform only;
  offline typography may differ from production. No browser automation runs.
- Only login/logout and real preference writes are allowed. Other mutations
  explicitly return `OFFLINE_FIXTURE_READ_ONLY` (or `AUTH_REQUIRED` anonymously);
  this prevents UI actions from adding schedulable jobs or mailing anyone.
- The **test transport only** renames `__Host-` cookies to port-specific local
  HttpOnly cookies and removes Secure for plain loopback HTTP, translating back
  on requests. Origin and CSRF validation are **not bypassed or rewritten**.
  Production cookie/auth code is untouched.
- Every startup asserts real wrong-password rejection, unauthenticated 401,
  cross-owner 404 on project/analytics/results/prompts/runs/connections, missing
  CSRF and foreign-origin 403, filtering, real Traffic setup-required state, and
  zero schedulable work. Validation sessions are logged out before listening.
- This harness is not a production auth/cookie-security certification and its
  data must not be submitted as Google OAuth/review evidence.
