import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import OverviewPage from '@/pages/overview';
import { analyticsFixture, evidence, metrics } from './overview-fixtures';

const api = vi.hoisted(() => ({ analytics: vi.fn(), opportunities: vi.fn(), result: vi.fn() }));
vi.mock('@/components/airank/schedule-settings', () => ({ DailyStatusStrip: () => <div data-testid="strip-overview-daily" />, ScheduleSettings: () => null }));
vi.mock('@workspace/api-client-react', async (load) => ({
  ...await load(),
  useGetProjectAnalytics: (...args) => api.analytics(...args),
  useListOpportunities: (...args) => api.opportunities(...args),
  useGetProjectResult: (...args) => api.result(...args),
}));
vi.mock('@/lib/account', () => ({ useAccount: () => ({ user: { id: 'test-user' } }) }));
vi.mock('@/lib/quick-check-summary', () => ({
  useQuickCheckSummary: () => ({ project: { id: 'project-test', status: 'active', brandName: 'Kahvila', ownedDomains: ['kahvila.fi'] } }),
}));
vi.mock('@/components/airank/data', async (load) => ({ ...await load(), TrendChart: () => <div data-testid="trend-placeholder" /> }));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let data;
const opp = (id, over = {}) => ({ id, titleFi: `Fi ${id}`, titleEn: `Title ${id}`, rationaleFi: 'r', rationaleEn: 'r', priority: 'high', status: 'new', updatedAt: 1, evidenceIds: ['mention'], ...over });
function mount(locale = 'en', query = '') {
  window.history.replaceState(null, '', `/${locale}/dashboard?project=project-test${query}`);
  return render(<I18nProvider><TooltipProvider><OverviewPage /></TooltipProvider></I18nProvider>);
}
const rerender = (view) => view.rerender(<I18nProvider><TooltipProvider><OverviewPage /></TooltipProvider></I18nProvider>);
const text = (id) => screen.getByTestId(id).textContent.replace(/\u00a0/g, ' ');
const params = () => new URLSearchParams(window.location.search);
const answerIds = () => screen.queryAllByTestId(/^button-answer-(?!prev|next|position)/).map((el) => el.dataset.testid.replace('button-answer-', ''));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
  data = analyticsFixture();
  api.analytics.mockImplementation(() => ({ data, isPending: false, isError: false }));
  api.opportunities.mockReturnValue({ data: [opp('a'), opp('done', { status: 'completed' })], isPending: false, isError: false });
  api.result.mockReturnValue({ data: undefined, isPending: false, isError: true });
});

describe.each([
  ['en', 'Overview', '33.3%', '0.0%', '+3.3 pp', 'Manage prompts'],
  ['fi', 'Yleiskatsaus', '33,3 %', '0,0 %', '+3,3 pp', 'Hallitse kysymyksiä'],
])('%s overview', (locale, title, visibility, recs, delta, manage) => {
  it('renders the daily workflow header and scoped KPIs with distinct denominators', () => {
    mount(locale);
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeTruthy();
    expect(text('button-manage-prompts')).toContain(manage);
    expect(screen.getByTestId('button-manage-prompts').getAttribute('href')).toBe(`/${locale}/dashboard/prompts?project=project-test`);
    expect(screen.getByTestId('strip-overview-daily')).toBeTruthy();
    expect(screen.getByTestId('link-history').getAttribute('href')).toBe(`/${locale}/dashboard/history?project=project-test`);
    expect(text('value-visibility')).toBe(visibility);
    expect(text('value-win-rate')).toBe(recs);
    expect(text('value-share')).toBe('–');
    expect(text('value-sentiment')).toBe('–');
    expect(text('value-position')).toBe('2');
    expect(text('denom-position')).toMatch(/1 (mainitsevaa vastausta|mentioning answers)/);
    expect(text('delta-visibility')).toBe(delta);
    expect(text('denom-visibility')).toContain('1 / 3');
    expect(text('denom-win-rate')).toContain('0 / 3');
    expect(text('denom-owned-citations')).toContain('0 / 3');
  });
});

it('removes quick-check panels from Overview', () => {
  mount();
  expect(screen.queryByTestId('section-quick-checks')).toBeNull();
  expect(screen.queryByTestId('panel-quick-check-snapshot')).toBeNull();
  expect(screen.getByTestId('link-quick-check-history').getAttribute('href')).toBe('/en/start?project=project-test');
});

it('shows no delta without a comparable prior period, and an upgrade note for old backends', () => {
  data.overview.comparison = null;
  const view = mount();
  expect(screen.queryByTestId('delta-visibility')).toBeNull();
  expect(text('text-comparison-basis')).toContain('No comparable prior period');
  data = { ...analyticsFixture(), overview: undefined };
  rerender(view);
  expect(text('text-comparison-basis')).toContain('backend upgrade');
  expect(within(screen.getByTestId('panel-topic-matrix')).getByText('Backend upgrade needed')).toBeTruthy();
  expect(within(screen.getByTestId('panel-top-domains')).getByText('Backend upgrade needed')).toBeTruthy();
});

it('compares sentiment only within the same analysis version and model', () => {
  const s = (score, v) => ({ state: 'complete', score, sampleSize: 4, mentionedAnswers: 5, groups: [{ analysisVersion: v, model: 'm', sampleSize: 4, score }] });
  data.metrics = metrics({ sentiment: s(62, 'v2') });
  data.overview.comparison.metrics = metrics({ sentiment: s(50, 'v1') });
  const view = mount();
  expect(text('value-sentiment')).toBe('62');
  expect(screen.queryByTestId('delta-sentiment')).toBeNull();
  expect(text('note-sentiment')).toContain('Not comparable');
  data.overview.comparison.metrics = metrics({ sentiment: s(50, 'v2') });
  rerender(view);
  expect(text('delta-sentiment')).toBe('+12 pts');
});

it('renders matrix without inventing missing pairs, and overlapping domain counts without percentages', () => {
  mount();
  expect(text('cell-matrix-Discovery-')).toBe('33.3%');
  expect(text('cell-matrix-Pricing-commercial')).toBe('0.0%');
  expect(text('cell-matrix-Pricing-')).toBe('');
  expect(screen.getByText('No tags')).toBeTruthy();
  expect(text('row-domain-kahvila.fi')).toContain('2');
  expect(text('row-category-owned')).not.toContain('%');
});

it('lists opportunities as project-wide, open only, without write calls', () => {
  mount();
  expect(text('text-opportunities-scope')).toContain('Project-wide');
  expect(screen.getByTestId('row-opportunity-a')).toBeTruthy();
  expect(screen.queryByTestId('row-opportunity-done')).toBeNull();
});

it('KPI evidence drill filters recent answers via the URL', async () => {
  const user = userEvent.setup();
  mount();
  expect(answerIds()).toEqual(['citation', 'excluded', 'mention', 'recommendation', 'span-only']);
  await user.click(screen.getByTestId('button-drill-position'));
  expect(params().get('evidence')).toBe('ordered');
  expect(answerIds()).toEqual(['mention']);
});

it('scopes answers to the selected date, provider, topic and group', () => {
  data.evidence.push(
    evidence('old', { observedAt: Date.parse('2026-08-01T00:00:00Z') }),
    evidence('other-group', { runId: 'not-in-group' }),
    evidence('gemini', { provider: 'Gemini' }),
    evidence('pricing', { topic: 'Pricing' }),
  );
  mount('en', '&provider=OpenAI&topic=Discovery');
  expect(answerIds()).not.toContain('old');
  expect(answerIds()).not.toContain('other-group');
  expect(answerIds()).not.toContain('gemini');
  expect(answerIds()).not.toContain('pricing');
});

it('searches and paginates locally over the complete evidence, with explicit empty states', async () => {
  const user = userEvent.setup();
  data.evidence = Array.from({ length: 23 }, (_, i) => evidence(`e${String(i).padStart(2, '0')}`, { observedAt: Date.parse('2026-10-12T10:00:00Z') - i * 1000, answer: i === 17 ? 'Needle here' : 'hay' }));
  mount();
  expect(text('text-answers-total')).toBe('1–10 of 23');
  await user.click(screen.getByTestId('button-answers-next-page'));
  await user.click(screen.getByTestId('button-answers-next-page'));
  expect(text('text-answers-total')).toBe('21–23 of 23');
  await user.type(screen.getByTestId('input-search-answers'), 'needle');
  expect(answerIds()).toEqual(['e17']);
  await user.clear(screen.getByTestId('input-search-answers'));
  await user.type(screen.getByTestId('input-search-answers'), 'zzz');
  expect(screen.getByText('No answers match')).toBeTruthy();
});

it('opens a deep-linked answer, steps across page boundaries, and closes cleanly', async () => {
  const user = userEvent.setup();
  data.evidence = Array.from({ length: 12 }, (_, i) => evidence(`e${String(i).padStart(2, '0')}`, { observedAt: Date.parse('2026-10-12T10:00:00Z') - i * 1000, brandNames: ['Kahvila'], answer: `Try Kahvila ${i}` }));
  mount('en', '&answer=e09');
  const dialog = screen.getByTestId('dialog-answer');
  expect(within(dialog).getByTestId('text-evidence-answer').textContent).toBe('Try Kahvila 9');
  expect(within(dialog).getByTestId('highlight-brand').textContent).toBe('Kahvila');
  expect(text('text-answer-position')).toBe('10 / 12');
  expect(within(dialog).getByTestId('link-answer-result').getAttribute('href')).toBe('/en/dashboard/results/e09?project=project-test&from=2026-09-17&to=2026-10-14');
  await user.click(screen.getByTestId('button-answer-next'));
  expect(params().get('answer')).toBe('e10');
  expect(text('text-answers-page')).toBe('Page 2 of 2');
  await user.keyboard('{Escape}');
  expect(screen.queryByTestId('dialog-answer')).toBeNull();
  expect(params().has('answer')).toBe(false);
});

it('never shows a stale answer after the selection changes', () => {
  const view = mount('en', '&answer=mention');
  expect(screen.getByTestId('dialog-answer')).toBeTruthy();
  data = { ...analyticsFixture(), selectedGroup: 'group-b', groups: [{ id: 'group-b', runCount: 1 }], runs: [{ id: 'r2', group: 'group-b', kind: 'monitoring', status: 'completed', createdAt: Date.parse('2026-10-13T10:00:00Z'), metrics: metrics() }] };
  act(() => rerender(view));
  expect(screen.queryByTestId('dialog-answer')).toBeNull();
  expect(params().has('answer')).toBe(false);
});

it('renders unavailable metrics as dashes but measured zero as zero', () => {
  data.metrics = metrics({ state: 'unavailable', eligible: 0, visibility: null, recommendationRate: null, citationRate: null, brandOrder: undefined });
  const view = mount();
  for (const k of ['visibility', 'win-rate', 'position', 'owned-citations', 'share']) expect(text(`value-${k}`)).toBe('–');
  data.metrics = metrics({ visibility: 0 });
  rerender(view);
  expect(text('value-visibility')).toBe('0.0%');
});

it('explains collection surfaces and the tracked-brand scope instead of claiming win rate is impossible', () => {
  mount();
  const note = text('text-methodology-note');
  expect(note).toContain('tracked prompts');
  expect(note).toContain('API answers are not presented as consumer observations');
  expect(note).toContain('frozen tracked-brand set');
  expect(note).not.toContain('cannot be measured');
});

it('shows a versioned missing-data state on older servers instead of substituting list position', () => {
  data.metrics.brandOrder = undefined;
  mount();
  expect(text('value-position')).toBe('–');
  expect(text('value-win-rate')).toBe('–');
  expect(text('note-position')).toContain('backend update');
});

it('explains missing collection and failed sentiment without claiming neutral sentiment', () => {
  data.metrics.sentiment = { state: 'partial', sampleSize: 1, mentionedAnswers: 3, states: { failed: 2 } };
  mount();
  expect(text('panel-data-availability')).toContain('3 / 5 usable answers');
  expect(text('coverage-missing')).toContain('2 expected answers');
  expect(text('gap-sentiment')).toContain('2 analyses failed');
  expect(text('gap-sentiment')).toContain('not treated as neutral');
  expect(screen.getByTestId('gap-competitors')).toBeTruthy();
});

it('restores recommendations and the documented visibility score with their real denominators', () => {
  mount();
  expect(text('value-recommendations')).toBe('50.0%');
  expect(text('denom-recommendations')).toContain('1 / 2 classified');
  expect(text('value-score')).toBe('3.3 / 10');
});

it('explains missing prompt metadata instead of drawing an unlabelled matrix', () => {
  data.overview.matrix = [{ topic: '', tag: '', metrics: metrics() }];
  mount();
  expect(screen.queryByTestId('table-topic-matrix')).toBeNull();
  expect(text('gap-topics')).toContain('no topics or tags');
  expect(text('panel-topic-matrix')).toContain('old results are not relabelled');
});

it('automatically requests a usable group only when the user has not selected a group or run', () => {
  const usable = analyticsFixture();
  const initial = { ...analyticsFixture(), selectedGroup: 'empty', metrics: metrics({ eligible: 0 }), groups: [...usable.groups, { id: 'empty', runCount: 1 }] };
  api.analytics.mockImplementation((_id, filters) => ({ data: filters.group === 'group-a' ? usable : initial, isPending: false, isError: false }));
  mount();
  expect(params().get('group')).toBe('group-a');
  expect(text('notice-usable-group')).toContain('newest group had no usable answers');
  expect(text('value-visibility')).toBe('33.3%');
});

it.each(['&group=empty', '&run=failed'])('preserves explicit selection %s even if another group has results', (query) => {
  data.metrics.eligible = 0;
  data.selectedGroup = 'empty';
  data.groups.push({ id: 'empty', runCount: 1 });
  mount('en', query);
  expect(params().get('group')).not.toBe('group-a');
  expect(screen.queryByTestId('notice-usable-group')).toBeNull();
});

it('opens tracked-brand evidence from the sortable comparison table and clears it explicitly', async () => {
  const user = userEvent.setup();
  data.competitors = [{ brandName: 'Kahvila', isOwned: true, ownedDomains: ['kahvila.fi'], metrics: metrics(), change: null }];
  mount();
  expect(text('table-competitor-comparison')).toContain('SoV');
  expect(text('table-competitor-comparison')).toContain('Sentiment');
  expect(text('table-competitor-comparison')).toContain('Win rate');
  await user.click(screen.getByRole('button', { name: 'View answers mentioning Kahvila' }));
  expect(params().get('evidenceBrand')).toBe('Kahvila');
  expect(answerIds()).toEqual(['mention']);
  await user.click(screen.getByRole('button', { name: 'Show all brands' }));
  expect(params().has('evidenceBrand')).toBe(false);
  expect(answerIds().length).toBe(5);
});

it('exposes exact mention-order evidence in the answer drawer', () => {
  mount('en', '&answer=mention');
  const details = within(screen.getByTestId('section-answer-brand-order'));
  expect(details.getByText('First-mention order')).toBeTruthy();
  expect(details.getByText('#2 · Kahvila')).toBeTruthy();
  expect(details.getByText('“Kahvila” · 12–19')).toBeTruthy();
});

it('win-rate drilldown excludes non-first, failed and unavailable observations', async () => {
  const user = userEvent.setup();
  const first = { version: 'tracked-literal-first-mention-v1', scope: 'tracked_cohort', state: 'observed', reason: null, targetPosition: 1, mentions: [] };
  data.evidence.push(evidence('first', { mentioned: true, brandOrder: first }));
  data.evidence.push(evidence('failed-first', { exclusion: 'timeout', brandOrder: first }));
  mount();
  await user.click(screen.getByTestId('button-drill-win-rate'));
  expect(params().get('evidence')).toBe('first');
  expect(answerIds()).toEqual(['first']);
});

it('shows an honest empty monitoring state without KPIs, timestamps or quick-check panels', () => {
  data.totalRuns = 0; data.runs = [];
  mount();
  expect(screen.getByText('No monitoring runs in the selected range')).toBeTruthy();
  expect(screen.queryByTestId('section-kpis')).toBeNull();
  expect(screen.queryByTestId('text-last-updated')).toBeNull();
  expect(screen.queryByTestId('panel-quick-check-snapshot')).toBeNull();
});

it('analytics unavailable keeps the workflow header', () => {
  api.analytics.mockReturnValue({ data: undefined, isPending: false, isError: true, unavailable: true, error: { status: 404 } });
  mount();
  expect(screen.getByTestId('button-manage-prompts')).toBeTruthy();
});
