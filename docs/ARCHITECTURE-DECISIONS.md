# AI Rank architecture decisions

Status: Batch 01 design decisions, 2026-10-12. Not implemented unless explicitly stated.

## 1. Preserve the authoritative services

Use browser → same-origin Express BFF → Bunny API → existing Bunny libSQL database/jobs → Bunny worker → configured providers/private Bunny Storage.

**Why:** The archive has an existing identity, scan history and benchmark system. The workspace's unused PostgreSQL/Drizzle starter is not the application's database. Do not initialise it, migrate into it or create a second source of truth.

Source: uploaded API `src/common/db.mjs` imports `@libsql/client/web`; migrations define users, sessions, oauth_states, scan_jobs, scan_profiles, scan_prompts, observations, provider_calls and rate_events. Worker benchmark schema defines bm_industries, bm_panels, bm_brands, bm_prompts, bm_schedules, bm_runs, bm_jobs, bm_attempts, bm_mentions and bm_citations. Live readiness proves a database query works, not that every proposed table exists.

## 2. Smallest compatible application

The local repository contains a generic Express health service, a React/Vite component-preview sandbox, shared API generation and an unused DB starter. It contains no AI Rank frontend, auth integration or guest-checker implementation. The website/checker are external; preserve them.

Batch 02 will create one React/Vite application at the root preview path, not repurpose the canvas sandbox and not create a new app per batch. Use TypeScript, the existing OpenAPI/Orval shared client, React Query, a standard router, accessible primitives customised to the approved Figma and FI/EN dictionaries. Retain Express for the BFF. Keep app routes under `/:locale/dashboard`, `/:locale/start`, `/:locale/settings`, and `/:locale/sign-in`. Feature pages nest under dashboard, preserving the upstream return-path allowlist.

Batch 01 adds documentation and offline audit checks only. No frontend scaffold or new application contract code is claimed.

## 3. Identity and preview/production login

Batch 03 refinement: implement the registry-bound flow as separate /v1/app/google/start and /v1/app/google/callback endpoints, plus app_oauth_states and __Host-airank_app_oauth. Reuse the existing users/sessions table and __Host-airank_session cookie, but leave legacy /v1/auth/* handlers and oauth_states untouched. **Why:** this avoids accidentally consuming a new app state with the legacy single-callback handler or altering the marketing checker's existing login. App mutation CSRF comes from /v1/app/session and is derived from the opaque session, not a second identity system. Deployment instructions are in services/bunny-api/APP-RELEASE.md.

Reuse existing Google identity and opaque hashed sessions; do not add Clerk, Replit Auth or a separate password system.

Current source: OAuth start creates a 10-minute DB state with PKCE verifier/nonce and an HttpOnly state cookie; callback checks cookie/state, consumes state, validates Google's RS256 token/issuer/audience/expiry/nonce/verified email, reuses google_sub, creates a random session whose hash is stored in sessions, and redirects to APP_URL plus a safe return path. Secure cookie is `__Host-airank_session`, Path=/, Secure, HttpOnly, SameSite=Lax, with no Domain. Session lookup is server-side. Source default lifetime is 14 days, not a verified deployed value.

**Problem:** A cookie issued on bunny.run is not an app.airank.me or preview cookie. The current callback URL and APP_URL are single configured values. Changing production values to a preview host would disrupt existing login.

**Chosen extension for Batch 03:** Bunny owns OAuth and sessions. Add a server-configured, exact origin/redirect registry for app, preview and existing website clients. BFF auth start selects a configured client, never an arbitrary origin; Bunny binds client, redirect URI and safe return route into OAuth state. Browser receives state/session Set-Cookie only via its same-origin BFF. Google callback goes to that client's `/api/airank/v1/auth/google/callback`; BFF forwards only the recognised state cookie/query. Token exchange uses the exact redirect URI recorded in state. Response redirect is rebuilt from the bound client and allowlisted relative return path. Legacy direct checker login continues using its existing default client and callback.

Forward only named AI Rank cookies to fixed upstream routes; never all browser cookies. Preserve individual Set-Cookie headers/expiry and host-only Secure policy; do not add Domain to a __Host cookie. Clear state after callback; clear/revoke session on logout. BFF and upstream must reject disallowed/missing Origin for authenticated mutations, require a session-bound CSRF token, JSON content type and appropriate body limits. OAuth callback is exempt from mutation CSRF and relies on one-use state/PKCE/nonce. CORS alone is not CSRF protection. Do not trust a browser user_id or an incoming client-origin header. Only a configured client registry may choose redirects. Do not log cookie, query-code or private payload data.

Preview needs a stable approved HTTPS callback and Google OAuth allowlist configuration; production needs its separate approved callback. No configuration changes in this batch. Implement fixture tests independently; real two-account tests require access later.

## 4. Proxy contract and trust boundaries

Expose `/api/airank/v1/*`, mapping only explicit method/path pairs to the fixed Bunny API. No arbitrary upstream URL, redirects followed blindly, generic wildcard forwarding or no-cors workaround. Use abortable timeouts, bounded request/response sizes and filtered headers. Preserve HTTP status and safe machine error codes; retain original errors server-side only after redaction. Guest X-Scan-Token is a separate per-request credential and stays in browser memory. It must never become a session or an ownership assertion.

Default read timeout proposal 15s and JSON body maximum 64KiB for new management APIs; existing checker retains 3,000-byte source limit. Raw/export endpoints get dedicated limits/streaming and authorization. Reject unsupported backend capabilities explicitly; never serve invented observations.

## 5. Additive migrations and ownership

Keep users/sessions/scans/bm_* intact. Introduce a migration ledger with ordered IDs/checksums and additive tables/indexes. Proposed phases:

1. Batch 03: projects, immutable identity versions, account preferences, audit events, OAuth client binding.
2. Batch 04: owned project-to-scan linkage, atomically created with new scans.
3. Batch 05: tracked prompts/versions, suggestions, monitoring snapshots/tasks, idempotency records and atomic budget reservations. Reuse benchmark job principles rather than creating another measurement service.
4. Batches 06–07: extraction versions/spans, versioned cohorts and evidence-linked discovered candidates; aggregates computed from eligible observations.
5. Batch 08: panel lifecycle/admin authorization and project schedules, retaining existing benchmark snapshots/history.
6. Batches 09–10: opportunities/change events and private report snapshot/job records.

Each owned operation derives user identity from session and checks parent project ownership, including nested IDs, exports and evidence. Panel administration requires server-granted privilege, never a client flag. SQL is parameterized. Prefer archive over destructive deletion. No automatic backfill assigns guest scans to users. Unknown classifications remain null.

Migration checks: copy of representative data, row counts, referential integrity, repeatability and mixed-version compatibility. No migration runs against live data during development. Rollback is code rollback first; do not drop newly populated tables as a routine downgrade.

## 6. Worker preservation and required reliability extensions

Quick checks use atomic conditional job claims but serial prompt/provider execution; lease is refreshed before each call. Budgets are count-then-insert, not safe concurrent reservations. Existing observation presence prevents normal reruns, but a crash after dispatch and before persistence can repeat a call. The persistence SQL has an upsert; future ownership/fencing must prevent concurrent overwrites.

Benchmarks already have write transactions, unique panel/slot and job keys, frozen route/model/panel snapshots, interrupted-delivery states and durable staged payloads for storage-only retry. Scheduling uses Monday/Thursday 08:00 UTC. Preserve these strengths.

Gaps: no bounded parallel execution; jobs excluded by permanent per-run capacity can remain queued indefinitely; storage retries have no overall deadline; quick-check raw-storage failure only warns and can leave a null key. Add fenced renewable leases, atomic shared reservations, bounded concurrency, dispatch uncertainty states, whole-run deadlines and explicit terminal/resumable capacity outcomes. Never rerun a paid provider call to retry storage. Test these before increasing monitoring volume.

## 7. Product invariants

One FI-first application with complete EN translation. UI locale never changes FI market, prompt language or original answers. No paid tiers. Operational budgets remain configurable and are not commercial quotas. Figma is the visual reference, never a source of real metrics. Null is not zero. Monitoring classifications/versioned denominators remain distinct from the confirmed checker. Stop after each numbered batch until instructed; never auto-publish, reset data, change DNS or launch mass scans.
