import './_group.css';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  EvidenceList, EmptyState, GroupTrend, KpiCard, metricSample, metricStateLabel,
  FilterSelect, PageHeader, Panel, pctText, ReasonNote, sampleAccount, sampleAnalytics,
  sampleProject, sampleQuickChecks, StatusBadge, useMockLocale,
} from './_shared';

/**
 * Faithful isolated extraction of AI Rank's existing overview page.
 * All account, project, query, research and navigation values are local illustrative stubs.
 * Nothing in this preview calls or imports the AI Rank app or API.
 */
export function Current() {
  const { locale, setLocale, c } = useMockLocale();
  const L = (fi: string, en: string) => locale === 'fi' ? fi : en;
  const num = (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', options).format(value);
  const pct = (fraction: number, digits = 1) => new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(fraction);
  const date = (value: Date | string, options?: Intl.DateTimeFormatOptions) => c.date(typeof value === 'string' ? new Date(value) : value, options);
  const o = {
    ...c,
    scoreFormula: c.scoreFormula,
    newCheck: c.newCheck,
  };
  const [range, setRange] = useState('28');
  const [provider, setProvider] = useState('all');
  const [topic, setTopic] = useState('all');
  const [group, setGroup] = useState(sampleAnalytics.selectedGroup ?? '');
  const [runId, setRunId] = useState('');
  const [evFilter, setEvFilter] = useState('all');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const days = ['7', '28', '90'].includes(range) ? Number(range) : 28;
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const projectId = sampleProject.id;
  const checks = { project: sampleProject, latest: sampleQuickChecks.latest, latestMonitoring: sampleQuickChecks.latestMonitoring, label: `${sampleProject.name} · ${sampleProject.domain}`, isPending: false };
  const account = sampleAccount;
  const a = sampleAnalytics;
  const filteredA = {
    ...a,
    providers: provider === 'all' ? a.providers : a.providers.filter((p) => p.provider === provider),
    topics: topic === 'all' ? a.topics : a.topics.filter((t) => t === topic),
    runs: a.runs.filter((r) => !group || r.group === group).filter((r) => !runId || r.id === runId),
  };
  const m = a.metrics;
  const sample = metricSample(m, L);
  const kpis = [
    { id: 'visibility', label: o.visibility, def: c.visibilityDef, value: pctText(m.visibility, pct), ev: 'mentioned' },
    { id: 'recommendations', label: o.recommendations, def: c.recommendationsDef, value: pctText(m.recommendationRate, pct), ev: 'recommended' },
    { id: 'owned-citations', label: o.ownedCitations, def: c.ownedCitationsDef, value: pctText(m.citationRate, pct), ev: 'cited' },
    { id: 'share', label: o.share, def: c.shareDef, value: pctText(m.cohortShare, pct), ev: 'all', note: m.cohortShare === null ? L('Kilpailijaryhmää ei ole määritetty', 'Competitor cohort not configured') : null },
  ];
  const noData = a.totalRuns === 0;

  useEffect(() => {
    document.title = `${c.title} · AI Rank`;
  }, [c.title]);

  // Explicit local stubs: account/project context, API response and router state.
  void account;
  const groupLabel = (id: string) => {
    const idx = a.groups.findIndex((g) => g.id === id);
    const g = a.groups[idx];
    const diagnostic = a.runs.some((r) => r.group === id && r.kind === 'diagnostic');
    return `${L('Ryhmä', 'Group')} ${a.groups.length - idx}${g ? ` · ${g.runCount} ${L('ajoa', 'runs')}` : ''}${diagnostic ? ` · ${L('diagnostinen, ei mittareissa', 'diagnostic, excluded from metrics')}` : ''}`;
  };
  const showEvidence = (filter: string) => {
    setEvFilter(filter);
    setEvidenceOpen(true);
  };
  const newCheck = <Button data-testid="button-new-check" onClick={() => { /* Local preview: app navigation is intentionally stubbed. */ }}><Plus aria-hidden /> {o.newCheck}</Button>;

  return (
    <main className="airank-overview min-h-screen bg-background p-4 text-ink sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="rounded-md border border-line bg-white px-3 py-1.5 text-[11px] font-medium text-muted-ink">{c.introDisclosure}</p>
          <div className="inline-flex rounded-lg border border-line bg-white p-1" aria-label="Preview language">
            {(['fi', 'en'] as const).map((language) => <button key={language} type="button" onClick={() => setLocale(language)} aria-pressed={locale === language} className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${locale === language ? 'bg-tint text-navy' : 'text-muted-ink'}`}>{language}</button>)}
          </div>
        </div>
        <PageHeader title={c.title} subtitle={c.subtitle} actions={newCheck} />

        <div className="ar-rise ar-rise-1 flex flex-wrap items-center gap-2">
          <FilterSelect label={c.range} value={range} onChange={(value) => { setRange(value); setGroup(''); setRunId(''); }} testId="filter-range" className="min-w-[110px]" options={['7','28','90'].map((value) => ({ value, label: `${value} ${c.days}` }))} />
          <FilterSelect label={c.platform} value={provider} onChange={setProvider} testId="filter-platform" options={[{ value: 'all', label: c.platformAll }, ...a.availableProviders.map((value) => ({ value, label: value }))]} />
          <FilterSelect label={c.topic} value={topic} onChange={setTopic} testId="filter-topic" options={[{ value: 'all', label: c.topicAll }, ...a.topics.map((value) => ({ value, label: value }))]} />
          {a.groups.length > 0 && <FilterSelect label={c.group} value={group} onChange={(value) => { setGroup(value); setRunId(''); }} testId="filter-group" className="min-w-[200px]" options={a.groups.map((g) => ({ value: g.id, label: `${groupLabel(g.id)} (${g.runCount})` }))} />}
          {runId && <Button size="sm" variant="secondary" onClick={() => setRunId('')} data-testid="button-clear-run">{L('Poista ajorajaus','Clear run filter')}</Button>}
          <p className="w-full text-[12px] text-muted-ink sm:ml-auto sm:w-auto" data-testid="text-range">{from} – {to} UTC</p>
        </div>

        {a.groups.length > 1 && <ReasonNote>{L('Mittarit kattavat vain valitun koostumusryhmän. Eri kysymys- ja palvelukoostumuksia ei yhdistetä.', 'Metrics cover only the selected composition group. Different prompt and provider compositions are never combined.')} {group ? `(${groupLabel(group)})` : ''}</ReasonNote>}
        {a.quickChecks > 0 && <p className="text-[12px] text-muted-ink" data-testid="text-quickchecks">{c.quickChecks(a.quickChecks)} <button type="button" className="underline" onClick={() => { /* Local router stub */ }}>{c.openLatest}</button></p>}

        {noData ? <>
          <EmptyState title={c.noRuns} body={c.noRunsBody} />
        </> : <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => <div key={k.id} className="flex flex-col gap-1">
              <KpiCard testId={k.id} label={k.label} definition={k.def} value={k.value} sample={k.note ?? sample} />
              <button type="button" className="self-start px-1 text-[12px] font-medium text-ink underline-offset-2 hover:underline" data-testid={`button-drill-${k.id}`} onClick={() => showEvidence(k.ev)}>{c.viewEvidence}</button>
            </div>)}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,774fr)_minmax(0,350fr)]">
            <Panel className="flex min-w-0 flex-col gap-4 p-5" aria-labelledby="chart-title">
              <div><h2 id="chart-title" className="text-[18px] font-semibold leading-[26px] text-ink">{c.chartTitle}</h2><p className="text-[12px] leading-[17px] text-muted-ink">{L('Yksi viiva per koostumusryhmä ja yksi piste per ajo (myös saman päivän ajot). Päivät ilman ajoa jäävät tyhjiksi. Diagnostiset ajot eivät ole kaaviossa.', 'One line per composition group and one point per run (including same-day runs). Days without runs stay blank. Diagnostic runs are not charted.')}</p></div>
              <GroupTrend a={filteredA} from={from} days={days} locale={locale} />
            </Panel>
            <Panel className="flex flex-col gap-3 p-5" aria-labelledby="score-title">
              <h2 id="score-title" className="text-[18px] font-semibold leading-[26px] text-ink">{c.scoreTitle}</h2>
              <div className="flex items-end gap-2"><span className="tabular text-[56px] font-semibold leading-none text-ink" data-testid="value-score">{m.score === null ? '–' : num(m.score, { maximumFractionDigits: 1 })}</span><span className="pb-1 text-[18px] font-medium text-muted-ink">{c.outOf}</span></div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-canvas ring-1 ring-line" aria-hidden>{m.score !== null && <div className="h-full rounded-full bg-[#181f6b]" style={{ width: `${m.score * 10}%` }} />}</div>
              <p className="text-[12px] leading-[17px] text-muted-ink">{m.score === null ? c.scoreEmpty : sample}</p>
              {m.meanPosition !== null && <p className="text-[12px] text-muted-ink">{L('Keskimääräinen sijainti','Mean position')}: {num(m.meanPosition, { maximumFractionDigits: 1 })}</p>}
              <p className="mt-auto border-t border-line pt-3 text-[12px] leading-[17px] text-muted-ink">{c.scoreFormula}</p>
            </Panel>
          </div>

          <Panel className="flex flex-col gap-3 p-5" aria-labelledby="plat-title">
            <h2 id="plat-title" className="text-[18px] font-semibold leading-[26px] text-ink">{c.platformsTitle}</h2>
            {filteredA.providers.length === 0 ? <p className="text-sm text-muted-ink">{c.notMeasured}</p> : <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="table-providers">
              <caption className="sr-only">{c.platformsTitle}</caption>
              <thead><tr className="text-left text-[12px] text-muted-ink"><th className="py-2">{L('Palvelu','Provider')}</th><th className="text-right">{c.visibility}</th><th className="text-right">{c.recommendations}</th><th className="text-right">{c.ownedCitations}</th><th className="text-right">{c.score}</th><th className="text-right">{c.answers}</th></tr></thead>
              <tbody className="divide-y divide-line">{filteredA.providers.map((p)=><tr key={p.provider} data-testid={`row-provider-${p.provider}`}>
                <td className="py-2 font-medium">{p.provider} {p.metrics.state!=='complete'&&<StatusBadge tone="warning">{metricStateLabel(p.metrics.state,L).split(';')[0]}</StatusBadge>}</td>
                <td className="tabular text-right">{pctText(p.metrics.visibility,pct)??'–'}</td><td className="tabular text-right">{pctText(p.metrics.recommendationRate,pct)??'–'}</td>
                <td className="tabular text-right">{pctText(p.metrics.citationRate,pct)??'–'}</td><td className="tabular text-right">{p.metrics.score===null?'–':num(p.metrics.score,{maximumFractionDigits:1})}</td>
                <td className="tabular text-right">{p.metrics.eligible}/{p.metrics.expected}</td>
              </tr>)}</tbody>
            </table></div>}
            <p className="text-[12px] leading-[17px] text-muted-ink">{c.platformsNote}</p>
          </Panel>

          <Panel className="min-w-0 overflow-hidden pb-2" aria-labelledby="evidence-title">
            <h2 id="evidence-title" className="px-5 pt-5 text-[18px] font-semibold leading-[26px] text-ink">{c.evidence}</h2>
            <p className="px-5 pb-2 text-[12px] text-muted-ink">{c.everyEvidence}</p>
            <EvidenceList rows={a.evidence} filter={evFilter} onFilter={setEvFilter} L={L} date={date} />
          </Panel>
          <Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" data-testid="drawer-kpi-evidence">
              <SheetHeader className="mb-5"><SheetTitle>{c.metricEvidence}</SheetTitle><SheetDescription>{c.evidenceDescription}</SheetDescription></SheetHeader>
              <EvidenceList rows={a.evidence} filter={evFilter} onFilter={setEvFilter} L={L} date={date} />
            </SheetContent>
          </Sheet>
        </>}
      </div>
    </main>
  );
}

export default Current;
