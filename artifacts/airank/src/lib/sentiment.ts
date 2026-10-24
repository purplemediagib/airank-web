import type { BrandSentiment, ResultCitation, ResultItem, SentimentQuote } from '@workspace/api-client-react';

/** FI/EN pair helper signature (matches components/airank/analytics useL). */
export type Lf = (fi: string, en: string) => string;
export type SentimentTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Exact quote verification. Offsets are JavaScript UTF-16 indexes, end exclusive.
 * A quote is only trusted when answer.slice(start, end) === quote.text. Never guessed or searched.
 */
export function verifyQuote(answer: string | null | undefined, q: Pick<SentimentQuote, 'text' | 'start' | 'end'>): boolean {
  if (typeof answer !== 'string' || typeof q.text !== 'string' || !q.text) return false;
  if (!Number.isInteger(q.start) || !Number.isInteger(q.end)) return false;
  if (q.start < 0 || q.end > answer.length || q.end <= q.start) return false;
  return answer.slice(q.start, q.end) === q.text;
}

export type Segment = { text: string; quote: SentimentQuote | null; index: number };

/** Split the original answer into plain and verified-quote segments. Unverified or overlapping quotes are not highlighted. */
export function highlightSegments(answer: string, quotes: SentimentQuote[]): Segment[] {
  const ok = quotes
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => verifyQuote(answer, q))
    .sort((a, b) => a.q.start - b.q.start);
  const out: Segment[] = [];
  let cursor = 0;
  for (const { q, index } of ok) {
    if (q.start < cursor) continue; // overlap: keep the earlier verified span only
    if (q.start > cursor) out.push({ text: answer.slice(cursor, q.start), quote: null, index: -1 });
    out.push({ text: answer.slice(q.start, q.end), quote: q, index });
    cursor = q.end;
  }
  if (cursor < answer.length) out.push({ text: answer.slice(cursor), quote: null, index: -1 });
  return out;
}

/** Only HTTP(S) URLs without embedded credentials become clickable. */
export function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return (p.protocol === 'http:' || p.protocol === 'https:') && !p.username && !p.password ? p.href : null;
  } catch {
    return null;
  }
}

export function citationParts(c: ResultCitation): { url: string; title: string | null } {
  return typeof c === 'string' ? { url: c, title: null } : { url: c.url, title: c.title ?? null };
}

/** Readable preview: strips Markdown syntax for list rows. Display-only; never used for offsets. */
export function plainPreview(md: string | null | undefined, max = 220): string {
  if (!md) return '';
  const t = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__|\*|_|`|~~)/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Assessment status -> explicit display. Numeric score only for `assessed`. */
export function sentimentStatusInfo(status: string | null | undefined, L: Lf): { label: string; tone: SentimentTone; explain: string | null; scored: boolean } {
  const s = status ?? 'not_analysed';
  const m: Record<string, [string, string, SentimentTone, string | null, string | null]> = {
    assessed: ['Arvioitu', 'Assessed', 'info', null, null],
    not_mentioned: ['Ei mainittu', 'Not mentioned', 'neutral', 'Brändiä ei mainita tässä vastauksessa, joten sävyä ei pisteytetä.', 'The brand is not mentioned in this answer, so no tone score applies.'],
    unclassified: ['Ei voitu arvioida', 'Unable to assess', 'neutral', 'Analyysi ei löytänyt arvioitavaa kuvausta.', 'The analysis could not find a describable portrayal.'],
    queued: ['Analyysi odottaa', 'Analysis pending', 'warning', null, null],
    analysing: ['Sävyä analysoidaan', 'Analysing sentiment', 'warning', null, null],
    budget_wait: ['Analyysi odottaa', 'Analysis waiting', 'warning', 'Analyysin kulubudjetti on täynnä. Analyysi jatkuu, kun budjettia on käytettävissä.', 'The analysis spending limit has been reached. Analysis resumes when budget is available.'],
    unconfigured: ['Analyysi odottaa', 'Analysis waiting', 'warning', 'Analyysipalvelun asetukset puuttuvat palvelimelta.', 'The analysis service needs server configuration.'],
    failed: ['Analyysi ei saatavilla', 'Analysis unavailable', 'error', 'Alkuperäinen vastaus on tallessa.', 'The original answer is preserved.'],
    interrupted_unknown: ['Analyysi ei saatavilla', 'Analysis unavailable', 'error', 'Analyysi keskeytyi. Alkuperäinen vastaus on tallessa.', 'Analysis was interrupted. The original answer is preserved.'],
    unsupported_language: ['Kieltä ei tueta', 'Unsupported language', 'neutral', 'Vastauksen kieltä ei tueta sävyanalyysissä.', 'The answer language is not supported by sentiment analysis.'],
    answer_too_long: ['Vastaus liian pitkä', 'Answer too long', 'neutral', 'Vastaus ylittää analyysin kokorajan.', 'The answer exceeds the analysis size limit.'],
    too_many_brands: ['Liian monta brändiä', 'Too many brands', 'neutral', 'Vertailujoukko ylittää analyysin brändirajan.', 'The brand cohort exceeds the analysis limit.'],
    not_applicable: ['Ei sovellu', 'Not applicable', 'neutral', 'Epäonnistunut, tyhjä tai aloittamaton havainto. Sävyä ei arvioida.', 'Failed, empty or unstarted observation. No sentiment assessment applies.'],
    disabled: ['Sävyanalyysi pois käytöstä', 'Sentiment disabled', 'neutral', null, null],
    not_configured: ['Sävyanalyysiä ei määritetty', 'Sentiment not configured', 'neutral', null, null],
    not_analysed: ['Ei vielä analysoitu', 'Not yet analysed', 'neutral', 'Historiallisia vastauksia ei analysoida automaattisesti.', 'Historical answers are not analysed automatically.'],
    evidence_changed: ['Arvio ei ole enää voimassa', 'Previous assessment no longer applies', 'neutral', 'Tallennettu arvio hylättiin, koska todiste muuttui.', 'The stored assessment was rejected because the evidence changed.'],
  };
  const e = m[s];
  if (!e) return { label: `${L('Tila', 'State')}: ${s}`, tone: 'neutral', explain: null, scored: false };
  return { label: L(e[0], e[1]), tone: e[2], explain: e[3] && e[4] ? L(e[3], e[4]) : null, scored: s === 'assessed' };
}

export const SENTIMENT_LABELS = ['strongly_positive', 'positive', 'neutral', 'mixed', 'negative', 'strongly_negative'] as const;

export function sentimentLabelText(label: string | null | undefined, L: Lf): string {
  const m: Record<string, [string, string]> = {
    strongly_positive: ['Erittäin myönteinen', 'Strongly positive'],
    positive: ['Myönteinen', 'Positive'],
    neutral: ['Neutraali', 'Neutral'],
    mixed: ['Ristiriitainen', 'Mixed'],
    negative: ['Kielteinen', 'Negative'],
    strongly_negative: ['Erittäin kielteinen', 'Strongly negative'],
  };
  return label && m[label] ? L(m[label][0], m[label][1]) : label ?? '';
}

export const LABEL_COLOR: Record<string, string> = {
  strongly_positive: '#0b7d8d',
  positive: '#3fb6c6',
  neutral: '#9aa6b8',
  mixed: '#8a6d1d',
  negative: '#d9825b',
  strongly_negative: '#b33a2e',
};

/** Collection (task) states from the results contract. */
export function collectionInfo(state: string | null | undefined, L: Lf): { label: string; tone: SentimentTone } {
  const m: Record<string, [string, string, SentimentTone]> = {
    queued: ['Jonossa', 'Queued', 'neutral'],
    running: ['Haetaan', 'Collecting', 'warning'],
    success: ['Onnistui', 'Success', 'success'],
    failed: ['Epäonnistui', 'Failed', 'error'],
    skipped: ['Ohitettu', 'Skipped', 'neutral'],
    unavailable: ['Ei saatavilla', 'Unavailable', 'neutral'],
  };
  const e = state ? m[state] : undefined;
  return e ? { label: L(e[0], e[1]), tone: e[2] } : { label: state ?? '–', tone: 'neutral' };
}

/** Analysis job states that justify continued polling. Budget/config waits are deliberately excluded. */
const ACTIVE_ANALYSIS = new Set(['queued', 'pending', 'running', 'analysing', 'processing']);
const ACTIVE_COLLECTION = new Set(['queued', 'running']);
export const WAITING_ANALYSIS = new Set(['budget_wait', 'unconfigured']);

export function itemNeedsPoll(i: Pick<ResultItem, 'state' | 'sentimentAnalysis' | 'runCreatedAt'>): boolean {
  if (ACTIVE_COLLECTION.has(i.state ?? '')) return true;
  const a = i.sentimentAnalysis?.state;
  // A newly saved answer may precede worker discovery. Give only recent runs a
  // short GET-only grace period; never keep polling unanalysed historical data.
  if (a === 'not_analysed' && i.state === 'success' && i.runCreatedAt) {
    const created = i.runCreatedAt < 1e12 ? i.runCreatedAt * 1000 : i.runCreatedAt;
    const age = Date.now() - created;
    return age >= 0 && age < 120_000;
  }
  return !!a && ACTIVE_ANALYSIS.has(a);
}

export const MAX_POLLS = 10;
/** Backoff: 4s, 6s, 9s ... capped at 30s; stops after MAX_POLLS attempts (returns false). */
export function pollDelay(attempt: number): number | false {
  if (attempt >= MAX_POLLS) return false;
  return Math.min(30_000, Math.round(4000 * Math.pow(1.5, attempt)));
}

/** Assessments available for the brand selector: frozen brandSentiments first, else the tracked-brand sentiment. */
export function brandAssessments(i: Pick<ResultItem, 'sentiment' | 'brandSentiments'>): { key: string; s: BrandSentiment }[] {
  const out: { key: string; s: BrandSentiment }[] = [];
  const seen = new Set<string>();
  const tracked = i.sentiment;
  if (tracked) { const k = tracked.brandId ?? 'tracked'; out.push({ key: k, s: tracked }); seen.add(k); }
  for (const [k, s] of Object.entries(i.brandSentiments ?? {})) if (!seen.has(k)) { out.push({ key: k, s }); seen.add(k); }
  return out;
}

/** Results filters persisted in the URL. */
export const RESULT_FILTER_KEYS = ['run', 'runId', 'prompt', 'promptId', 'provider', 'topic', 'state', 'from', 'to', 'tag', 'tags', 'tagMode', 'market', 'language', 'surface', 'promptVersion', 'group'] as const;
export const RESULT_STATES = ['queued', 'running', 'success', 'failed', 'skipped', 'unavailable'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function resultParamsFromSearch(search: string, defaultPageSize = 25) {
  const p = new URLSearchParams(search);
  const ps = Number.parseInt(p.get('pageSize') ?? '', 10);
  const pageSize = Number.isInteger(ps) && ps >= 1 && ps <= 100 ? ps : defaultPageSize;
  const page = Math.max(1, Number.parseInt(p.get('page') ?? '1', 10) || 1);
  const out: Record<string, string | number> = { page, pageSize };
  const map: Record<string, string> = { run: 'runId', prompt: 'promptId', provider: 'provider', topic: 'topic', state: 'state', from: 'from', to: 'to' };
  for (const k of RESULT_FILTER_KEYS) {
    const v = p.get(k);
    if (!v) continue;
    if ((k === 'from' || k === 'to') && !DAY.test(v)) continue;
    if (k === 'state' && !(RESULT_STATES as readonly string[]).includes(v)) continue;
    out[map[k] ?? k] = v;
  }
  return out as import('@workspace/api-client-react').ListProjectResultsParams & {page:number;pageSize:number};
}

/** Keep only results-context params (filters, page, project) for back/prev/next links. */
export function resultsContextQuery(search: string): string {
  const p = new URLSearchParams(search);
  const keep = new URLSearchParams();
  for (const k of ['project', 'page', 'pageSize', ...RESULT_FILTER_KEYS]) { const v = p.get(k); if (v) keep.set(k, v); }
  return keep.toString();
}
