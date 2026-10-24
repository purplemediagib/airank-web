import { describe, expect, it } from 'vitest';
import type { ProjectAnalytics } from '@workspace/api-client-react';
import { overviewTrend, usableOverviewGroup } from '@/lib/overview-trends';
import { analyticsFixture, metrics } from './overview-fixtures';

const fixture = () => analyticsFixture() as unknown as ProjectAnalytics;
const from = '2026-10-11';

describe('overview measurement selection', () => {
  it('suggests the latest usable non-diagnostic group, without mutating or merging data', () => {
    const a = fixture();
    a.metrics.eligible = 0;
    a.selectedGroup = 'failed-only';
    a.groups.push({ id: 'failed-only', runCount: 1, latestAt: 1, label: '' });
    a.runs.push({ ...a.runs[0], id: 'diag', kind: 'diagnostic', group: 'diagnostic-only', createdAt: Date.parse('2026-10-14') });
    expect(usableOverviewGroup(a)).toBe('group-a');
    expect(a.selectedGroup).toBe('failed-only');
    a.metrics.eligible = 1;
    expect(usableOverviewGroup(a)).toBeNull();
  });

  it('does not suggest an unavailable/failed group or an unlisted group', () => {
    const a = fixture();
    a.metrics.eligible = 0; a.selectedGroup = 'empty'; a.runs = a.runs.filter(r => r.status === 'failed');
    expect(usableOverviewGroup(a)).toBeNull();
    a.runs[0].status = 'partial'; a.groups = [];
    expect(usableOverviewGroup(a)).toBeNull();
  });
});

describe('brand trends from frozen measurements', () => {
  it('plots real brands instead of group IDs and excludes other groups and diagnostics', () => {
    const a = fixture();
    const one = a.runs[0];
    a.runs = [one, { ...one, id: 'other', group: 'other' }, { ...one, id: 'diagnostic', kind: 'diagnostic' }];
    a.competitors = [{ brandName: 'Rival', isOwned: false, ownedDomains: [], runCount: 1, eligibleRunCount: 1, change: null,
      metrics: metrics(), runs: [{ ...one, metrics: metrics({ visibility: 60 }) }] }];
    const result = overviewTrend(a, 'visibility', from, 4, 'Kahvila');
    expect(result.series.map(s => s.label)).toEqual(['Kahvila', 'Rival']);
    expect(result.data.filter(p => p.runId)).toMatchObject([{ runId: one.id, owned: 33.3, brand0: 60 }]);
    expect(result.measuredRuns).toBe(1);
    expect(result.data.some(p => p.gap && p.owned === null && p.brand0 === null)).toBe(true);
  });

  it('preserves same-day runs and measured zero, with no invented competitor history', () => {
    const a = fixture();
    a.runs = [a.runs[0], { ...a.runs[0], id: 'later', createdAt: a.runs[0].createdAt * 1000 + 60_000, metrics: metrics({ visibility: 0 }) }];
    a.competitors = [{ brandName: 'Rival', isOwned: false, ownedDomains: [], runCount: 1, eligibleRunCount: 1, change: null, metrics: metrics(), runs: [] }];
    const result = overviewTrend(a, 'visibility', from, 4, 'Kahvila');
    expect(result.data.filter(p => p.runId).map(p => [p.owned, p.brand0])).toEqual([[33.3, null], [0, null]]);
    expect(result.measuredRuns).toBe(2);
  });

  it('honours the exact run drilldown, including its competitor samples', () => {
    const a = fixture();
    const result = overviewTrend(a, 'visibility', from, 4, 'Kahvila', 'partial');
    expect(result.data.filter(p => p.runId).map(p => p.runId)).toEqual(['partial']);
  });

  it('renders absent metrics as empty, not misleading all-null axes or zero', () => {
    const a = fixture();
    a.runs.forEach(r => { r.metrics = metrics({ classified: 0, recommendationRate: 0 }); });
    expect(overviewTrend(a, 'recommendations', from, 4, 'Kahvila').data).toEqual([]);
    expect(overviewTrend(a, 'share', from, 4, 'Kahvila').data).toEqual([]);
  });

  it('rejects sentiment comparisons across model/version boundaries', () => {
    const a = fixture();
    const sentiment = (model: string) => ({ state: 'complete', score: 65, sampleSize: 1, groups: [{ analysisVersion: 'v1', model, sampleSize: 1 }] });
    a.metrics.sentiment = sentiment('model-a');
    a.runs = [a.runs[0]];
    a.runs[0].metrics = metrics({ sentiment: sentiment('model-b') });
    expect(overviewTrend(a, 'sentiment', from, 4, 'Kahvila').data).toEqual([]);
    a.runs[0].metrics.sentiment = sentiment('model-a');
    expect(overviewTrend(a, 'sentiment', from, 4, 'Kahvila').data.find(p => p.runId)?.owned).toBe(65);
    a.metrics.sentiment.state = 'incomparable';
    expect(overviewTrend(a, 'sentiment', from, 4, 'Kahvila').data).toEqual([]);
  });

  it('does not substitute list rank for tracked position or count changed extraction versions', () => {
    const a = fixture();
    a.runs = [a.runs[0]];
    a.runs[0].metrics = metrics({ brandOrder: undefined, positions: 1, meanPosition: 4 });
    expect(overviewTrend(a, 'position', from, 4, 'Kahvila').data).toEqual([]);
    expect(overviewTrend(a, 'listRank', from, 4, 'Kahvila').data.find(p => p.runId)?.owned).toBe(4);
    a.runs[0].metrics.brandOrder = { ...a.metrics.brandOrder!, version: 'another-version' };
    expect(overviewTrend(a, 'winRate', from, 4, 'Kahvila').data).toEqual([]);
  });

  it('does not present unobservable citations as a measured zero', () => {
    const a = fixture();
    a.runs.forEach(r => { r.metrics = metrics({ citationAnswers: 0, citationRate: 0 }); });
    expect(overviewTrend(a, 'citations', from, 4, 'Kahvila').data).toEqual([]);
  });
});
