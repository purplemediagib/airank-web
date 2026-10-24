import { Link } from 'wouter';
import { useDocumentTitle, useI18n } from '@/i18n';
import { PageHeader, Panel, LoadingBlock, StatusBadge, ErrorState } from '@/components/airank/primitives';
import { DataTable } from '@/components/airank/data';
import { SubTabs } from '@/components/airank/forms';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/lib/project-context';
import { useAnalytics, useAnalyticsFilters, toMs } from '@/lib/use-analytics';
import { AnalyticsFilterBar } from '@/components/airank/analytics-filters';
import { AnalyticsFailure, groupLabel, isDiagnostic, pctText, useL, runStatus, changeLabel, changeImpact } from '@/components/airank/analytics';
import { useQuickCheckSummary } from '@/lib/quick-check-summary';

export default function HistoryPage() {
  const { d, date, pct, href } = useI18n();
  const L = useL();
  useDocumentTitle(d.features.history.title);
  const { project } = useProjects();
  const f = useAnalyticsFilters();
  const checks = useQuickCheckSummary();
  const metricsLink = (id: string, group: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete('tab'); params.set('run', id); params.set('group', group);
    return `${href('/dashboard')}?${params}`;
  };
  const q = useAnalytics(project?.id ?? '', f.params);
  const a = q.data;
  const fmt = (n: number) => date(new Date(toMs(n)), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <PageHeader title={d.features.history.title} subtitle={L('Seuranta-ajot ja tunnisteiden sekä kysymysversioiden muutokset.', 'Monitoring runs and identity and prompt version changes.')} />
      <AnalyticsFilterBar f={f} a={a} />
      {q.isPending ? <Panel className="p-6"><LoadingBlock rows={5} /></Panel> : q.isError || !a ? <Panel>{q.isError ? <AnalyticsFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /> : <ErrorState />}</Panel> :
        <SubTabs fallback="runs" label={d.features.history.title} tabs={[{ value: 'runs', label: d.tabs.runs }, { value: 'changes', label: d.tabs.changes }]}>
          {(tab) => tab === 'runs' ? (
            <Panel className="overflow-hidden">
              <DataTable testId="table-runs" caption={d.tabs.runs} rows={a.runs} rowKey={(r) => r.id}
                columns={[
                  { key: 'started', header: L('Tarkistus', 'Check'), cell: (r) => fmt(r.createdAt), sortValue: (r) => r.createdAt },
                  { key: 'group', header: L('Paneeli', 'Panel'), cell: (r) => <span>{groupLabel(a, r.group, L)}{!r.comparableToPrevious && <span className="block text-[12px] text-muted-ink">{L('Ei vertailukelpoinen edelliseen', 'Not comparable to previous')}</span>}</span> },
                  { key: 'status', header: L('Tila', 'Status'), cell: (r) => { const st = runStatus(r.status, L); return <StatusBadge tone={st.tone}>{st.label}</StatusBadge>; } },
                  { key: 'coverage', header: L('Kattavuus', 'Coverage'), align: 'right', cell: (r) => `${r.metrics.eligible}/${r.metrics.expected}` },
                  { key: 'visibility', header: d.overview.visibility, align: 'right', cell: (r) => isDiagnostic(r) ? <span className="text-muted-ink">{L('Ei mittareissa', 'Excluded')}</span> : pctText(r.metrics.visibility, pct) ?? '–', sortValue: (r) => r.metrics.visibility },
                  { key: 'open', header: '', align: 'right', cell: (r) => <div className="flex justify-end gap-1">
                    {!isDiagnostic(r) && <Button size="sm" variant="secondary" asChild><Link href={metricsLink(r.id,r.group)} data-testid={`link-run-metrics-${r.id}`}>{L('Mittarit', 'Metrics')}</Link></Button>}
                    <Button size="sm" variant="secondary" asChild><Link href={`${href('/dashboard/prompts')}?project=${project?.id}&tab=runs&run=${r.id}`} data-testid={`link-run-${r.id}`}>{L('Vastaukset', 'Answers')}</Link></Button>
                  </div> },
                ]}
                emptyTitle={L('Ei seuranta-ajoja valitulla aikavälillä', 'No monitoring runs in the selected range')} />
              {a.quickChecks > 0 && <p className="px-5 pb-4 text-[12px] text-muted-ink">{L(`Lisäksi ${a.quickChecks} pikatarkistusta (eivät mittareissa).`, `Plus ${a.quickChecks} quick checks (not in metrics).`)}</p>}
            </Panel>
          ) : (
            <Panel className="overflow-hidden">
              <DataTable testId="table-changes" caption={d.tabs.changes} rows={a.changes} rowKey={(r) => `${r.id}-${r.version}-${r.type}`}
                columns={[
                  { key: 'when', header: L('Aika', 'When'), cell: (r) => date(r.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }), sortValue: (r) => r.createdAt },
                  { key: 'type', header: L('Muutos', 'Change'), cell: (r) => <span>{changeLabel(r.type, L)} <span className="text-muted-ink">v{r.version}</span></span> },
                  { key: 'impact', header: L('Vaikutus vertailuun', 'Effect on comparison'), cell: (r) => changeImpact(r.type, L) },
                ]}
                emptyTitle={L('Ei kirjattuja muutoksia', 'No recorded changes')}
                emptyBody={L('Muutokset tunnisteisiin tai kehotteisiin katkaisevat vertailukelpoisuuden.', 'Changes to identity or prompts break comparability.')} />
            </Panel>
          )}
        </SubTabs>}
      <Panel className="overflow-hidden">
        <h2 className="p-5 text-lg font-semibold">{L('Pikatarkistusten historia', 'Quick-check history')}</h2>
        <p className="px-5 pb-4 text-sm text-muted-ink">{L('Erillinen menetelmä. Päivämäärärajaus koskee tätä luetteloa; seurannan palvelu- ja aiherajaukset eivät koske pikatarkistuksia.', 'Separate methodology. The date range applies here; monitoring provider and topic filters do not apply to quick checks.')}</p>
        {checks.isError ? <ErrorState onRetry={() => void checks.refetch()} /> : checks.isPending ? <LoadingBlock rows={2} /> :
        <DataTable testId="table-quick-history" caption={L('Tallennetut pikatarkistukset', 'Saved quick checks')} rows={(checks.data ?? []).filter(r=>{const day=new Date(toMs(r.created_at)).toISOString().slice(0,10);return day>=f.from&&day<=f.to;})} rowKey={r=>r.id} columns={[
          {key:'time',header:L('Aika','Time'),cell:r=>fmt(r.created_at),sortValue:r=>r.created_at},
          {key:'domain',header:L('Verkkotunnus','Domain'),cell:r=>r.domain},
          {key:'open',header:'',cell:r=><Button asChild size="sm" variant="secondary"><Link href={`${href('/start')}?project=${project?.id}&scan=${r.id}`}>{L('Avaa alkuperäinen raportti','Open original report')}</Link></Button>},
        ]} emptyTitle={L('Ei pikatarkistuksia valitulla aikavälillä','No quick checks in this range')} />}
      </Panel>
    </>
  );
}
