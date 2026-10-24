# Verification — 21 October 2026

## Automated checks

- Bunny backend: 276 tests passed.
- Frontend: 6 Node tests and 103 Vitest tests passed.
- Full workspace type check passed; whitespace/diff check passed.
- Test-only offline startup assertions passed: real password login and session,
  rejected wrong password, anonymous 401, cross-owner 404, Origin/CSRF rejection,
  matching filters, occurrence evidence, zero schedulable work.

## Authenticated browser pass

Used only a loopback offline harness with actual frontend, backend, password
hashing/session checks and real in-memory SQLite. Synthetic data was visibly
labelled. Network, mail, OAuth, provider calls and collection writes were blocked.
This is not a real Google report or consumer-collector pilot.

Verified:

- Alice signs in through the real UI; Bob cannot read Alice's analytics or runs.
- OR/AND tags, FI market, English measurement language and surface filters;
  API/consumer comparison populations remain separate.
- Consumer fixture population: six answers; visibility five of six.
- Original answer drawer retains repeated citation occurrences and filter context
  through previous/next navigation.
- Traffic GA4 and GSC show actual setup-required state, not fabricated traffic.
- Desktop and 390px mobile navigation, keyboard date/menu interaction, EN/FI
  interface copy and refreshed session/filter persistence.

The first pass caught sidebar Results dropping filters. Fixed common navigation
context and Results composition scoping before totals/pagination. Targeted
follow-up using the same tester passed: Overview six answers → Results six tasks
→ detail/back still six → Sources five of six with explicit citations. Both
explicit group IDs and the default latest-group selection have regressions.

Non-blocking harness-only console noise: CSP-blocked fixture favicon and Vite
reconnect during server restart. The isolated server was stopped after testing.

Completion-check regressions were corrected and covered by backend fixtures:
saved pre-reconciliation group IDs resolve to canonical groups without changing
old evidence; a formerly mixed group resolves to one partition, never a pooled
metric. Grok/AIO provider product labels remain metadata, while both analytics
and Results use only `model_api`/`consumer_web`, preferring recorded collection
provenance and frozen routes over provider metadata.

## Not established

No production deployment/migration, real Google import success, Google review
approval, actual supplier invoice reconciliation, new paid consumer pilot,
recurring collector activation or full all-detected-brand Peec parity. See
PARITY-COVERAGE.md for outstanding broader scope and RECONCILIATION-ROLLOUT.md
for required operator gates.
