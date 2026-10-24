# AI Rank

Finnish-market AI visibility monitoring for app.airank.me, with Finnish and English interfaces. Follow the numbered batches in the master specification in order and stop after each batch until instructed.

## AI Rank source of truth

- [Master specification](docs/AI-RANK-MASTER-SPEC.md): exact supplied build pack.
- [Implementation/action matrix](docs/IMPLEMENTATION-STATUS.md): all 37 FI/EN pairs and batch ownership.
- [Remaining batch preparation](docs/REMAINING-BATCHES.md): ordered scopes and acceptance checks; Batch 06 is source-implemented, next is Batch 07 only when instructed.
- [Batch 06 report](docs/BATCH-06-REPORT.md): derived metrics, dashboard/history and methodology are implemented in source; external analytics release remains separate.
- [Batches 07–08](docs/BATCH-08-REPORT.md): research and industry/scheduling extensions follow Batch 06.
- [Batches 09–11](docs/BATCH-10-REPORT.md): evidence actions, reports and persistent provider settings; QA coverage and limitations are tracked in docs/BATCH-11-QA.md. Do not start Batch 12 without instruction.
- [Final release delta](docs/FINAL-RELEASE-DELTA.md): accumulate Docker, migrations and environment changes; user wants one release after building, not intermediate rollouts.
- [API contract](docs/API-CONTRACT.md): existing source vs read-only deployed observations vs planned extensions.
- [Architecture decisions](docs/ARCHITECTURE-DECISIONS.md), [methodology](docs/METHODOLOGY.md), [deployment boundaries](docs/DEPLOYMENT.md).
- [Figma map](docs/FIGMA-MAP.md), [Batch 01 baseline audit](docs/BATCH-01-AUDIT.md).
- [Batch 03 report](docs/BATCH-03-REPORT.md) and [Bunny app release instructions](services/bunny-api/APP-RELEASE.md): auth/projects code is implemented but external activation and live Google verification are pending.
- [Batch 04 report](docs/BATCH-04-REPORT.md): confirmed owned quick checks are implemented and fixture-tested; no live provider execution or external migration has occurred.
- [Batch 05 report](docs/BATCH-05-REPORT.md): tracked prompts and durable monitoring are implemented; operator activation remains separate from fixture verification.
- Reuse Bunny libSQL, Google identity, worker and private evidence storage. The PostgreSQL/Drizzle packages below are unused starter scaffolding, not the AI Rank database. Do not initialize or replace the authoritative database.
- Preserve the separate marketing site and guest checker. No publishing, DNS changes, production migrations/resets, paid scans or automatic panel activation during development.
- Approved Figma, Figtree and AI Rank colours govern visuals; no production demo metrics. Product access is free; operational capacity is not a subscription tier.
- FI/EN is interface locale, not measurement language. Preserve Finnish prompts, market, original answers and history on language changes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm test` — offline supplied-release tests and audit-document integrity (not app integration tests)
- `pnpm lint` — formatting checks for audit documentation/tooling only; app semantic lint is not configured yet
- Do NOT run the starter `@workspace/db push` command for AI Rank. Authoritative DB access uses Bunny configuration in the existing backend.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Bunny libSQL for AI Rank; PostgreSQL/Drizzle is unused starter scaffolding
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
