# Validation and cutover

## Reproduce the original frontend/proxy

Use Node 24 and pnpm 10.26.1. The source uses pnpm workspace dependencies and a
catalog; running npm install in an individual artifact is not equivalent.

```sh
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install --frozen-lockfile
pnpm run test:release
pnpm run build:release
```

`test:release` combines release-readiness script tests, actual BFF/proxy tests and
frontend tests. Most frontend cases use synthetic data or simulated transport.
They do not prove live supplier, mail, database or Google success.

The older root `pnpm test` additionally runs a historical baseline audit against
original uploaded release archives. Those historical uploads are deliberately
excluded from this private source hand-off. Use `test:release` for the supported
current frontend/proxy verification; this is not a claim that the archive audit
can run without its separate original inputs.

The last verified app-source baseline before the source transfer had:
- 5 release-readiness tests passed.
- 27 proxy/security tests passed.
- 6 frontend Node tests passed.
- 172 frontend Vitest tests passed.
- Total: **210 passing automated tests**, plus a separate isolated signed-in
  desktop/mobile overview browser pass.

These are recorded prior results, not a claim that Lovable has run the suite.
Record fresh results when importing or modifying the source.

## Isolated browser harness

The normal Replit preview points at real backend services. Do not use it for
unapproved mutations or collection.

```sh
node artifacts/airank/test/scripts/offline-browser.mjs --port=4178
```

This starts the actual UI/API with an in-memory synthetic fixture database,
normal fixture email/password authentication, blocked outbound traffic and zero
schedulable paid work. It prints synthetic login instructions on startup.
Follow `artifacts/airank/test/scripts/README.md`.

For the authoritative Content Studio implementation, use the pinned source:

```sh
node --test backend-reference/app/test/content*.test.mjs
node artifacts/airank/test/scripts/offline-browser.mjs \
  --check --content-source="$PWD/backend-reference/app"
```

Use the same source path without `--check` when interactively verifying the
isolated Content Studio UI. Do not claim synthetic fixtures prove production
Google-review consent/imports or consumer-collection parity.

## Production acceptance requires separate approval

Do not run the live readiness command automatically as an install/build hook.
It is read-only, but reaches production:

```sh
pnpm run check:live
```

Before any real scan, mail, import, content generation, account creation or
settings mutation, obtain approval for the exact operation, owned test workspace,
usage cap and allowed external services. A fresh Git branch is not staging.

No dedicated QA account, isolated live database or staging origin is supplied in
this repository. Configure them explicitly if needed; do not add an auth bypass.

## Remaining known application gaps

Source transfer is not a fix for:
- Direct-model budget prerequisites, including Claude and Google AI Overviews.
- Incomplete Claude output.
- Consumer catalogue/locale failures and unsupported market/language combinations.
- Queued-task and supplier completion deadlines.
- Failed/invalid sentiment analysis.
- Older snapshots without reviewed competitor cohorts or prompt topics/tags.
- Capability-disabled report email or billing integrations.

See the current overview collection-readiness document for diagnostic categories.
Recheck current production before treating historic failures as current config.
No silent retries, historical rewrites or expanded budgets are allowed.

## Cutover sequence

1. Keep the current app and Bunny services running.
2. Import source into the private destination; build and verify offline.
3. Choose a host for the Node proxy or prove an equivalent server gateway.
4. Configure same-origin API routing and exact approved preview OAuth client.
5. Configure only required server-side secrets through the host's secret manager.
6. Verify signed-out rejection, login/session/logout, ownership and read-only
   analytics with a dedicated account.
7. Run separately approved small live acceptance checks and inspect persistence.
8. Verify EN/FI routes, mobile/desktop layouts, callbacks, email destinations,
   Google settings/Traffic and the marketing embed.
9. Obtain approval before publishing, DNS/canonical-domain changes or disabling
   the original deployment.

Keep an explicit rollback: restore the former frontend/proxy host routing and
approved origin configuration. Do not restore an old database or delete current
records as part of a frontend rollback.

## Security review before every push

Exclude real environment files, credentials, production/customer data, database
dumps, OAuth registrations/tokens, cookies/storage state, cached pilot outputs,
Git history, installed dependencies and compiled output. Templates must contain
names/placeholders only. Verify both the staging index and GitHub visibility.

The transfer tool creates per-file hashes and a scan report. This is an additional
safeguard, not a guarantee that arbitrary future additions are safe. Keep the
repository private and review new assets/fixtures before committing.
