import type { EvidenceMetric, ProjectAnalytics } from '@workspace/api-client-react';
import type { Point, Series } from '@/components/airank/data';
import { selectedGroupRuns } from './overview-data';
import { toMs, utcDay } from './use-analytics';

export const overviewMetrics = ['visibility', 'share', 'sentiment', 'citations', 'recommendations', 'winRate', 'position', 'listRank'] as const;
export type OverviewMetric = typeof overviewMetrics[number];

/** Suggest another group only from actual usable, non-diagnostic run metrics. Never merge groups. */
export function usableOverviewGroup(a: ProjectAnalytics): string | null {
  if (a.metrics.eligible > 0) return null;
  return [...a.runs]
    .filter(r => r.kind !== 'diagnostic' && r.group !== a.selectedGroup && r.metrics.eligible > 0 &&
      ['completed', 'partial'].includes(r.status) && a.groups.some(g => g.id === r.group))
    .sort((x, y) => toMs(y.createdAt) - toMs(x.createdAt))[0]?.group ?? null;
}

function analysisKey(m: EvidenceMetric) {
  const s = m.sentiment;
  if (!s || s.state === 'incomparable' || s.groups?.length !== 1) return null;
  const g = s.groups[0];
  return g.analysisVersion && g.model ? JSON.stringify([g.analysisVersion, g.model]) : null;
}

function value(m: EvidenceMetric, metric: OverviewMetric, basis: EvidenceMetric): number | null {
  if (!m.eligible) return null;
  switch (metric) {
    case 'visibility': return m.visibility;
    case 'share': return m.cohortShare;
    case 'citations': return (m.citationAnswers ?? m.eligible) > 0 ? m.citationRate : null;
    case 'recommendations': return m.classified > 0 ? m.recommendationRate : null;
    case 'sentiment': return analysisKey(m) !== null && analysisKey(m) === analysisKey(basis) ? m.sentiment?.score ?? null : null;
    case 'listRank': return m.positions > 0 ? m.meanPosition : null;
    case 'position':
    case 'winRate': {
      const o = m.brandOrder, b = basis.brandOrder;
      if (!o || !b || o.version !== b.version || o.scope !== b.scope || !o.eligibleAnswers) return null;
      return metric === 'position' ? o.meanPosition : o.winRate;
    }
  }
}

/**
 * One brand per line, using only the frozen cohort's run metrics.
 * The owned series uses the exact same selected runs as the summary.
 * Missing days/measurements stay null; same-day runs remain distinct.
 */
export function overviewTrend(a: ProjectAnalytics, metric: OverviewMetric, from: string, days: number, ownedLabel: string, runId = '') {
  const runs = selectedGroupRuns(a).filter(r => !runId || r.id === runId);
  const colors = ['#181f6b', '#6b5aa8', '#2f7d6d', '#b8562b', '#8a6d1d'];
  const brands = (a.competitors ?? []).filter(b => !b.isOwned);
  const series: Series[] = [
    { key: 'owned', label: ownedLabel, color: '#00aaca' },
    ...brands.map((b, i) => ({ key: `brand${i}`, label: b.brandName, color: colors[i % colors.length], dash: i % 2 ? '6 3' : undefined })),
  ];
  const indexes = brands.map(b => new Map(b.runs.filter(r => r.group === a.selectedGroup && r.kind !== 'diagnostic').map(r => [r.id, r.metrics])));
  const blank = () => Object.fromEntries(series.map(s => [s.key, null]));
  const points: { t: number; point: Point }[] = runs.map(r => {
    const point: Point = { date: new Date(toMs(r.createdAt)).toISOString(), runId: r.id, group: r.group, ...blank(), owned: value(r.metrics, metric, a.metrics) };
    brands.forEach((b, i) => {
      const m = indexes[i].get(r.id);
      point[`brand${i}`] = m ? value(m, metric, b.metrics) : null;
    });
    return { t: toMs(r.createdAt), point };
  });
  const measuredDays = new Set(runs.map(r => utcDay(r.createdAt)));
  const start = Date.parse(`${from}T00:00:00Z`);
  if (runs.length && Number.isFinite(start)) {
    for (let i = 0; i < Math.min(days, 3660); i++) {
      const t = start + i * 86_400_000;
      const day = new Date(t).toISOString().slice(0, 10);
      if (!measuredDays.has(day)) points.push({ t: t + 43_200_000, point: { date: day, gap: '1', ...blank() } });
    }
  }
  const measured = points.filter(p => !p.point.gap && series.some(s => typeof p.point[s.key] === 'number'));
  return {
    series,
    // An all-null array must render the chart's empty state rather than blank axes.
    data: measured.length ? points.sort((x, y) => x.t - y.t).map(p => p.point) : [],
    measuredRuns: measured.length,
    runCount: runs.length,
    competitorCount: brands.length,
  };
}
