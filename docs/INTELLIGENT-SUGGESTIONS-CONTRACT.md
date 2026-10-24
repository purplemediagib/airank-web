# Intelligent workspace suggestions contract

Authenticated existing routes only (public free-check unchanged):

- `POST /v1/projects/{projectId}/suggestions` generates/caches a reviewed draft batch: four `neutral`, two `diagnostic`. `GET` returns persisted drafts.
- Each prompt suggestion retains existing `id,text,status,source,promptId` plus `kind,topic,tags,market,language,identityVersion`. Topics are editable draft metadata, not a separate tracking entity.
- `PATCH /v1/projects/{projectId}/suggestions/{id}` edits a pending draft using `{text,kind,topic,tags}`. Validation rejects branded neutral drafts and non-branded diagnostic drafts. Accepted/rejected drafts are immutable.
- Existing `POST .../suggestions/{id}` with `{action:"accept"|"reject"}` persists review; optional `text,kind,topic,tags` on acceptance applies the reviewed edits atomically. Acceptance creates the tracked prompt with that kind/topic/tags.
- Tracked prompt CRUD and run requests permit `neutral` and `diagnostic`; diagnostics remain excluded from comparable analytics. Original diagnostic answers remain available through existing prompt detail, monitoring-run detail and research evidence routes.
- `POST /v1/projects/{projectId}/research` with `{action:"suggest"}` generates/caches context competitor candidates. The response is the existing research view; candidates add `proposedDomains,source,reviewRequired:true,identityVersion,market,language`. Proposed domains are unverified, never ownership facts.
- Existing research `accept`/`merge`/`dismiss` workflow reviews these candidates. Acceptance still requires explicit `name,aliases,domains,expectedVersion` (no defaulting proposed domains into tracked domains). Only explicit user-approved cohort domains are used as ownership evidence.

Generation requires the existing configured OpenAI key/model; uses a separate versioned context cache, bounded daily generation quotas, and no generation on GET. FI uses the same AI path as other contexts. The proxy adds PATCH for the existing suggestion-item path; no new paths.
