# Intelligent workspace suggestions — 0.21.0

Source prepared, not deployed. Update BOTH the API and monitoring worker.
The Google connector is unchanged.

## Before activation

- Back up the existing database using your normal operator procedure.
- Build separate API and worker images from this source, using the existing
  Dockerfiles and repository `vtcarrie/bunny-mcp-connector`, with tags
  `airank-api-0.21.0` and `airank-worker-0.21.0`.
- Apply additive migration `app-018-intelligent-suggestions` after the existing
  app migrations. Existing deployments may use the explicit API startup setting
  `AIRANK_RUN_APP_MIGRATIONS=true`; confirm the log says migrations 001–018
  verified successfully, then return the setting to its previous value.
  Alternatively run `node src/monitoring/suggestions-migration.mjs` with the
  same database configuration after all prior migrations.
- Preserve all existing monitoring, scheduler, collection, credentials and budget
  settings. Suggestion generation now uses `OPENAI_API_KEY` on the API for all
  languages including Finnish. Optional model configuration:
  `CONTEXT_PROMPT_MODEL`, otherwise `WEBSITE_PROFILE_MODEL`, otherwise the existing
  generator default. Never place these secrets in frontend configuration.
- Publish the matching frontend after the API is ready.

## Behaviour

Prompt suggestions propose four non-branded and two branded drafts, with topics.
Users review/edit/accept each draft. Both types use the existing tracked prompt
allowance and provider budgets; daily and immediate collection now include
separate branded runs. Adding branded prompts therefore increases collection
usage. Existing public guest checks stay non-branded.

Discovery visibility and comparable analytics remain non-branded only.
Branded answers are available in prompt/run details, not merged into those scores.
No historical evidence or competitor cohorts are rewritten.

Competitor suggestions are unverified AI proposals. Only explicit user-reviewed
domains become tracked ownership evidence. Accepted competitors apply to future
collections, not historical answers. Source publisher classifications use curated
hosts and restricted namespaces, with user overrides taking precedence. Unknown
websites remain unknown; no paid classification is triggered by opening a page.

## Smoke check after rollout

1. Confirm API and worker health report 0.21.0 and the migration log includes 018.
2. In a test workspace generate suggestions; verify 4/2 mix and topics. Generation
   is a paid AI call, subject to existing daily draft limits.
3. Edit and accept one draft of each type; reload and verify text/type/topic.
4. Verify immediate runs collect both types within configured budgets. Branded
   answers must be visible but excluded from discovery visibility.
5. Generate competitor suggestions, review a domain and accept. Reload and verify
   the tracked competitor. Check source favicons, category override and fallback.

No production migrations, paid generation or provider collections were run as
part of implementation verification.
