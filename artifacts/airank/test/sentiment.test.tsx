import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  highlightSegments, itemNeedsPoll, plainPreview, pollDelay, MAX_POLLS, resultParamsFromSearch, resultsContextQuery,
  safeHttpUrl, sentimentStatusInfo, verifyQuote,
} from '@/lib/sentiment';
import { AnswerText, SentimentBadge, SourceList, LabelDistribution, SentimentScoreCard } from '@/components/airank/sentiment';

const L = (_fi: string, en: string) => en;
const wrap = (ui: React.ReactNode) => {
  window.history.replaceState(null, '', '/en/dashboard/results?project=p1');
  return render(<I18nProvider><TooltipProvider>{ui}</TooltipProvider></I18nProvider>);
};

describe('exact quote verification (UTF-16, end exclusive)', () => {
  const answer = 'Intro \u{1D538} Aava Studio is clear. Kajo is slow.';
  it('accepts only exact slices', () => {
    const start = answer.indexOf('Aava');
    const text = 'Aava Studio is clear.';
    expect(start).toBe(9); // astral char counts as two UTF-16 units
    expect(verifyQuote(answer, { text, start, end: start + text.length })).toBe(true);
    expect(verifyQuote(answer, { text, start: start + 1, end: start + 1 + text.length })).toBe(false);
    expect(verifyQuote(answer, { text, start: -1, end: 20 })).toBe(false);
    expect(verifyQuote(answer, { text, start: 9, end: 999 })).toBe(false);
    expect(verifyQuote(answer, { text, start: 9.5, end: 30 })).toBe(false);
    expect(verifyQuote(null, { text, start: 9, end: 30 })).toBe(false);
  });
  it('never highlights unverified or overlapping quotes', () => {
    const q1 = { text: 'Aava Studio is clear.', start: 9, end: 30, polarity: 'positive' };
    const overlap = { text: 'Studio is clear. Kajo', start: 14, end: 35, polarity: 'neutral' };
    const wrong = { text: 'Kajo is slow.', start: 0, end: 13, polarity: 'negative' };
    const segs = highlightSegments(answer, [q1, overlap, wrong]);
    expect(segs.filter((s) => s.quote).map((s) => s.text)).toEqual(['Aava Studio is clear.']);
    expect(segs.map((s) => s.text).join('')).toBe(answer);
  });
});

describe('helpers', () => {
  it('links only http(s) without credentials', () => {
    expect(safeHttpUrl('https://example.fi/a')).toBe('https://example.fi/a');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,x')).toBeNull();
    expect(safeHttpUrl('https://u:p@example.fi')).toBeNull();
  });
  it('strips markdown in previews', () => {
    expect(plainPreview('## Title\n- **Aava** [site](https://x.fi)')).toBe('Title Aava site');
  });
  it('null scores are never numeric', () => {
    expect(sentimentStatusInfo('not_mentioned', L)).toMatchObject({ label: 'Not mentioned', scored: false });
    expect(sentimentStatusInfo('budget_wait', L).explain).toMatch(/spending limit/);
    expect(sentimentStatusInfo('assessed', L).scored).toBe(true);
  });
  it('polls only active work, with bounded backoff', () => {
    expect(itemNeedsPoll({ state: 'running' })).toBe(true);
    expect(itemNeedsPoll({ state: 'success', sentimentAnalysis: { state: 'queued' } })).toBe(true);
    expect(itemNeedsPoll({ state: 'success', sentimentAnalysis: { state: 'budget_wait' } })).toBe(false);
    expect(itemNeedsPoll({ state: 'success', sentimentAnalysis: { state: 'done' } })).toBe(false);
    expect(itemNeedsPoll({ state: 'success', sentimentAnalysis: { state: 'not_analysed' }, runCreatedAt: Date.now() - 10_000 })).toBe(true);
    expect(itemNeedsPoll({ state: 'success', sentimentAnalysis: { state: 'not_analysed' }, runCreatedAt: Date.now() - 180_000 })).toBe(false);
    expect(pollDelay(0)).toBe(4000);
    expect(pollDelay(1)).toBeGreaterThan(4000);
    expect(pollDelay(8)).toBeLessThanOrEqual(30_000);
    expect(pollDelay(MAX_POLLS)).toBe(false);
  });
  it('maps URL filters to the contract only', () => {
    expect(resultParamsFromSearch('?page=3&run=r1&state=bogus&from=2026-01-01&to=nope&q=free')).toEqual({ page: 3, pageSize: 25, runId: 'r1', from: '2026-01-01' });
    expect(resultsContextQuery('?project=p&page=2&provider=grok&tab=x')).toBe('project=p&page=2&provider=grok');
  });
});

describe('sentiment components', () => {
  it('shows not mentioned without a score and pending from the job state', () => {
    wrap(<><SentimentBadge testId="a" state="success" sentiment={{ status: 'not_mentioned', score: null }} analysis={{ state: 'done' }} />
      <SentimentBadge testId="b" state="success" sentiment={{ status: 'not_analysed' }} analysis={{ state: 'queued' }} />
      <SentimentBadge testId="c" state="failed" /></>);
    expect(screen.getByTestId('a').textContent).toBe('Not mentioned');
    expect(screen.getByTestId('b').textContent).toBe('Analysis pending');
    expect(screen.getByTestId('c').textContent).toBe('Not applicable');
  });
  it('escapes provider HTML and highlights exact text', () => {
    const answer = '<img src=x onerror=alert(1)> Aava is good';
    wrap(<AnswerText mode="exact" answer={answer} quotes={[{ text: 'Aava is good', start: 29, end: 41, polarity: 'positive' }]} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByTestId('highlight-quote-0').textContent).toBe('Aava is good');
  });
  it('renders unsafe citations as text', () => {
    wrap(<SourceList citations={['javascript:alert(1)', { url: 'https://example.fi/page', title: 'Example' }]} />);
    const list = screen.getByTestId('list-sources');
    expect(within(list).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByTestId('link-source-1').getAttribute('rel')).toContain('noopener');
  });
  it('keeps mixed distinct and shows incomparable without a score', () => {
    wrap(<><LabelDistribution s={{ state: 'complete', labelCounts: { positive: 3, mixed: 1 } }} />
      <SentimentScoreCard testId="s" s={{ state: 'incomparable', score: null, sampleSize: 4, groups: [] }} /></>);
    expect(screen.getByTestId('row-label-mixed').textContent).toContain('Mixed');
    expect(screen.getByTestId('value-s').textContent).toBe('–');
  });
});

const api = vi.hoisted(() => ({ detail: vi.fn(), list: vi.fn() }));
vi.mock('@workspace/api-client-react', async (load) => ({
  ...await load(),
  useGetProjectResult: (...a: unknown[]) => api.detail(...a),
  useListProjectResults: (...a: unknown[]) => api.list(...a),
}));
vi.mock('@/lib/account', () => ({ useAccount: () => ({ user: { id: 'u1' }, writeRequest: { headers: {} } }) }));
vi.mock('@/lib/project-context', () => ({ useProjects: () => ({ project: { id: 'p1' }, projectHref: (p: string) => `/en${p}?project=p1` }) }));

describe('answer evidence page', () => {
  it('switches brand assessments and links previous/next in filtered context', async () => {
    const { default: ResultDetailPage } = await import('@/pages/result-detail');
    const answer = 'Aava is clear. Kajo is slow.';
    const item = {
      id: 'e2', runId: 'r', promptId: 'p', text: 'Q?', provider: 'grok', model: 'grok-x', status: 'success', state: 'success', answer, citations: [],
      sentimentAnalysis: { state: 'done' },
      sentiment: { brandId: 'b1', brandName: 'Aava', status: 'assessed', label: 'positive', score: 75, quotes: [{ text: 'Aava is clear.', start: 0, end: 14, polarity: 'positive', attribute: 'clarity' }], model: 'gpt-4.1-mini' },
      brandSentiments: { b2: { brandId: 'b2', brandName: 'Kajo', status: 'assessed', label: 'negative', score: 25, quotes: [{ text: 'Kajo is slow.', start: 15, end: 28, polarity: 'negative' }] } },
    };
    api.detail.mockReturnValue({ data: item, isPending: false, isError: false, error: null });
    api.list.mockReturnValue({ data: { items: [{ id: 'e1' }, item, { id: 'e3' }], total: 3, page: 1, pageSize: 25, hasMore: false }, isPending: false, error: null });
    window.history.replaceState(null, '', '/en/dashboard/results/e2?project=p1&provider=grok');
    const { Router, Route } = await import('wouter');
    render(<I18nProvider><TooltipProvider><Router><Route path="/:locale/dashboard/results/:id" component={ResultDetailPage} /></Router></TooltipProvider></I18nProvider>);
    expect(screen.getByTestId('value-brand-score').textContent).toContain('75');
    expect(screen.getByTestId('link-prev-result').getAttribute('href')).toContain('/results/e1?project=p1&provider=grok');
    expect(screen.getByTestId('link-next-result').getAttribute('href')).toContain('/results/e3');
    expect(screen.getByTestId('link-back').getAttribute('href')).toBe('/en/dashboard/results?project=p1&provider=grok');
    await userEvent.setup().click(screen.getByTestId('button-brand-b2'));
    expect(screen.getByTestId('value-brand-score').textContent).toContain('25');
    expect(screen.getByTestId('highlight-quote-0').textContent).toBe('Kajo is slow.');
  });
});
