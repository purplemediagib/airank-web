import './_group.css';
import { useRef, useState } from 'react';
import { ArrowUpRight, Globe2, Languages, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  EvidenceList, EmptyState, GroupTrend, KpiCard, metricSample, metricStateLabel,
  FilterSelect, PageHeader, Panel, pctText, ReasonNote, sampleAccount, sampleAnalytics,
  sampleProject, sampleQuickChecks, sampleResearch, StatusBadge, useMockLocale,
} from './_shared';

/**
 * Figma-aligned extraction of the current production overview markup.
 * All context, navigation and API results are local illustrative fixtures;
 * nothing in this preview calls or imports the production app or API.
 */
export function FigmaAligned() {
  const { locale, setLocale, c } = useMockLocale();
  const L = (fi: string, en: string) => locale === 'fi' ? fi : en;
  const num = (value: number, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', options).format(value);
  const pct = (fraction: number, digits = 1) =>
    new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', {
      style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(fraction);
  const date = (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', options ?? { day: 'numeric', month: 'short' })
      .format(typeof value === 'string' ? new Date(value) : value);
  const localizedCodeName = (value: string, type: 'region' | 'language') => {
    const code = value.trim();
    const pattern = type === 'region' ? /^[a-z]{2}$/i : /^[a-z]{2,3}$/i;
    if (!pattern.test(code)) return value;
    try {
      const names = new Intl.DisplayNames([locale === 'fi' ? 'fi-FI' : 'en-GB'], { type });
      const name = names.of(type === 'region' ? code.toUpperCase() : code.toLowerCase());
      if (!name || name.toLowerCase() === code.toLowerCase() || /unknown/i.test(name)) return value;
      return `${name} (${code})`;
    } catch {
      return value;
    }
  };

  // Local account/project/API/router stubs; fixtures are explicitly illustrative.
  const account = sampleAccount;
  const project = sampleProject;
  const checks = { project, latest: sampleQuickChecks.latest, latestMonitoring: sampleQuickChecks.latestMonitoring };
  const a = sampleAnalytics;
  const research = sampleResearch;
  void account;
  void checks;

  const [range, setRange] = useState('28');
  const [provider, setProvider] = useState('all');
  const [topic, setTopic] = useState('all');
  const [group, setGroup] = useState(a.selectedGroup ?? '');
  const [runId, setRunId] = useState('');
  const [evFilter, setEvFilter] = useState('all');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const days = ['7', '28', '90'].includes(range) ? Number(range) : 28;
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const filteredAnalytics = {
    ...a,
    providers: provider === 'all' ? a.providers : a.providers.filter((item) => item.provider === provider),
    topics: topic === 'all' ? a.topics : a.topics.filter((item) => item === topic),
    runs: a.runs.filter((run) => !group || run.group === group).filter((run) => !runId || run.id === runId),
  };
  const o = c;
  const m = a.metrics;
  const sample = metricSample(m, L);
  const lastUpdatedRun = a.runs
    .filter((run) => run.kind !== 'diagnostic' && (run.status === 'completed' || run.status === 'partial'))
    .sort((left, right) => right.createdAt - left.createdAt)[0];
  const groupLabel = (id: string) => {
    const index = a.groups.findIndex((item) => item.id === id);
    const item = a.groups[index];
    const diagnostic = a.runs.some((run) => run.group === id && run.kind === 'diagnostic');
    const base = `${L('Ryhmä', 'Group')} ${index >= 0 ? a.groups.length - index : ''}`;
    return `${base}${item ? ` · ${item.runCount} ${L(item.runCount === 1 ? 'ajo' : 'ajoa', item.runCount === 1 ? 'run' : 'runs')}` : ''}${diagnostic ? ` · ${L('diagnostinen, ei mittareissa', 'diagnostic, excluded from metrics')}` : ''}`;
  };
  const kpis = [
    { id: 'visibility', label: o.visibility, def: o.visibilityDef, value: pctText(m.visibility, pct), ev: 'mentioned' },
    { id: 'recommendations', label: o.recommendations, def: o.recommendationsDef, value: pctText(m.recommendationRate, pct), ev: 'recommended' },
    { id: 'owned-citations', label: o.ownedCitations, def: o.ownedCitationsDef, value: pctText(m.citationRate, pct), ev: 'cited' },
    { id: 'share', label: o.share, def: o.shareDef, value: pctText(m.cohortShare, pct), ev: 'all', note: m.cohortShare === null ? L('Vertailujoukon osuutta ei voida laskea.', 'Cohort share is not available.') : null },
  ];
  const showEvidence = (filter: string, trigger: HTMLButtonElement) => {
    evidenceTrigger.current = trigger;
    setEvFilter(filter);
    setEvidenceOpen(true);
  };
  const newCheck = <Button data-testid="button-new-check" onClick={() => { /* Local router navigation is intentionally stubbed. */ }}><Plus aria-hidden /> {o.newCheck}</Button>;

  return (
    <main className="airank-overview min-h-screen bg-background p-4 text-ink sm:p-6 lg:p-8" data-testid="page-overview">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="rounded-md border border-line bg-white px-3 py-1.5 text-[11px] font-medium text-muted-ink" data-testid="text-illustrative-disclosure">{c.introDisclosure}</p>
          <div className="inline-flex rounded-lg border border-line bg-white p-1" aria-label="Preview language">
            {(['fi', 'en'] as const).map((language) => (
              <button key={language} type="button" onClick={() => setLocale(language)} aria-pressed={locale === language} className={`rounded-md px-3 py-1 text-xs font-semibold uppercase ${locale === language ? 'bg-tint text-navy' : 'text-muted-ink'}`}>{language}</button>
            ))}
          </div>
        </div>
        <PageHeader title={o.title} subtitle={o.subtitle} actions={newCheck} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-[#f2f8f8] px-3.5 py-2.5 text-xs text-ink" data-testid="context-measurement">
          <span className="font-semibold text-muted-ink">{L('Mittausten konteksti', 'Measurement context')}</span>
          <span className="inline-flex items-center gap-1.5"><Globe2 className="size-3.5 text-link" aria-hidden /><span className="text-muted-ink">{L('Markkina', 'Market')}</span><b>{localizedCodeName(a.market, 'region') || '—'}</b></span>
          <span className="inline-flex items-center gap-1.5"><Languages className="size-3.5 text-link" aria-hidden /><span className="text-muted-ink">{L('Mittauskieli', 'Measurement language')}</span><b>{localizedCodeName(a.language, 'language') || '—'}</b></span>
          <button type="button" className="ml-auto inline-flex items-center gap-1 font-semibold text-link underline-offset-2 hover:underline" data-testid="link-measurement-settings" onClick={() => { /* Local router navigation is intentionally stubbed. */ }}>{L('Projektin asetukset', 'Project settings')} <ArrowUpRight className="size-3.5" aria-hidden /></button>
        </div>

        <div className="ar-rise ar-rise-1 flex flex-wrap items-center gap-2" data-testid="filters-overview">
          <FilterSelect label={o.range} value={range} onChange={(value) => { setRange(value); setGroup(''); setRunId(''); }} testId="filter-range" className="min-w-[110px]" options={['7', '28', '90'].map((value) => ({ value, label: `${value} ${o.days}` }))} />
          <FilterSelect label={o.platform} value={provider} onChange={setProvider} testId="filter-platform" options={[{ value: 'all', label: o.platformAll }, ...a.availableProviders.map((value) => ({ value, label: value }))]} />
          <FilterSelect label={o.topic} value={topic} onChange={setTopic} testId="filter-topic" options={[{ value: 'all', label: o.topicAll }, ...a.topics.map((value) => ({ value, label: value }))]} />
          {a.groups.length > 0 && <FilterSelect label={L('Ryhmä', 'Group')} value={group} onChange={(value) => { setGroup(value); setRunId(''); }} testId="filter-group" className="min-w-[200px]" options={a.groups.map((item) => ({ value: item.id, label: `${groupLabel(item.id)} (${item.runCount})` }))} />}
          {runId && <Button size="sm" variant="secondary" onClick={() => setRunId('')} data-testid="button-clear-run">{L('Poista ajorajaus', 'Clear run filter')}</Button>}
          <p className="w-full text-[12px] text-muted-ink sm:ml-auto sm:w-auto" data-testid="text-range">{from} – {to} UTC</p>
        </div>
        {lastUpdatedRun && <p className="text-right text-[11px] text-muted-ink" data-testid="text-last-updated">{L('Päivitetty', 'Updated')} {date(new Date(lastUpdatedRun.createdAt), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
        {a.groups.length > 1 && <ReasonNote>{L('Mittarit kattavat vain valitun koostumusryhmän. Eri kysymys- ja palvelukoostumuksia ei yhdistetä.', 'Metrics cover only the selected composition group. Different prompt and provider compositions are never combined.')} {a.selectedGroup ? `(${groupLabel(a.selectedGroup)})` : ''}</ReasonNote>}
        {a.quickChecks > 0 && <p className="text-xs leading-5 text-muted-ink" data-testid="text-quickchecks">{L(`${a.quickChecks} pikatarkistusta lasketaan erikseen, ei näissä mittareissa.`, `${a.quickChecks} quick checks are counted separately and are not part of these metrics.`)} <button type="button" className="font-medium text-link underline-offset-2 hover:underline" data-testid="link-quickcheck-latest" onClick={() => { /* Local router navigation is intentionally stubbed. */ }}>{L('Avaa viimeisin', 'Open latest')}</button></p>}

        {a.totalRuns === 0 ? (
          <EmptyState title={L('Valitulla aikavälillä ei ole seuranta-ajoja', 'No monitoring runs in the selected range')} body={L('Mittarit näkyvät, kun seuranta-ajo on tuottanut kelvollisia vastauksia. Pikatarkistukset ovat erillisiä eivätkä sisälly näihin mittareihin.', 'Metrics appear once a monitoring run has produced valid answers. Quick checks are separate and are not included here.')} />
        ) : (
          <>
            <section className="order-2 grid grid-cols-2 gap-3 md:order-1 md:grid-cols-2 md:gap-4 xl:grid-cols-4" aria-label={L('Yhteenvetomittarit', 'Summary metrics')} data-testid="section-kpis">
              {kpis.map((item) => (
                <div key={item.id} className={`flex min-w-0 flex-col gap-1 ${item.id === 'visibility' ? 'col-span-2 md:col-span-1' : ''}`}>
                  <KpiCard testId={item.id} label={item.label} definition={item.def} value={item.value} sample={item.note ?? sample} />
                  <button type="button" className="self-start px-1 text-xs font-medium text-ink underline-offset-2 hover:underline" data-testid={`button-drill-${item.id}`} onClick={(event) => showEvidence(item.ev, event.currentTarget)}>{L('Näytä todisteet', 'View evidence')}</button>
                </div>
              ))}
            </section>

            <section className="contents xl:order-2 xl:grid xl:grid-cols-[minmax(0,774fr)_minmax(0,350fr)]" aria-label={L('Näkyvyyden trendi ja pisteet', 'Visibility trend and score')}>
              <Panel className="order-3 flex min-w-0 flex-col gap-4 p-5 xl:order-1" aria-labelledby="chart-title">
                <div>
                  <h2 id="chart-title" className="text-base font-semibold text-ink md:text-lg">{o.chartTitle}</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-ink">{L('Yksi piste per ajo; saman päivän ajot säilyvät erillisinä. Päivät ilman ajoa jäävät tyhjiksi. Diagnostiset ajot eivät ole kaaviossa.', 'One point per run; runs on the same day stay separate. Days without runs remain blank. Diagnostic runs are not charted.')}</p>
                </div>
                <GroupTrend a={filteredAnalytics} from={from} days={days} locale={locale} />
              </Panel>
              <div className="order-1 xl:order-2">
                <VisibilityScore score={m.score} visibility={m.visibility} sample={sample} meanPosition={m.meanPosition} locale={locale} num={num} pct={pct} />
              </div>
            </section>

            <section className="order-3 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label={L('Vertailujoukko ja palvelut', 'Tracked cohort and providers')}>
              <TrackedCohort research={research} locale={locale} />
              <Panel className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="plat-title">
                <div>
                  <h2 id="plat-title" className="text-base font-semibold text-ink">{o.platformsTitle}</h2>
                  <p className="mt-1 text-xs text-muted-ink">{L('Tulokset perustuvat vain alla näkyviin vastauksiin ja tämän suodatuksen rajaukseen.', 'Results reflect only the responses shown below and the active filters.')}</p>
                </div>
                {filteredAnalytics.providers.length === 0 ? <EmptyState title={o.notMeasured} body={L('Valitulla suodatuksella ei ole palvelukohtaisia tuloksia.', 'There are no provider results for the selected filters.')} /> :
                  <>
                    <ul className="flex flex-col gap-2 md:hidden" data-testid="list-providers-mobile">
                      {filteredAnalytics.providers.map((item) => (
                        <li key={item.provider} className="rounded-lg border border-line bg-[#fbfcfd] p-3" data-testid={`card-provider-${item.provider}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-ink">{item.provider}</p>
                            {item.metrics.state !== 'complete' && <StatusBadge tone="warning">{metricStateLabel(item.metrics.state, L).split(';')[0]}</StatusBadge>}
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div><p className="text-muted-ink">{o.visibility}</p><p className="tabular mt-0.5 font-semibold text-ink">{pctText(item.metrics.visibility, pct) ?? '–'}</p></div>
                            <div><p className="text-muted-ink">{o.recommendations}</p><p className="tabular mt-0.5 font-semibold text-ink">{pctText(item.metrics.recommendationRate, pct) ?? '–'}</p></div>
                            <div><p className="text-muted-ink">{o.ownedCitations}</p><p className="tabular mt-0.5 font-semibold text-ink">{pctText(item.metrics.citationRate, pct) ?? '–'}</p></div>
                            <div><p className="text-muted-ink">{L('Kelvolliset vastaukset', 'Eligible answers')}</p><p className="tabular mt-0.5 font-semibold text-ink">{item.metrics.eligible}/{item.metrics.expected}</p></div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[570px] text-sm" data-testid="table-providers">
                        <caption className="sr-only">{o.platformsTitle}</caption>
                        <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted-ink">
                          <th scope="col" className="py-2 pr-3">{L('Palvelu', 'Provider')}</th><th scope="col" className="px-2 text-right">{o.visibility}</th><th scope="col" className="px-2 text-right">{o.recommendations}</th><th scope="col" className="px-2 text-right">{o.ownedCitations}</th><th scope="col" className="px-2 text-right">{L('Pisteet', 'Score')}</th><th scope="col" className="pl-2 text-right">{L('Kelvolliset / odotetut', 'Valid / expected')}</th>
                        </tr></thead>
                        <tbody className="divide-y divide-line">{filteredAnalytics.providers.map((item) => (
                          <tr key={item.provider} data-testid={`row-provider-${item.provider}`}>
                            <th scope="row" className="py-3 pr-3 text-left font-semibold text-ink">{item.provider}{item.metrics.state !== 'complete' && <span className="ml-2"><StatusBadge tone="warning">{metricStateLabel(item.metrics.state, L).split(';')[0]}</StatusBadge></span>}</th>
                            <td className="tabular px-2 text-right">{pctText(item.metrics.visibility, pct) ?? '–'}</td>
                            <td className="tabular px-2 text-right">{pctText(item.metrics.recommendationRate, pct) ?? '–'}</td>
                            <td className="tabular px-2 text-right">{pctText(item.metrics.citationRate, pct) ?? '–'}</td>
                            <td className="tabular px-2 text-right">{item.metrics.score === null ? '–' : num(item.metrics.score, { maximumFractionDigits: 1 })}</td>
                            <td className="tabular pl-2 text-right">{item.metrics.eligible}/{item.metrics.expected}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </>}
                <p className="border-t border-line pt-3 text-[11px] leading-4 text-muted-ink">{o.platformsNote}</p>
              </Panel>
            </section>

            <Panel className="order-4 min-w-0 overflow-hidden pb-2" aria-labelledby="evidence-title">
              <div className="px-5 pt-5">
                <h2 id="evidence-title" className="text-base font-semibold text-ink">{L('Todisteet', 'Evidence')}</h2>
                <p className="mt-1 pb-3 text-xs leading-5 text-muted-ink">{L('Alkuperäiset vastaukset ovat mittareiden näyttö. Otos ei kuvaa kaikkia tekoälyhakuja.', 'Original answers are the evidence behind these metrics. This sample does not represent every AI search.')}</p>
              </div>
              {!evidenceOpen && <EvidenceList rows={a.evidence} filter={evFilter} onFilter={setEvFilter} L={L} date={date} />}
            </Panel>
            <p className="order-5 text-[11px] leading-4 text-muted-ink" data-testid="text-methodology-note">{L('Esimerkkidata on havainnollistava, ei asiakkaan tulos. Tulokset kuvaavat API-pohjaista otosta, eivät kaikkia tekoälyhakuja. Puuttuvia vastauksia ei lasketa nolliksi.', 'Illustrative sample data, not customer results. Results describe an API-based sample, not all AI searches. Missing answers are not counted as zero.')}</p>
            <Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}>
              <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" data-testid="drawer-kpi-evidence" onCloseAutoFocus={(event) => { event.preventDefault(); evidenceTrigger.current?.focus(); }}>
                <SheetHeader className="mb-5">
                  <SheetTitle>{L('Mittarin todisteet', 'Metric evidence')}</SheetTitle>
                  <SheetDescription>{L('Valitun mittarin vastaukset. Avaa vastaus nähdäksesi alkuperäisen tekstin ja luokituksen.', 'Answers behind the selected metric. Open an answer to inspect the original text and classification.')}</SheetDescription>
                </SheetHeader>
                <EvidenceList rows={a.evidence} filter={evFilter} onFilter={setEvFilter} L={L} date={date} />
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
    </main>
  );
}

function VisibilityScore({ score, visibility, sample, meanPosition, locale, num, pct }: {
  score: number | null; visibility: number | null; sample: string; meanPosition: number | null;
  locale: 'fi' | 'en'; num: (value: number, options?: Intl.NumberFormatOptions) => string;
  pct: (fraction: number, digits?: number) => string;
}) {
  const L = (fi: string, en: string) => locale === 'fi' ? fi : en;
  const radius = 66;
  const circumference = Math.PI * radius;
  const progress = score === null ? 0 : Math.max(0, Math.min(10, score)) / 10;
  return (
    <Panel className="flex flex-col gap-3 p-5 md:p-6" aria-labelledby="score-title" data-testid="panel-visibility-score">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="score-title" className="text-base font-semibold text-ink">{L('Näkyvyyspisteet', 'Visibility score')}</h2>
          <p className="mt-1 text-xs text-muted-ink">{L('Johdettu näkyvyysmittarista', 'Derived from visibility')}</p>
        </div>
        <StatusBadge tone={score === null ? 'neutral' : 'info'}>{score === null ? L('Ei saatavilla', 'Unavailable') : '0–10'}</StatusBadge>
      </div>
      <div className="relative mx-auto mt-1 h-[118px] w-full max-w-[245px]" role="img" aria-label={score === null ? L('Ei saatavilla', 'Unavailable') : `${L('Näkyvyyspisteet', 'Visibility score')}: ${num(score, { maximumFractionDigits: 1 })} / 10`}>
        <svg viewBox="0 0 160 92" className="h-full w-full overflow-visible" aria-hidden="true">
          <path d="M 14 82 A 66 66 0 0 1 146 82" fill="none" stroke="#e4ebef" strokeWidth="10" strokeLinecap="round" />
          {score !== null && <path d="M 14 82 A 66 66 0 0 1 146 82" fill="none" stroke="#0da6bb" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${circumference * progress} ${circumference}`} />}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-center gap-1 text-ink">
          <span className="tabular text-4xl font-semibold tracking-tight" data-testid="value-score">{score === null ? '–' : num(score, { maximumFractionDigits: 1 })}</span>
          <span className="text-sm font-medium text-muted-ink">/ 10</span>
        </div>
      </div>
      <p className="text-center text-xs leading-5 text-muted-ink" data-testid="text-score-sample">{visibility === null ? L('Pisteitä ei lasketa ilman kelvollisia vastauksia.', 'No score without eligible responses.') : `${pct(visibility / 100, 1)} ${L('näkyvyys ·', 'visibility ·')} ${sample}`}</p>
      {meanPosition !== null && <p className="text-center text-xs text-muted-ink" data-testid="text-mean-position">{L('Keskimääräinen mainintasijainti', 'Mean mention position')}: {num(meanPosition, { maximumFractionDigits: 1 })}</p>}
      <div className="mt-auto border-t border-line pt-3 text-center text-[11px] leading-4 text-muted-ink">{L('Näkyvyys × 10, yksi desimaali.', 'Visibility × 10, one decimal.')}</div>
    </Panel>
  );
}

function TrackedCohort({ research, locale }: { research: typeof sampleResearch; locale: 'fi' | 'en' }) {
  const L = (fi: string, en: string) => locale === 'fi' ? fi : en;
  const brands = research.competitors.filter((brand) => brand.status === 'active');
  return (
    <Panel className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="cohort-title" data-testid="panel-tracked-cohort">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="cohort-title" className="text-base font-semibold text-ink">{L('Seurattu vertailujoukko', 'Tracked comparison cohort')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-ink">{L('Vahvistetut brändit, joita tutkimus seuraa tässä projektissa.', 'Confirmed brands tracked by research for this project.')}</p>
        </div>
        <button type="button" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-link hover:underline" data-testid="link-cohort-management" onClick={() => { /* Local router navigation is intentionally stubbed. */ }}>{L('Hallitse', 'Manage')} <ArrowUpRight className="size-3.5" aria-hidden /></button>
      </div>
      {brands.length === 0 ? (
        <EmptyState title={L('Ei vahvistettuja vertailubrändejä', 'No confirmed comparison brands')} body={L('Vertailubrändien nimet näkyvät tässä, kun ne on lisätty projektiin. Emme näytä keksittyjä näkyvyyslukuja.', 'Tracked brand names will appear here once added to the project. No visibility figures are inferred.')} />
      ) : (
        <>
          <ul className="divide-y divide-line" data-testid="list-tracked-brands">
            {brands.map((brand) => (
              <li key={brand.id} className="flex min-w-0 items-start justify-between gap-4 py-3 first:pt-1 last:pb-1" data-testid={`row-tracked-brand-${brand.id}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink" data-testid={`text-tracked-brand-${brand.id}`}>{brand.name}</p>
                  <p className="mt-0.5 break-all text-xs text-muted-ink">{brand.domains.length ? brand.domains.join(' · ') : L('Verkkotunnusta ei määritetty', 'No domain specified')}</p>
                </div>
                <span className="shrink-0 rounded-md bg-canvas px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-ink">{L('Seurattu', 'Tracked')}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-3 text-[11px] leading-4 text-muted-ink" data-testid="text-cohort-metric-limit">{L('Brändikohtaisia näkyvyys- tai muutosmittareita ei ole saatavilla tässä analytiikassa.', 'Per-brand visibility and change metrics are not available in this analytics response.')}</p>
        </>
      )}
    </Panel>
  );
}

export default FigmaAligned;
