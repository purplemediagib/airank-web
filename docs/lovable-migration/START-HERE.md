# AI Rank → Lovable migration hand-off

## Purpose and limits

This is a source repository hand-off, not a deployment or completed migration. It preserves
the current app, including the latest overview improvements. It does not fix the
known provider-budget, locale, deadline or sentiment failures simply by changing
the frontend host.

The repository contains private application code: keep it private. Do not upload
it into the existing public backend repository.

No secret values, user sessions, customer records, database copies, dependency
directories or built app files are included. Live services and their configuration
remain on Bunny. Enter any required secrets only in the destination's secret
manager; never paste them into Lovable chat.

## Files in this package

| Location | Purpose |
| --- | --- |
| `docs/lovable-migration/LOVABLE-MASTER-PROMPT.md` | Copy the entire document into Lovable; it specifies preservation, integration, staged implementation and acceptance criteria. |
| `docs/lovable-migration/CONNECTIONS-AND-ENVIRONMENT.md` | Service map, server-side secret names, OAuth/domain changes and permissions. |
| `docs/lovable-migration/VALIDATION-AND-CUTOVER.md` | Reproduction commands, safe tests, known gaps and cutover/rollback. |
| `artifacts/airank/` | Complete current frontend: React source, assets, styles, translations, tests and configuration. |
| `artifacts/api-server/` | Current same-origin Express proxy and security tests. |
| `lib/` | Shared API clients, schemas and contracts, with original workspace dependencies. |
| `artifacts/mockup-sandbox/` | Existing design sandbox source, not a substitute for the actual app. |
| `backend-reference/` | Sanitised pinned GitHub source for the deployed 0.22.0 API, monitoring/content workers and Google connector. Includes tests and container definitions. |
| `inventory/` | Per-file checksums, source revision, static environment-name discovery, route inventory, exclusions and archive safety report. |

`services/` contains older local copies; these are reference
source, **not permission to downgrade the currently deployed backend**.
Use `backend-reference/` or its upstream repository for backend work.

## Supported import route

Lovable's documented Git sync cannot attach an arbitrary existing repository as
an import. It creates a new repository, then syncs changes made to that repository.

1. Create a new Lovable project for this migration. Keep the current app live.
2. Paste `LOVABLE-MASTER-PROMPT.md`. Explain that exact source is supplied and this
   is a migration, not a visual recreation.
3. Connect the new project to GitHub using Lovable's Git settings. Let Lovable
   create the repository. Ensure it is **private before adding this source**.
4. Wait until the project and GitHub say they are in sync.
5. Clone that newly created repository locally. Create a migration branch.
6. Import this repository's source on a migration branch, reviewing conflicts.
   Preserve the pnpm monorepo if the destination supports it. If Lovable requires
   a flat app, adapt `artifacts/airank/`, resolve the shared client imports from
   `lib/api-client-react/`, and preserve the original source as the comparison.
   This hand-off does not claim that a flattened Lovable build has been tested.
7. Preserve Lovable's Git history and platform metadata. Do not force-push, delete
   unrelated files, overwrite an unrelated application, or push the entire ZIP.
8. If the generated project uses TanStack Start or another stack rather than
   Vite, stop before replacing its framework scaffolding. Have Lovable explicitly
   retain a Vite-compatible project or adapt the routing/build boundary while
   preserving the original components, API contracts and business rules.
9. Install dependencies, generate a destination lockfile, run tests/typecheck/build,
   then open a PR. The original pnpm lockfile is at the repository root. Resolve
   catalog/workspace dependencies explicitly if making a standalone frontend,
   and preserve the resolved versions rather than upgrading during migration.
10. Merge only after review. Let Lovable sync the merged commit. Do not assume a
    new Git branch provides an isolated backend/database.

This private source repository can be cloned or downloaded as a ZIP on GitHub.
No separate portable frontend or ZIP import is claimed by this repository transfer.

## Architecture decision: keep Bunny for the first migration

```
Browser: existing AI Rank React UI
  → same-origin /api/airank/* and /api/public-check/*
  → existing security-preserving Express BFF / equivalent tested gateway
  → Bunny API → existing Bunny libSQL data and owner-scoped records
              → monitoring worker (daily + immediate tracked collection)
              → Content Studio worker
              → Google connector → GA4 / GSC
```

The browser does not talk directly to libSQL, supplier APIs, the worker or the
Google connector. Do not replace application login with Supabase/Clerk/Lovable
auth or migrate the database as an incidental part of this move.

Lovable's ability to edit/render the frontend is not proof that its hosting can
run the existing Node Express server or provide the required same-origin routing.
Choose and verify a host/gateway for that server explicitly. Retaining the
existing Replit proxy during a phased migration is an option, but cross-origin
browser calls to it are **not a drop-in replacement** for the current same-origin
cookie/CSRF architecture. Do not work around this with permissive CORS.

Keep the original workspace runnable as the reference while the Lovable project
is adapted. The host-specific proxy/domain boundary is the main remaining
implementation decision.

## Sources checked

- Live frontend: `https://app.airank.me` (deployment metadata checked during export).
- Backend source: `https://github.com/purplemediagib/airank.me`, pinned revision
  recorded in `inventory/SOURCE-REVISION.json`.
- Lovable Git sync: https://docs.lovable.dev/integrations/git-sync-overview
- Lovable API integrations: https://docs.lovable.dev/integrations/any-api

Platform documentation may change; recheck import/hosting support before cutover.
