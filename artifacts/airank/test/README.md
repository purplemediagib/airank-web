# AI Rank regression tests

Run `pnpm --filter @workspace/airank test` for the existing Node tests and the
overview component suite. The repository's `pnpm test` includes both.

The overview suite renders the real page, i18n provider, URL-backed filters,
Radix controls, provider tables/cards, and evidence drawers. Only API query
hooks, account/project selection, the separately tested saved quick-check
snapshot, and chart geometry are replaced. Fixtures are deterministic and
network-free; no account or API credentials are needed.

Coverage includes English/Finnish context and numbers, independent FI market
and Swedish measurement language, classification-based evidence drilldowns,
URL request parameters and composition resets, timestamp eligibility and
seconds/milliseconds, independent research states and retry, null versus true
zero metrics, and provider-specific values in both responsive render paths.

The responsive assertions protect the mobile/desktop breakpoint classes and
their data, not pixel geometry: jsdom does not lay out CSS. Trend chart geometry
and real server contracts remain outside this component suite.
