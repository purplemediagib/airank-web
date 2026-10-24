import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import { checkPromptScope, findPromptSummary } from '@/lib/prompt-metrics';

const metric = (o = {}) => ({ eligible: 12, expected: 14, mentions: 5, ownedCitations: 3, classified: 9, recommended: 4, positions: 0, visibility: 41.7, score: null, citationRate: 25, recommendationRate: 44.4, cohortShare: null, cohortMentions: 0, meanPosition: null, state: 'partial', sentiment: { state: 'complete', score: 63.5, sampleSize: 4, coverage: 80, mentionedAnswers: 5 }, ...o });
const base = { methodology: 'm', extractionVersion: 'x', selectedGroup: 'g1', groups: [{ id: 'g1', runCount: 2, latestAt: 1, label: 'G1' }], metrics: metric({ visibility: 88.8, mentions: 99 }), providers: [], runs: [], evidence: [], changes: [], topics: [], availableProviders: [], totalRuns: 2, quickChecks: 0, market: 'FI', language: 'fi' };
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
const analytics = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/use-analytics', async (orig) => ({ ...(await orig() as object), useAnalytics: () => ({ isPending: false, isError: false, data: analytics.current, unavailable: false, refetch: () => {} }) }));
const { PromptMetricCells, PromptScopedMetrics } = await import('@/components/airank/prompt-metrics');

const wrap = (ui: React.ReactNode) => { window.history.replaceState(null, '', '/en/dashboard/prompts/p1?project=x'); return render(<I18nProvider><TooltipProvider>{ui}</TooltipProvider></I18nProvider>); };

describe('prompt scope guard', () => {
  it('rejects missing and mismatched scopes', () => {
    expect(checkPromptScope(base as never, 'p1', 2)).toBe('missing');
    expect(checkPromptScope({ ...base, promptScope: { promptId: 'p1', promptVersion: 1 } } as never, 'p1', 2)).toBe('mismatch');
    expect(checkPromptScope({ ...base, promptScope: { promptId: 'p1', promptVersion: 2 } } as never, 'p1', 2)).toBe('match');
    expect(findPromptSummary(base as never, 'p1', 2)).toBeNull();
  });
  it('old backend: never renders project numbers as prompt metrics', () => {
    analytics.current = base;
    wrap(<PromptScopedMetrics projectId="x" promptId="p1" version={2} />);
    expect(screen.getByTestId('text-prompt-scope-mismatch').textContent).toMatch(/backend update/i);
    expect(screen.queryByText(/88/)).toBeNull();
  });
  it('renders scoped metrics with authoritative denominators', () => {
    analytics.current = { ...base, metrics: metric(), promptScope: { promptId: 'p1', promptVersion: 2 } };
    wrap(<PromptScopedMetrics projectId="x" promptId="p1" version={2} />);
    expect(screen.getByText('4 of 9 classified')).toBeTruthy();
    expect(screen.getByText('5 of 12 eligible answers')).toBeTruthy();
    expect(screen.getByText(/n=4 · coverage 80/)).toBeTruthy();
  });
});

describe('prompt list summaries', () => {
  it('matches summary by prompt and current version only', () => {
    const a = { ...base, promptSummaries: [{ promptId: 'p1', version: 1, selectedGroup: 'g1', groupCount: 1, latestAt: 1, runCount: 1, metrics: metric({ visibility: 10 }) }, { promptId: 'p1', version: 2, selectedGroup: 'g1', groupCount: 2, latestAt: 1, runCount: 3, metrics: metric() }] };
    wrap(<table><tbody><tr><PromptMetricCells a={a as never} promptId="p1" version={2} loading={false} /></tr></tbody></table>);
    expect(screen.getByTestId('value-perf-visibility-p1').textContent).toMatch('41.7%5 / 12');
    expect(screen.getByTestId('value-perf-recommendations-p1').textContent).toMatch('4 / 9');
    expect(screen.getByTestId('value-perf-visibility-p1').getAttribute('title')).toMatch(/latest of 2 compositions/);
    for (const [key, label] of [['visibility', 'Visibility'], ['recommendations', 'Recommendation rate'], ['sentiment', 'Sentiment']]) {
      const cell = screen.getByTestId(`value-perf-${key}-p1`);
      expect(cell.classList.contains('hidden')).toBe(false);
      expect(cell.textContent).toContain(label);
    }
  });
  it('distinguishes missing summaries field from no measurements', () => {
    wrap(<table><tbody><tr><PromptMetricCells a={base as never} promptId="p1" version={2} loading={false} /></tr></tbody></table>);
    expect(screen.getByTestId('value-perf-visibility-p1').textContent).toMatch(/Backend update required/);
  });
});
