import { useMemo } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Inbox, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle, useI18n } from '@/i18n';
import { useProjects } from '@/lib/project-context';
import { useResults } from '@/lib/use-results';
import { useRuns, usePromptList } from '@/lib/use-prompts';
import { useMeasurementSettings } from '@/lib/use-reports';
import { useAnalytics, useAnalyticsFilters, toMs } from '@/lib/use-analytics';
import { measurementProviderLabel } from '@/lib/provider-labels';
import { RESULT_STATES, collectionInfo, resultParamsFromSearch, resultsContextQuery } from '@/lib/sentiment';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, ReasonNote } from '@/components/airank/primitives';
import { FilterSelect } from '@/components/airank/data';
import { useL } from '@/components/airank/analytics';
import { Pager, ResultsTable } from '@/components/airank/sentiment';
import { MonitoringEntryLink } from '@/components/airank/saved-quick-checks';
import { MeasurementContextFilters } from '@/components/airank/analytics-filters';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default function ResultsPage() {
  const L = useL();
  const { href, date } = useI18n();
  const search = useSearch();
  const [location, navigate] = useLocation();
  const { project } = useProjects();
  const projectId = project?.id ?? '';
  useDocumentTitle(L('Tulokset', 'Results'));
  const params = useMemo(() => resultParamsFromSearch(search), [search]);
  const sp = new URLSearchParams(search);
  const q = useResults(projectId, params);
  const runs = useRuns(projectId);
  const settings = useMeasurementSettings(projectId);
  const prompts = usePromptList(projectId, { status: 'active' });
  const af = useAnalyticsFilters();
  const analytics = useAnalytics(projectId, af.params);

  /** Changing any filter resets pagination to page 1. */
  const setFilter = (k: string, v: string) => {
    const p = new URLSearchParams(window.location.search);
    if (k !== 'page' && k !== 'state' && p.has('group')) p.set('group','latest');
    if (k === 'prompt') { p.delete('promptId'); p.delete('promptVersion'); }
    if (k === 'run') p.delete('runId');
    if (!v || v === 'all') p.delete(k); else p.set(k, v);
    if (k !== 'page') p.delete('page');
    navigate(`${location}?${p.toString()}`, { replace: k !== 'page' });
  };
  const clear = () => navigate(`${location}?project=${encodeURIComponent(projectId)}`, { replace: true });
  const filtered = ['run', 'prompt', 'provider', 'topic', 'state', 'from', 'to', 'tag', 'tags', 'tagMode', 'market', 'language', 'surface', 'promptId', 'promptVersion', 'group'].some((k) => sp.get(k));
  const ctx = resultsContextQuery(search);
  const openHref = (id: string) => `${href(`/dashboard/results/${encodeURIComponent(id)}`)}?${ctx}`;

  const providers = Array.from(new Set([...(settings.data?.providers ?? []), ...(analytics.data?.availableProviders ?? []), ...(params.provider ? [params.provider] : [])]));
  const topics = Array.from(new Set([...(analytics.data?.topics ?? []), ...(params.topic ? [params.topic] : [])]));
  const runOpts = (runs.data ?? []).slice().sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 50);
  const promptOpts = prompts.data?.items ?? [];

  const items = q.data?.items ?? [];
  const pageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.state ?? 'unknown'] = (c[i.state ?? 'unknown'] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="flex flex-col gap-5" data-testid="page-results">
      <PageHeader title={L('Tulokset', 'Results explorer')} subtitle={L('Tallennetut vastaukset ja keskeneräiset tehtävät. Avaa vastaus nähdäksesi alkuperäisen tekstin ja todisteet.', 'Saved answers and unfinished tasks. Open an answer to inspect the original text and evidence.')} />
      <Panel className="flex flex-col gap-3 p-4" aria-labelledby="results-filters">
        <h2 id="results-filters" className="sr-only">{L('Suodattimet', 'Filters')}</h2>
        <div className="flex flex-wrap items-center gap-2"><MeasurementContextFilters f={af} a={analytics.data} /></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect label={L('Ajo', 'Run')} testId="select-run" value={sp.get('run') ?? 'all'} onChange={(v) => setFilter('run', v)}
            options={[{ value: 'all', label: `${L('Ajo', 'Run')}: ${L('Kaikki', 'All')}` }, ...runOpts.map((r) => ({ value: r.id, label: `${date(new Date(toMs(r.createdAt)), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${r.status}` })), ...(params.runId && !runOpts.some((r) => r.id === params.runId) ? [{ value: params.runId, label: params.runId.slice(0, 8) }] : [])]} />
          <FilterSelect label={L('Kysymys', 'Prompt')} testId="select-prompt" value={sp.get('prompt') ?? sp.get('promptId') ?? 'all'} onChange={(v) => setFilter('prompt', v)}
            options={[{ value: 'all', label: `${L('Kysymys', 'Prompt')}: ${L('Kaikki', 'All')}` }, ...promptOpts.map((p) => ({ value: p.id, label: p.text.length > 70 ? `${p.text.slice(0, 69)}…` : p.text })), ...(params.promptId && !promptOpts.some((p) => p.id === params.promptId) ? [{ value: params.promptId, label: `${L('Kysymys', 'Prompt')} ${params.promptId.slice(0, 8)}` }] : [])]} />
          <FilterSelect label={L('Palvelu', 'Provider')} testId="select-provider" value={sp.get('provider') ?? 'all'} onChange={(v) => setFilter('provider', v)}
            options={[{ value: 'all', label: `${L('Palvelu', 'Provider')}: ${L('Kaikki', 'All')}` }, ...providers.map((p) => ({ value: p, label: measurementProviderLabel(p) }))]} />
          <FilterSelect label={L('Aihe', 'Topic')} testId="select-topic" value={sp.get('topic') ?? 'all'} onChange={(v) => setFilter('topic', v)}
            options={[{ value: 'all', label: `${L('Aihe', 'Topic')}: ${L('Kaikki', 'All')}` }, ...topics.map((t) => ({ value: t, label: t }))]} />
          <FilterSelect label={L('Keruun tulos', 'Collection outcome')} testId="select-state" value={sp.get('state') ?? 'all'} onChange={(v) => setFilter('state', v)}
            options={[{ value: 'all', label: `${L('Keruun tulos', 'Outcome')}: ${L('Kaikki', 'All')}` }, ...RESULT_STATES.map((s) => ({ value: s, label: collectionInfo(s, L).label }))]} />
          <label className="flex flex-col gap-1 text-[12px] text-muted-ink">{L('Alkaen (UTC)', 'From (UTC)')}
            <input type="date" value={sp.get('from') ?? ''} max={sp.get('to') ?? undefined} onChange={(e) => setFilter('from', DAY.test(e.target.value) ? e.target.value : '')} className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan" data-testid="input-from" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-muted-ink">{L('Päättyen (UTC)', 'To (UTC)')}
            <input type="date" value={sp.get('to') ?? ''} min={sp.get('from') ?? undefined} onChange={(e) => setFilter('to', DAY.test(e.target.value) ? e.target.value : '')} className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan" data-testid="input-to" />
          </label>
          {filtered && <Button variant="ghost" className="self-end" onClick={clear} data-testid="button-clear-filters"><X aria-hidden />{L('Tyhjennä suodattimet', 'Clear filters')}</Button>}
        </div>
        <p className="text-[11px] leading-4 text-muted-ink">{L('Päivämäärät ovat ajon luontipäiviä UTC-ajassa, molemmat päivät mukaan lukien. Haku- ja sävysuodatusta ei tueta tässä rajapinnassa.', 'Dates are inclusive UTC run-creation dates. Free-text and sentiment filtering are not supported by this API.')}</p>
      </Panel>

      <Panel className="overflow-hidden" aria-labelledby="results-list">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <h2 id="results-list" className="text-base font-semibold text-ink">{L('Vastaukset', 'Answers')}</h2>
          {q.data && (
            <p className="text-[12px] text-muted-ink" data-testid="text-results-counts">
              <b className="tabular text-ink">{q.data.total}</b> {L('vastaavaa tehtävää', 'matching tasks')}
              {items.length > 0 && <> · {L('Tällä sivulla', 'On this page')}: {Object.entries(pageCounts).map(([k, n]) => `${n} ${collectionInfo(k, L).label.toLowerCase()}`).join(', ')}</>}
            </p>
          )}
        </div>
        {q.isPending ? <div className="p-4"><LoadingBlock rows={6} /></div>
          : q.forbidden ? <EmptyState title={L('Ei käyttöoikeutta', 'Access denied')} body={L('Tämä projekti ei kuulu tilillesi.', 'This project does not belong to your account.')} />
          : q.isError && !q.data ? (q.unavailable ? <EmptyState title={L('Tulokset eivät ole saatavilla tällä palvelimella', 'Results are not available on this server')} body={L('Tulosnäkymä vaatii taustapalvelun 0.11.0. Aiemmat vastaukset löytyvät kysymyksistä ja historiasta.', 'The results view requires backend 0.11.0. Earlier answers remain available in Prompts and History.')} /> : <ErrorState onRetry={() => void q.refetch()} />)
          : !items.length ? <EmptyState icon={<Inbox className="size-[18px]" aria-hidden />} title={filtered ? L('Ei suodattimia vastaavia tuloksia', 'No results match these filters') : L('Ei vielä tallennettuja vastauksia', 'No saved answers yet')} body={filtered ? L('Muuta tai tyhjennä suodattimia.', 'Change or clear the filters.') : L('Vastaukset näkyvät keruun valmistuttua. Tarkista keruun tila ja hallitse kysymyksiä Kysymykset-sivulla.', 'Answers appear when collection completes. Check collection status and manage tracked prompts on the Prompts page.')} action={!filtered && projectId ? <MonitoringEntryLink projectId={projectId} testId="link-results-start-monitoring" /> : undefined} />
          : <>
            {q.isError && <div className="px-4 pt-3"><ReasonNote tone="warning">{L('Päivitys epäonnistui. Näytetään viimeksi haetut vastaukset.', 'Refresh failed. Showing the last loaded answers.')}</ReasonNote></div>}
            <div className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}><ResultsTable items={items} openHref={openHref} /></div>
            <Pager page={q.data!.page} pageSize={q.data!.pageSize} total={q.data!.total} hasMore={q.data!.hasMore} onPage={(p) => setFilter('page', String(p))} />
          </>}
      </Panel>
      {q.pollingStopped && <p className="text-[11px] text-muted-ink" data-testid="text-polling-stopped">{L('Automaattinen päivitys pysähtyi. Lataa sivu uudelleen nähdäksesi uusimman tilan.', 'Automatic refresh has stopped. Reload the page to see the latest state.')}</p>}
      <p className="text-[11px] text-muted-ink">{L('Sivun avaaminen tai päivittäminen ei käynnistä uutta hakua tai maksullista analyysiä.', 'Opening or refreshing this page never starts a new scan or paid analysis.')} <Link href={`${href('/dashboard/methodology')}?project=${encodeURIComponent(projectId)}`} className="text-link hover:underline" data-testid="link-methodology">{L('Menetelmä', 'Methodology')}</Link></p>
    </div>
  );
}
