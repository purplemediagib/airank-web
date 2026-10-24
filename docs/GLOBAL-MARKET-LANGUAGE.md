# Global market and measurement language

Market and requested measurement language are independent of FI/EN interface locale. Existing identities/snapshots default to FI/fi only when context is absent. New identities store a language-neutral category and the legacy categoryFi alias with the same value. The alias no longer means that the value is Finnish.

## Coverage

The catalogue exposes 248 ISO countries/territories and ISO 639-1 language choices, including Bulgaria, Gibraltar, Swedish, Bulgarian, Arabic and Japanese. Russia is explicitly rejected as a market at validation and dispatch, not just hidden in the UI. Russian-language measurements in other markets are not automatically excluded.

These are **requested model contexts**, not certified language-quality guarantees. The currently routed OpenAI/Claude/OpenRouter calls receive explicit language and target-market instructions. They do not claim a geographically located browser or exact local Google results. Existing fixed Finnish benchmark/Google AIO routes remain fixed; no unsupported route is silently mapped to Finland.

Provider-account/service-access restrictions are separate from the market being researched. Official references checked during implementation:
- https://developers.openai.com/api/docs/guides/agents-api/tools/web-search
- https://help.openai.com/en/articles/5347006

Review configured provider/model documentation at each release. The country/language catalogue itself is not evidence that every provider supports every language equally well.

## Questions and future runs

Manual prompt saves snapshot the selected context. Monitoring and scheduled runs select only active prompts matching it. Old prompt versions, evidence and report snapshots stay unchanged. Language/market changes require new reviewed questions or explicit edits to existing questions; they never automatically translate questions or run paid scans.

FI/fi retains the existing deterministic suggestions. Other contexts use one explicitly requested, bounded OpenAI generation of six neutral questions, persisted per project identity version. Generated text is validated and remains a suggestion until accepted. Quick-check previews never call a model: non-FI/fi previews require existing reviewed active prompts in the selected context.

Generation uses the **API service's** server-only `OPENAI_API_KEY`. Optional `CONTEXT_PROMPT_MODEL` overrides the configured autofill model/default; verify model access before release. The generation request has an 11-second timeout, 1,800-token limit, 10 generations per account/day and 100 per deployment/day. Identical identity-version requests reuse saved results. Failed or interrupted calls are not silently replayed: manual prompt entry remains available, and explicitly editing the identity creates a new version for a future attempt.

Autofill snapshots context before fetching. Changing selectors invalidates arriving stale suggestions. Industry/category extraction requests the selected language, preserving brand spelling and requiring user review.

## Metrics

Run composition hashes include context and an updated extraction version. Reports use their saved run context. Mention and owned-citation matching remain language-independent literal evidence checks. Recommendation and ranked-position extraction is currently validated only for Finnish/English; other languages explicitly remain unknown, not false negatives.

## Deferred release

Apply additive `node src/common/context-migration.mjs` after the existing app migrations. It creates only the persistent question-draft cache; existing identity, prompt and job JSON snapshots carry the context without destructive backfills.

Deploy the compatible worker before the API accepts new-context jobs. Update the BFF/frontend together for the catalogue and fields. Keep execution flags off until the planned final image release and deliberate smoke test. No production migration, provider calls, image pushes or domain changes are performed by this implementation.
