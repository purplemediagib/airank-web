# One-off Finnish validation — 18 October 2026

Approved ceiling: $5, no recurring activation or automatic paid retries.
Conservative local reservations total $3.40 (not an invoice/actual spend):
four initial consumer slots $2, one corrected Gemini slot $0.50, four small
extraction checks $0.40, Google AI Overview slot $0.50.

The original Gemini attempt failed in free metadata lookup, before any paid POST.
A read-only reproduction confirmed zero POSTs. The fixed country-scoped route
was then submitted once. The initial unused reservation is retained in the total.

| Route | Result | Captured answer | Observations |
|---|---|---:|---|
| ChatGPT / DataForSEO consumer | Success | 12,017 characters | 47 supplier references; 5 captured fan-out queries |
| Gemini / DataForSEO consumer | Success after catalogue fix | 15,443 characters | 87 supplier references; fan-out unavailable |
| Grok / Scrapeless consumer | Success | 5,964 characters | 7 explicit citations, 83 references; geography unverified |
| Perplexity / Scrapeless consumer | Success | 2,006 characters | 4 explicit citations, 14 references; geography unverified |
| Google AI Overviews / DataForSEO desktop SERP | Success | 13,753 characters | 11 citations; vendor-reported Finland/Finnish context |
| Consumer Claude | Blocked | None | Current supplier contracts do not execute new prompts |

DataForSEO's context is supplier-reported, not independently proven routing.
Consumer model versions are not independently verified. Counts are specific to
these captures, not a reliability benchmark. References are not automatically
explicit citations or verified fetch events.

The isolated prompt asked for marketing software for a small Finnish business,
in Finnish, using FI/fi. The AIO query asked for email-marketing software. These
were not added to any user's tracked set.

## Extraction validation

- Controlled Finnish answer: extracted Mailchimp, Brevo, HubSpot, Canva with
  original-text evidence.
- Fresh extraction of captured ChatGPT answer: Mailchimp, Brevo, HubSpot,
  Zoho Social, Zoho Campaigns, Buffer, with grounded mention spans.
- Initial strict parsing rejected context quotes supplied by the model. The
  corrected parser resolves literal mention forms itself, excludes URL-only
  names and overlapping parent/product spans; the captured diagnostic output
  revalidated offline, then a fresh live extraction passed.
- These checks validate execution/grounding on the samples, not perfect semantic
  precision or exhaustive recall for arbitrary answers. Review remains necessary.

Original supplier captures and detailed local pilot ledgers are retained under
ignored generated-artifacts directories, not uploaded into production analytics.
No production data migration, account write, email, tracked-prompt change,
recurring schedule activation, or production entity-analysis job was executed.

Supplier charges not reported in task results cannot be inferred as zero.
The reservation total is conservative; exact final spend requires supplier billing.

## Application checks

Both Linux/amd64 release images pass the backend regression suite (210 tests).
Frontend/BFF type checks, production builds, frontend unit checks and 13 BFF tests
passed. Migration/ownership/review persistence/lease/budget checks used isolated
local databases, never the live Bunny database.

A fixture-backed signed-in browser pass verified original-answer drilldowns,
brand Confirm/Reset, tracked-cohort invariance, explicit paid-analysis confirmation
with no premature submission, source classification/filter/reset and visible 403
failure handling, captured-query/provider/provenance display, and 390px Finnish
Sources/Discovery layouts without measured horizontal overflow. No test POST was
forwarded to Bunny. Browser fixtures are not production data.

Browser coverage was partial: Reject, a reload while Confirmed, and fanout
unknown-versus-zero wording were not exercised end-to-end. Their filtering/state
rules have lower-level coverage. The final display-only adjustment removes the
old candidate count from the detected-brand tab and hides empty earlier
list-based suggestions, preventing conflicting zero/empty messages.
