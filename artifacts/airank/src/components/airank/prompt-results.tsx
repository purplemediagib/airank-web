import { useMemo } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useResults } from '@/lib/use-results';
import { EmptyState, ErrorState, LoadingBlock, Panel } from './primitives';
import { useL } from './analytics';
import { Pager, ResultsTable } from './sentiment';
import type { ReactNode } from 'react';
import { MonitoringEntryLink } from './saved-quick-checks';

/** Saved answers for one prompt (all versions), via the promptId results filter. No aggregates are computed client-side. */
export function PromptResults({ projectId, promptId, currentVersion, market, language, fallback, metrics }: { projectId: string; promptId: string; currentVersion: number; market: string; language: string; fallback?: ReactNode; metrics?: ReactNode }) {
  const L = useL();
  const { href } = useI18n();
  const search = useSearch();
  const [location, navigate] = useLocation();
  const page = Math.max(1, Number.parseInt(new URLSearchParams(search).get('rpage') ?? '1', 10) || 1);
  const params = useMemo(() => ({ promptId, page, pageSize: 10 }), [promptId, page]);
  const q = useResults(projectId, params);
  const ctx = (extra = '') => `project=${encodeURIComponent(projectId)}&prompt=${encodeURIComponent(promptId)}${extra}`;
  const openHref = (id: string) => `${href(`/dashboard/results/${encodeURIComponent(id)}`)}?${ctx(`&pageSize=10${page > 1 ? `&page=${page}` : ''}`)}`;
  const setPage = (p: number) => { const sp = new URLSearchParams(window.location.search); if (p > 1) sp.set('rpage', String(p)); else sp.delete('rpage'); navigate(`${location}?${sp}`, { replace: true }); };
  const items = q.data?.items ?? [];
  const versions = new Set(items.map((i) => i.promptVersion).filter((v) => v !== null && v !== undefined));
  return (
    <Panel className="overflow-hidden" aria-labelledby="prompt-results-h">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="prompt-results-h" className="text-base font-semibold text-ink">{L('Tallennetut vastaukset', 'Saved answers')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-ink">{L(`Markkina ${market} · kieli ${language}. Vastaukset näytetään alkuperäisellä kielellään.`, `Market ${market} · language ${language}. Answers are shown in their original language.`)}</p>
        </div>
        <Link href={`${href('/dashboard/results')}?${ctx()}`} className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline" data-testid="link-prompt-all-results">{L('Avaa tulosnäkymässä', 'Open in results explorer')} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
      </div>
      {metrics}
      <p className="px-5 pt-4 text-[11px] text-muted-ink" data-testid="text-all-versions-note">{L('Alla: tallennetut vastaukset kaikista versioista. Eri versioita ei yhdistetä trendiksi; versio näkyy jokaisessa vastauksessa.', 'Below: saved answers from all versions. Different versions are never combined into a trend; each answer shows its version.')}</p>
      {versions.size > 1 && <p className="px-5 pb-2 text-[11px] text-[#8a6d1d]" data-testid="text-mixed-versions">{L(`Tällä sivulla on vastauksia useista versioista (nykyinen v${currentVersion}).`, `This page contains answers from multiple versions (current v${currentVersion}).`)}</p>}
      {q.isPending ? <div className="p-4"><LoadingBlock rows={4} /></div>
        : q.isError && !q.data ? (q.unavailable ? (fallback ?? <EmptyState compact title={L('Tulosrajapinta ei ole saatavilla', 'Results API not available')} />) : <ErrorState onRetry={() => void q.refetch()} />)
        : !items.length ? <EmptyState compact title={L('Ei vielä vastauksia', 'No answers yet')} body={L('Tämän seuratun kysymyksen vastaukset näkyvät seuranta-ajon jälkeen. Pikatarkistusten vastauksia ei yhdistetä tähän kysymykseen.', 'Answers for this tracked prompt appear after a monitoring run. Quick-check answers are not linked to this prompt.')} action={<MonitoringEntryLink projectId={projectId} testId="link-prompt-start-monitoring" />} />
        : <>
          <ResultsTable items={items} openHref={openHref} showQuestion={false} testId="table-prompt-results" />
          <Pager page={q.data!.page} pageSize={q.data!.pageSize} total={q.data!.total} hasMore={q.data!.hasMore} onPage={setPage} testId="pager-prompt-results" />
        </>}
    </Panel>
  );
}
