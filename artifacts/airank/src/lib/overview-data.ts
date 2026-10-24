import type { AnalyticsEvidence, EvidenceMetric, ProjectAnalytics, SentimentMetrics } from '@workspace/api-client-react';
import { toMs } from './use-analytics';

export const ANSWERS_PAGE_SIZE = 10;

export type EvidenceFilter = 'all' | 'mentioned' | 'recommended' | 'cited' | 'excluded';

/** Runs that belong to the selected composition group (non-diagnostic). */
export function selectedGroupRuns(a: ProjectAnalytics) {
  return a.runs
    .filter((r) => r.kind !== 'diagnostic' && (!a.selectedGroup || r.group === a.selectedGroup))
    .sort((x, y) => toMs(x.createdAt) - toMs(y.createdAt));
}

/**
 * Defensive scope guard over the complete selected-group evidence returned by the backend.
 * Rows outside the selected UTC date window, provider, topic or group are dropped; a field the
 * backend did not send (older API) is trusted to the server-side filter rather than guessed.
 */
export function scopeEvidence(a: ProjectAnalytics, f: { from: string; to: string; provider: string; topic: string; tag?: string; tags?: string[]; tagMode?: string; market?: string; language?: string; surface?: string; promptId?: string; promptVersion?: string }) {
  const start = Date.parse(`${f.from}T00:00:00Z`);
  const end = Date.parse(`${f.to}T00:00:00Z`) + 86_400_000;
  const groupRuns = a.selectedGroup ? new Set(a.runs.filter((r) => r.group === a.selectedGroup).map((r) => r.id)) : null;
  return a.evidence
    .filter((e) => {
      const t = toMs(e.observedAt);
      if (t < start || t >= end) return false;
      if (f.provider !== 'all' && e.provider !== f.provider) return false;
      if (f.topic !== 'all' && e.topic !== undefined && e.topic !== f.topic) return false;
      const tags = [...new Set([...(f.tags ?? []), ...(f.tag && f.tag !== 'all' ? [f.tag] : [])])];
      if (tags.length && (f.tagMode === 'and' ? !tags.every(t=>e.tags?.includes(t)) : !tags.some(t=>e.tags?.includes(t)))) return false;
      if (f.market && f.market !== 'all' && e.market !== f.market) return false;
      if (f.language && f.language !== 'all' && e.language !== f.language) return false;
      if (f.surface && f.surface !== 'all' && e.measurementSurface !== f.surface) return false;
      if (f.promptId && f.promptId !== 'all' && e.promptId !== f.promptId) return false;
      if (f.promptVersion && Number(f.promptVersion) !== e.promptVersion) return false;
      if (groupRuns && e.runId && !groupRuns.has(e.runId)) return false;
      return true;
    })
    .sort((x, y) => toMs(y.observedAt) - toMs(x.observedAt) || x.id.localeCompare(y.id));
}

export function matchEvidence(e: AnalyticsEvidence, filter: string, query: string) {
  const ok = e.exclusion === null;
  const byFilter = filter === 'mentioned' ? ok && e.mentioned
    : filter === 'recommended' ? ok && e.recommendation === 'recommended'
    : filter === 'cited' ? ok && e.ownedCitation
    : filter === 'ordered' ? ok && e.brandOrder?.state === 'observed' && e.brandOrder.targetPosition !== null
    : filter === 'first' ? ok && e.brandOrder?.state === 'observed' && e.brandOrder.targetPosition === 1
    : filter === 'excluded' ? !ok : true;
  if (!byFilter) return false;
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return [e.text, e.answer, e.provider, e.model, e.topic ?? '', ...(e.tags ?? []), ...(e.brandNames ?? []), ...e.citations]
    .some((s) => (s ?? '').toLocaleLowerCase().includes(q));
}

/** Percentage-point delta only when both periods have a measured value. */
export function ppDelta(cur: number | null | undefined, prev: number | null | undefined) {
  return cur === null || cur === undefined || prev === null || prev === undefined ? null : cur - prev;
}

const groupKey = (s?: SentimentMetrics) => (s?.groups ?? []).map((g) => `${g.analysisVersion ?? '?'}|${g.model ?? '?'}`).sort().join(',');

/** Sentiment is compared only when both periods are single-group with identical analysis version and model. */
export function sentimentDelta(cur?: SentimentMetrics, prev?: SentimentMetrics): { delta: number | null; reason: 'ok' | 'none' | 'incomparable' } {
  if (!cur || !prev || cur.score == null || prev.score == null) return { delta: null, reason: 'none' };
  if (cur.state === 'incomparable' || prev.state === 'incomparable') return { delta: null, reason: 'incomparable' };
  const a = groupKey(cur); const b = groupKey(prev);
  if (!a || !b || a !== b || (cur.groups?.length ?? 0) !== 1) return { delta: null, reason: 'incomparable' };
  return { delta: cur.score - prev.score, reason: 'ok' };
}

export function hostOf(u: string) {
  try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:' ? p.hostname.replace(/^www\./, '') : null; } catch { return null; }
}

export type MetricKey = keyof Pick<EvidenceMetric, 'visibility' | 'recommendationRate' | 'citationRate' | 'cohortShare'>;

/** Splits text into segments; exact (case-insensitive) frozen brand names become highlighted segments. */
export function brandSegments(text: string, names: string[]) {
  const clean = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 1))].sort((x, y) => y.length - x.length);
  if (!clean.length || !text) return [{ text, brand: false }];
  const re = new RegExp(`(${clean.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).filter(Boolean).map((t) => ({ text: t, brand: clean.some((n) => n.toLocaleLowerCase() === t.toLocaleLowerCase()) }));
}
