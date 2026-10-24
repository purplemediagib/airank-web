import { useMemo, useRef } from 'react';
import type { AnalyticsEvidence } from '@workspace/api-client-react';
import { useDocumentTitle } from '@/i18n';
import { useProjects } from '@/lib/project-context';
import { useQueryParam } from '@/lib/use-query-param';
import { useAnalytics, useAnalyticsFilters } from '@/lib/use-analytics';
import { EmptyState, LoadingBlock, PageHeader, Panel } from '@/components/airank/primitives';
import { SubTabs } from '@/components/airank/forms';
import { useL } from '@/components/airank/analytics';
import { AnalyticsFilterBar } from '@/components/airank/analytics-filters';
import { ResearchFailure, clampPage } from '@/components/airank/research-parts';
import { CoverageNote, KindTabs, SourceEvidence, SourceTable } from '@/components/airank/source-workbench';
import { useToast } from '@/hooks/use-toast';
import { useIntelligenceAction } from '@/lib/use-intelligence';
import { FanoutPanel } from '@/components/airank/intelligence-workbench';
import { asKind, domainRows, filterRows, typeCounts, urlRows, type SourceRow } from '@/lib/source-workbench';

export default function SourcesPage() {
  const L = useL();
  const { project } = useProjects();
  const f = useAnalyticsFilters();
  const q = useAnalytics(project?.id ?? '', f.params);
  useDocumentTitle(L('Lähteet', 'Sources'));
  const [kindRaw, setKind] = useQueryParam('kind', 'citation');
  const [text, setText] = useQueryParam('q', '');
  const [cat, setCat] = useQueryParam('owned', 'all');
  const [sort, setSort] = useQueryParam('sort', 'answers');
  const [pageRaw, setPage] = useQueryParam('page', '1');
  const [type, setType] = useQueryParam('stype', 'all');
  const { toast } = useToast();
  const act = useIntelligenceAction(project?.id ?? '');
  const [src, setSrc] = useQueryParam('src', '');
  const [tabRaw] = useQueryParam('tab', 'domain');
  const by = tabRaw === 'url' ? 'url' : 'domain';
  const kind = asKind(kindRaw);
  const trigger = useRef<HTMLElement | null>(null);
  const a = q.data;
  const s = a?.overview?.sources;
  const evidence = useMemo(() => new Map<string, AnalyticsEvidence>((a?.evidence ?? []).map((e) => [e.id, e])), [a]);
  const all = useMemo(() => (s ? (by === 'url' ? urlRows(s.items, kind) : domainRows(s.items, kind)) : []), [s, by, kind]);
  const rows = useMemo(() => filterRows(all, text, cat, sort, type), [all, text, cat, sort, type]);
  const tc = useMemo(() => (s ? typeCounts(s.items, kind) : null), [s, kind]);
  const page = clampPage(pageRaw, rows.length);
  // Only current filtered data may resolve the URL; never retain a stale row
  // from another workspace, date window, grouping or evidence kind.
  const row = src ? rows.find((r) => r.key === src) ?? null : null;
  const reset = (fn: (v: string) => void) => (v: string) => { fn(v); setPage('1'); };
  if (!project) return null;
  const ctx = '&' + new URLSearchParams(Object.entries(f.params).map(([k, v]) => [k, String(v)])).toString();
  const close = () => { setSrc(''); };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={L('Lähteet', 'Sources')} subtitle={L('Todisteet vastauksista: eksplisiittiset viittaukset, lähdeviitteet, hakutulokset ja vastauksen linkit erikseen. Luvut ovat yksilöllisiä vastauksia.', 'Evidence from answers: explicit citations, source references, search results and answer links kept apart. Counts are unique answers.')} />
      <AnalyticsFilterBar f={f} a={a} />
      {q.isError && a && <p role="status" className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] text-warning" data-testid="text-sources-stale">{L('Päivitys epäonnistui. Näytetään viimeksi haetut lähteet.', 'Refresh failed. Showing the last loaded sources.')} <button type="button" className="font-semibold underline" onClick={() => void q.refetch()}>{L('Yritä uudelleen', 'Retry')}</button></p>}
      {q.isPending ? <Panel className="p-4"><LoadingBlock rows={6} /></Panel> : !a ? <Panel><ResearchFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel>
        : !s ? <Panel><EmptyState title={L('Vaatii taustapalvelun päivityksen', 'Backend upgrade needed')} body={L('Tämä palvelin ei palauta lähdetodisteita.', 'This server does not return source evidence.')} /></Panel> : (
        <>
          <KindTabs s={s} kind={kind} onKind={(k) => { setKind(k); setPage('1'); setSrc(''); }} />
          <CoverageNote s={s} kind={kind} />
          {tc?.supported && <p className="tabular text-[12px] text-muted-ink" data-testid="text-type-counts">{L(`Julkaisijatyyppi (${tc.urls} URL-osoitetta): `, `Publisher type (${tc.urls} URLs): `)}{Object.entries(tc.counts).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}. {L('Luokitus kuvaa julkaisijaa tai alustaa, ei sisällön totuutta eikä omistajuutta.', 'Classification describes the publisher or platform, not content truth or ownership.')}</p>}
          <SubTabs label={L('Ryhmittely', 'Grouping')} fallback="domain" tabs={[{ value: 'domain', label: `${L('Verkkotunnukset', 'Domains')}` }, { value: 'url', label: 'URL' }]}>
            {(tab) => <SourceTable key={tab + kind} by={tab === 'url' ? 'url' : 'domain'} kind={kind} rows={rows} total={all.length} q={text} onQ={reset(setText)} cat={cat} onCat={reset(setCat)} type={type} onType={reset(setType)} typeSupported={!!tc?.supported && !!a?.intelligence?.available} reviewBusy={act.pending} onReview={(domain, t) => act.run({ action: 'source_review', domain, sourceType: t as never }, { onSuccess: () => toast({ title: L('Luokitus tallennettu', 'Classification saved') }), onError: (m) => toast({ variant: 'destructive', title: L(`Tallennus epäonnistui (${m})`, `Save failed (${m})`) }) })} sort={sort} onSort={reset(setSort)}
              page={page} onPage={(p) => setPage(String(p))} onOpen={(r, el) => { trigger.current = el; setSrc(r.key); }} />}
          </SubTabs>
          <FanoutPanel a={a} projectId={project.id} context={ctx} />
          <SourceEvidence row={row} evidence={evidence} projectId={project.id} context={ctx} onClose={close} onCloseFocus={() => trigger.current?.focus()} />
        </>
      )}
    </div>
  );
}
