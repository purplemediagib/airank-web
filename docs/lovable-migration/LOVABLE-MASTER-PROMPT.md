# Copy everything below into Lovable

You are migrating my existing **AI Rank / airank.me** application. This is an
existing product with real backend services and a substantial codebase. It is
**not** a request to generate a similar-looking prototype.

## 1. Read the supplied source before changing it

Read START-HERE.md, CONNECTIONS-AND-ENVIRONMENT.md, VALIDATION-AND-CUTOVER.md,
inventory/SOURCE-REVISION.json and the root package/workspace configuration.

The repository contains:
- The current original pnpm monorepo at the root.
- Complete UI source/assets at artifacts/airank/, the Express proxy at
  artifacts/api-server/, and the shared client/contracts at lib/.
- The authoritative pinned GitHub backend under backend-reference/.
- Existing tests and detailed migration instructions. A flat Lovable adaptation
  has not yet been built or verified.

If attachments cannot be unpacked in your environment, say exactly that. Do not
claim to have imported files you cannot read. Ask me to add the source files
through the private repository created by Lovable, then continue from those real
files. Git sync does not directly import an arbitrary existing repository.

If my newly created project has a different framework, report the difference
before overwriting it. Do not silently convert the app to Next.js, invent an
SSR requirement, or substitute a new authentication/database provider.

## 2. Objective and authority

Reproduce the application as it exists in the supplied code, preserving routes,
appearance, language support, data contracts, ownership/security checks and
behaviour. The existing source is authoritative. Screenshots are only secondary
references. Do not redesign, simplify away functionality, generate replacement
dashboards, or present sample metrics as real measurements.

Preserve the current navy/cyan AI Rank branding, logo and favicon, supplied
platform logos in their original colours, sizes/alignment conventions, component
library, typography, spacing and responsive behaviour. Do not replace official
platform logos with generic stars or text initials. Keep English and Finnish
translations and the locale in navigation URLs.

Do not expose supplier names such as "direct" or "OpenRouter" as customer-facing
platform names. Keep the truthful distinction between consumer-web observations,
model-API answers and search-result observations in methodology/evidence where
required. Never claim those are interchangeable.

## 3. First deliver an import inventory

Before implementation, return:
1. Which files you actually imported.
2. Any missing assets or unresolved imports.
3. Framework/dependency differences from the source.
4. Exact plan for the same-origin backend gateway.
5. Which server configuration items require operator action.
6. Which checks can run offline versus those requiring later approval.

Work in small reviewable commits, preserving the existing repository history.
Do not make a public repository, force-push, deploy or change DNS without my
approval. Do not push private frontend/proxy source into the public backend repo.

## 4. Preserve the frontend architecture

Original main frontend: artifacts/airank/.
Original shared generated API client: lib/api-client-react/.
Original Zod/OpenAPI contracts: lib/api-zod/ and lib/api-spec/.
Original BFF: artifacts/api-server/.

The frontend uses React, TypeScript, Vite, Tailwind, Radix/shadcn components,
Wouter, TanStack React Query, Recharts, TipTap and the generated typed API client.
The source resolves @workspace/api-client-react as a pnpm workspace package.
Preserve that dependency in a monorepo, or explicitly alias/bundle its real source
when flattening. Do not replace generated client types with any or hand-written
incompatible response shapes.

Keep the installed major versions unless a change is necessary and tested.
Use the supplied pins; do not perform a broad dependency upgrade while migrating.
The original pnpm lockfile and dependency catalog are the reproducible baseline.
Do not copy Replit-only dev plugins into a non-Replit host.

## 5. Routes and navigation

Read App.tsx and src/features/content routing; do not assume route names.
Preserve both /en/ and /fi/ variants:
- /sign-in and /sign-up (public).
- /free-check/embed and /report/:token (public, isolated from account bootstrapping).
- /dashboard (authenticated overview).
- /dashboard/prompts and /dashboard/prompts/:id.
- /dashboard/results and /dashboard/results/:id.
- /dashboard/perception.
- /dashboard/competitors and /dashboard/competitors/:id.
- /dashboard/sources.
- /dashboard/traffic.
- /dashboard/evidence/:id.
- /dashboard/industries and its detail routes.
- /dashboard/opportunities and its detail routes.
- /dashboard/history.
- /dashboard/reports and its detail routes.
- /dashboard/methodology.
- /dashboard/content and all existing nested Content Studio routes.
- /settings (including the current query-parameter tabs).
- /start.

Configure deep-link fallback without swallowing /api/* or asset 404s. Keep
project/group/run/filter query parameters and the selected locale on reload.
Do not expose the development component playground in production.

## 6. Backend boundaries: do not replace working services

Retain the existing Bunny services and database first. The full service map is
in CONNECTIONS-AND-ENVIRONMENT.md. Keep:
- API on mc-u87t7nkvtg.bunny.run.
- Monitoring worker on mc-0wuu8m6e4z.bunny.run.
- Content worker on mc-a793cb4lba.bunny.run.
- Google connector on mc-kvj7j25914.bunny.run.
- Existing Bunny libSQL database, accessed only by authorised backend services.

The browser calls relative /api/airank/* and /api/public-check/* URLs.
Those routes need the existing Express gateway or a genuinely equivalent
server-side implementation. Static hosting alone is insufficient.

Do not expose database tokens, provider keys, Google client secrets, Resend
credentials, signing secrets or connector keys in browser code or VITE_* vars.
Do not directly query the production database from the frontend.
Do not create a new database, schema migration or auth tenant without approval.

Preserve the gateway's exact allowlisted routes and methods, error envelopes,
timeouts, response-size bounds, body limits and supported query parameters.
Unknown routes must remain rejected rather than becoming an open proxy.
Content routes have their existing larger body allowance; do not increase all
routes to match it. Keep the signed public-checker proof and trusted-IP policy.

If using an edge/server-function rewrite, first prove equivalent behaviour
against the existing proxy tests. Do not hand-wave Node/Deno runtime differences,
Set-Cookie handling, redirects, cryptography, body streaming or execution limits.
An external Node gateway is preferable to a risky unverified rewrite.

## 7. Authentication, sessions and permissions

Preserve existing backend-owned email/password sign-up/login, email verification,
password reset, Google app sign-in and logout. Read the actual generated client
and BFF route implementations; do not invent a /login endpoint.

Preserve secure HttpOnly host-scoped cookies, SameSite policy, CSRF tokens,
origin checks and OAuth state. Forward only the currently allowlisted cookies.
Do not put sessions/tokens in localStorage or add a developer-login bypass.
Registration requiring email verification is not a successful logged-in session.
Only explicit backend capability flags enable unavailable auth methods.

Handle pending, signed-out and failed session fetches separately. A backend
error must not masquerade as signed out. On 401/logout, clear user/project query
caches; prevent late responses from restoring a previous user's data.

Protect project ownership on the server for reads and mutations. Browser-supplied
project IDs or query flags must never override ownership checks.

Before a preview origin can work, register the approved web client and exact
callback/origin on the existing backend and Google OAuth configuration. This is
an operator action, not something to bypass by relaxing security.

## 8. Workspace onboarding and collection

One workspace has one tracked prompt set. Users can create multiple workspaces;
there is no workspace-count limit for now. Plan limits may be added later using
the existing capability model, not invented hard-coded restrictions.

Preserve onboarding identity review, website autofill review, independent market
and language selection, prompt editing, branded/non-branded labels and proposals
for competitors and topics. Proposed competitors require explicit review.

New projects and new tracked prompts use existing immediate-collection
deduplication and budget gates. Daily monitoring runs at the configured Helsinki
time. Do not introduce a second parallel "quick check" prompt set for signed-in
workspaces. Preserve legacy/public-check history without merging it into current
tracking metrics.

Never start paid collection on page view, import, refresh, health checks or
automatic retries. Never resubmit an ambiguous supplier task without reconciliation.

## 9. Overview: preserve the latest repairs

Keep the new overview-trends helper, MetricTrend and DataAvailability components.
Keep:
- Brand lines within one frozen compatible group, not composition groups as brands.
- Visible recommendations and normalised visibility-score cards.
- Metric switching for visibility, share of voice, sentiment, citations,
  recommendations, tracked-brand position/win rate and explicit list rank.
- Null gaps for missing observations, genuine zero values and snapshot messaging
  when there is only one observation.
- Same group/run selection for KPIs, trends, source impact and evidence.
- Clearly disclosed fallback to a usable group only without explicit group/run
  selection. Do not override an intentional deep link.
- Clear failures/coverage and missing frozen cohort/topic metadata explanations.
- Full readable KPI denominators on mobile and graphs before detailed diagnostics.
- An accessible chart-table alternative.

Do not generate historical competitor lines from today's competitor list.
Do not combine incompatible models/methodologies/cohorts to make a fuller graph.
Do not turn incomplete, failed, unsupported or missing answers into zero visibility.
Do not calculate a new sentiment score from unassessed answers.

## 10. Results, perception and evidence

Keep original saved answers immutable and accessible with their actual provider,
time, locale, status, citations and evidence. Preserve filtering, pagination,
prompt/version navigation and permission checks.

Sentiment requires valid exact quotes and a comparable analysis version/model.
Keep queued/running/failed/unclassified/not-mentioned states distinct. Missing
sentiment is not neutral. Backfill/reanalysis is an explicit budgeted write.
Keep tracked-brand rank distinct from explicit ranked-list position.

Preserve source/citation/link distinctions, provenance, observable denominators,
source-type classification/manual overrides and unknown categories. Favicons
are decoration, not proof that a domain belongs to a particular brand.

Keep benchmarks/opportunities/report features as implemented; do not invent live
data or enable functionality solely because a screenshot contains it.

## 11. Google Analytics and Search Console

Google data import consent is separate from app Google sign-in.
Keep the separate connector responsible for Google OAuth tokens and background
imports; the app API remains responsible for the authorised owner/project identity.
Do not change the stable connector workspace namespace or orphan connections.

Preserve independent GA4/GSC connect, property selection, sync, progress,
failure/recovery, cached report and disconnect states. Display imported data on
Traffic, not just a "Connected" badge in Settings. Distinguish AI referral traffic
from AI-answer citations and do not claim prompt-level attribution where absent.

Domain changes may require return URL/origin/OAuth registration updates. Record
the exact operator steps and stop for approval. Never copy real access/refresh
tokens into the project. Offline fixture screenshots are not Google-review evidence.

## 12. Content Studio

Read the actual artifacts/airank/src/features/content/ implementation and backend app/src/content/
contract. Preserve its existing list/project/editor/generation/job/review and
other nested workflows, EN/FI text, rich editor, status handling, version/conflict
handling and capability/permission gates.

Content processing remains on its separate worker. The browser does not call the
worker directly. Do not trigger paid text/image generation during migration,
testing, initial render or automatic retry. Do not substitute Lovable AI billing
for the existing services without a separate product decision.

## 13. Free checker, email and billing

Preserve the public checker validation, review/confirmation, caps, email gate,
capability-driven report delivery and immutable report-token access. Unsupported
email delivery must be shown honestly, not simulated as success.

Preserve the separate Framer embed integration, approved frame ancestors, report
noindex/no-referrer/no-store rules and redacted report tokens in server logs.

Keep existing plan/capability/billing states. Do not invent paid plans, unlimited
provider spend, checkout, subscriptions or a new payment processor. Where billing
is not configured, test the existing disabled behaviour instead of fake checkout.

## 14. Known gaps are not migration successes

The previous inspection found provider API-budget failures, Claude truncation,
consumer-locale/catalogue errors, supplier/queue timeouts, failed sentiment and
older runs without frozen competitor/topic metadata. These must remain truthful
partial/unsupported/unavailable states.

Move the app first; do not silently spend money repairing historic measurements,
raise budgets, relax quote validation or rewrite stored evidence.
Propose backend fixes separately against backend-reference/ or its upstream,
not older services/ copies.

## 15. Implementation order

Phase A — import actual source/assets, resolve aliases and pinned dependencies,
typecheck/build, verify routes and unchanged visuals using isolated fixtures.

Phase B — select and implement the same-origin gateway hosting boundary;
preserve/prove proxy tests and request/response/security contracts. No live writes.

Phase C — operator registers an isolated approved origin/client and configures
server-only secrets. Use a dedicated account/test-owned workspace. Do not assume
either currently exists.

Phase D — verify real login/logout/session and authorised read paths only.
Email, scans, content generation, writes and Google sync require separate
approval and spending/usage bounds.

Phase E — publish/cut over only after I approve the documented host/DNS/OAuth
plan and acceptance results. Retain a tested rollback.

## 16. Acceptance checklist

Run the supplied tests. Report actual command results and distinguish skipped,
blocked, simulated and live checks.

- UI source/assets preserved; no missing icons, broken fonts or unresolved imports.
- EN/FI routing and deep links work after reload.
- All protected routes reject anonymous users.
- Login failures do not leak information; logout/401 clear all protected caches.
- Other-owner project reads and writes fail.
- Validation, email gate, free-checker caps and disabled capabilities match source.
- Dashboard contains correct compatible groups, brand labels, denominators, null
  gaps, partial failures, metric switching and exact run drill-downs.
- Prompt/project/competitor/topic changes persist through normal APIs in an
  isolated environment; current history is unchanged.
- Google connection/import/Traffic states match actual responses.
- Content Studio routes and job states remain connected to the current API.
- Billing/permissions remain capability driven.
- At 390px and desktop, menus, actions, data tables and dialogs remain usable.
- No server secret/session/customer record appears in browser bundles, source,
  screenshots, logs, commits or reports.
- No unauthorized scans, email, charges, live mutations or deployments.

Do not finish with "everything works" based on a static landing page or green
health endpoint. Provide a file-change summary, actual passing counts, blockers,
operator steps and explicit readiness decision for each phase.
