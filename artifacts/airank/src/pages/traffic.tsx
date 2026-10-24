import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'wouter';
import { useGetGoogleConnection, useGetGoogleReports, getGetGoogleConnectionQueryKey, getGetGoogleReportsQueryKey, type GetGoogleReportsView } from '@workspace/api-client-react';
import { useDocumentTitle, useI18n } from '@/i18n';
import { useProjects } from '@/lib/project-context';
import { connectionsCopy, googleImportError, type ConnectionsCopy } from '@/lib/connections-copy';
import { PageHeader, Panel, StatusBadge, LoadingBlock, ErrorState, EmptyState, type Tone } from '@/components/airank/primitives';
import { SelectField } from '@/components/airank/forms';
import { Button } from '@/components/ui/button';
import { cell, coverage, defaultRange, rangeOk, reportFlags, type GoogleService } from '@/lib/traffic-report';
import { cn } from '@/lib/utils';

const copy = {
  en: {
    title: 'Traffic', subtitle: 'Cached Google data for this project. Opening this page never contacts Google, starts imports or changes connections.',
    tabGa4: 'AI referrals (GA4)', tabGsc: 'Search performance (GSC)', tabs: 'Traffic sources',
    manage: 'Manage connections in Settings', notConnected: 'Not connected', notConnectedBody: 'Connect this service and choose a property in Settings. Nothing is shown until data is imported.',
    noProperty: 'No property selected', noPropertyBody: 'Choose a property in Settings to start an import.',
    setup: 'Google connections are not configured on this server yet.', reconnect: 'Google access needs reconnecting. Cached data below stays available.',
    freshness: 'Freshness', lastImport: 'Last import', never: 'No completed import', importState: 'Import state',
    provenance: 'Classification', provGa4: 'Sessions are counted as AI referrals only when the source matches the AI Rank referral classifier', provGsc: 'Google Search totals as reported by Search Console; no AI classification is applied.',
    limits: 'Limitations', limGa4: 'Only identified AI referrers. Untagged or copied-link visits are not included, and nothing here attributes visits to specific prompts.',
    limGsc: 'Search Console does not separate AI Overviews or AI Mode. These figures cannot be read as AI Overview traffic.',
    missingTitle: 'No imported data for this range', missingBody: 'This is missing data, not zero traffic. Check or manage the import in Settings, or pick dates that have been imported.',
    zeroTitle: 'No matching reported rows', zeroBody: 'All requested days were imported, but Google reported no matching rows. This does not prove zero traffic; privacy thresholds may withhold rows.',
    partialZero: 'No matching rows were reported for imported days; other days are missing. This does not prove zero traffic; privacy thresholds may withhold rows.',
    emptyPage: 'No rows on this page. Use Previous to return to earlier results.',
    refreshFailed: 'Refreshing failed. Showing the last cached result.', range: 'Range',
    d7: '7 days', d28: '28 days', d90: '90 days', custom: 'Custom',
  },
  fi: {
    title: 'Liikenne', subtitle: 'Projektin välimuistissa olevat Google-tiedot. Sivun avaaminen ei ota yhteyttä Googleen, käynnistä tuontia eikä muuta yhteyksiä.',
    tabGa4: 'Tekoälyviittaukset (GA4)', tabGsc: 'Hakusuorituskyky (GSC)', tabs: 'Liikenteen lähteet',
    manage: 'Hallitse yhteyksiä asetuksissa', notConnected: 'Ei yhdistetty', notConnectedBody: 'Yhdistä palvelu ja valitse ominaisuus asetuksissa. Mitään ei näytetä ennen tietojen tuontia.',
    noProperty: 'Ominaisuutta ei valittu', noPropertyBody: 'Valitse ominaisuus asetuksissa aloittaaksesi tuonnin.',
    setup: 'Google-yhteyksiä ei ole vielä määritetty tällä palvelimella.', reconnect: 'Google-yhteys on yhdistettävä uudelleen. Alla olevat tallennetut tiedot ovat yhä käytettävissä.',
    freshness: 'Ajantasaisuus', lastImport: 'Viimeisin tuonti', never: 'Ei valmistunutta tuontia', importState: 'Tuonnin tila',
    provenance: 'Luokittelu', provGa4: 'Istunnot lasketaan tekoälyviittauksiksi vain, kun lähde vastaa AI Rankin viittausluokittelijaa', provGsc: 'Google-haun luvut sellaisenaan Search Consolesta; tekoälyluokittelua ei tehdä.',
    limits: 'Rajoitukset', limGa4: 'Vain tunnistetut tekoälyviittaajat. Merkitsemättömät tai kopioidun linkin käynnit puuttuvat, eikä käyntejä kohdisteta yksittäisiin kehotteisiin.',
    limGsc: 'Search Console ei erottele tekoälytiivistelmiä (AI Overviews) tai AI Modea. Lukuja ei voi tulkita tekoälytiivistelmien liikenteeksi.',
    missingTitle: 'Jaksolle ei ole tuotuja tietoja', missingBody: 'Kyse on puuttuvista tiedoista, ei nollaliikenteestä. Tarkista tuonti tai hallitse sitä asetuksissa, tai valitse jo tuodut päivät.',
    zeroTitle: 'Ei vastaavia raportoituja rivejä', zeroBody: 'Kaikki pyydetyt päivät tuotiin, mutta Google ei raportoinut vastaavia rivejä. Tämä ei todista nollaliikennettä; tietosuojan kynnysrajat voivat piilottaa rivejä.',
    partialZero: 'Tuoduilta päiviltä ei raportoitu vastaavia rivejä; muita päiviä puuttuu. Tämä ei todista nollaliikennettä; tietosuojan kynnysrajat voivat piilottaa rivejä.',
    emptyPage: 'Tällä sivulla ei ole rivejä. Palaa aiempiin tuloksiin Edellinen-painikkeella.',
    refreshFailed: 'Päivitys epäonnistui. Näytetään viimeisin tallennettu tulos.', range: 'Jakso',
    d7: '7 päivää', d28: '28 päivää', d90: '90 päivää', custom: 'Oma',
  },
};
type Copy = typeof copy.en;

function Report({ projectId, service, c, k }: { projectId: string; service: GoogleService; c: ConnectionsCopy; k: Copy }) {
  const { t, date, locale } = useI18n();
  const views: GetGoogleReportsView[] = service === 'ga4' ? ['sources', 'pages', 'countries', 'devices'] : ['totals', 'queries', 'pages', 'countries', 'devices'];
  const [view, setView] = useState<GetGoogleReportsView>(views[0]);
  const [range, setRange] = useState(() => defaultRange());
  const [preset, setPreset] = useState<'7' | '28' | '90' | 'custom'>('28');
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const status = useGetGoogleConnection(projectId, service, {
    query: {
      queryKey: getGetGoogleConnectionQueryKey(projectId, service), staleTime: 30_000, refetchOnWindowFocus: false, retry: 1,
      refetchInterval: (q) => {
        const sync = q.state.data?.sync?.status;
        return sync && ['queued', 'running', 'retrying'].includes(sync) ? 5000 : false;
      },
    },
  });
  const s = status.data;
  const ready = !!s && s.configured && !!s.property && (s.status === 'connected' || s.status === 'reconnect_required');
  const valid = rangeOk(range.from, range.to);
  const params = { startDate: range.from, endDate: range.to, view, offset, limit, ...(service === 'ga4' ? { aiOnly: true } : {}) };
  const q = useGetGoogleReports(projectId, service, params, {
    query: { queryKey: getGetGoogleReportsQueryKey(projectId, service, params), enabled: ready && valid, staleTime: 60_000, refetchOnWindowFocus: false },
  });
  // No placeholder data across date, view, project or property changes.
  const data = ready && q.data && (!q.data.property || q.data.property === s?.property) ? q.data : undefined;
  const rows = (data?.rows ?? []) as Record<string, unknown>[];
  const cols = useMemo(() => { const set = new Set<string>(); rows.forEach((r) => Object.keys(r).forEach((x) => set.add(x))); return [...set]; }, [rows]);
  const flags = useMemo(() => reportFlags(data?.metadata ?? []), [data]);
  const cov = data ? coverage(data) : null;
  const head = (x: string) => (c[`c_${x}` as keyof ConnectionsCopy] as string | undefined) ?? x;
  const sy = s?.sync;
  const dateInput = 'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan sm:h-10 sm:w-auto';
  const warn = 'rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] font-medium text-warning';
  const statusWarning = status.isError && s && <p role="alert" className={warn}>{k.refreshFailed} <button type="button" className="underline" onClick={() => void status.refetch()} data-testid={`button-retry-status-${service}`}>{c.retry}</button></p>;
  const choosePreset = (value: '7' | '28' | '90') => {
    const next = defaultRange();
    next.from = new Date(Date.parse(next.to) - (Number(value) - 1) * 86400000).toISOString().slice(0, 10);
    setPreset(value); setRange(next); setOffset(0);
  };

  if (status.isPending) return <LoadingBlock rows={4} />;
  if (!s) return <ErrorState body={c.loadFailed} onRetry={() => void status.refetch()} retrying={status.isFetching} />;
  if (!s.configured) return <>{statusWarning}<EmptyState title={c.setupNeeded} body={k.setup} /></>;
  if (!s.property) return <>{statusWarning}<EmptyState title={s.connected ? k.noProperty : k.notConnected} body={s.connected ? k.noPropertyBody : k.notConnectedBody} /></>;
  if (!ready) return <>{statusWarning}<EmptyState title={k.notConnected} body={k.notConnectedBody} /></>;

  const tone: Tone = sy?.status === 'failed' ? 'error' : sy && ['queued', 'running', 'retrying'].includes(sy.status) ? 'info' : sy?.completedAt ? 'success' : 'neutral';
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {statusWarning}
      {s.status === 'reconnect_required' && <p role="status" className={warn}>{k.reconnect}</p>}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-[12px] border border-line bg-canvas p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4" data-testid={`traffic-context-${service}`}>
        <div className="min-w-0"><dt className="text-[11px] text-muted-ink">{c.property}</dt><dd className="break-all font-medium text-ink">{s.property}</dd></div>
        <div><dt className="text-[11px] text-muted-ink">{k.range}</dt><dd className="font-medium text-ink">{range.from} – {range.to}</dd></div>
        <div><dt className="text-[11px] text-muted-ink">{k.lastImport}</dt><dd className="font-medium text-ink">{sy?.completedAt ? date(sy.completedAt, { dateStyle: 'medium', timeStyle: 'short' }) : k.never}</dd></div>
        <div><dt className="text-[11px] text-muted-ink">{k.importState}</dt><dd>{sy ? <StatusBadge tone={tone} dot={false}>{(c[`s_${sy.status}` as keyof ConnectionsCopy] as string | undefined) ?? sy.status} · {t(c.progress, { done: sy.completedDays, total: sy.totalDays })}</StatusBadge> : <span className="font-medium text-ink">-</span>}</dd></div>
      </dl>
      {sy?.lastError && <p role="alert" className="text-[12px] font-medium text-danger">{googleImportError(sy.lastError, locale)}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[12px] border border-line bg-white p-3 text-[12px] text-ink"><p className="font-semibold">{k.provenance}</p><p className="text-muted-ink">{service === 'ga4' ? `${k.provGa4}${data?.classificationVersion ? ` (${data.classificationVersion})` : ''}.` : k.provGsc}</p></div>
        <div className="rounded-[12px] border border-line bg-white p-3 text-[12px] text-ink"><p className="font-semibold">{k.limits}</p><p className="text-muted-ink">{service === 'ga4' ? k.limGa4 : k.limGsc}</p></div>
      </div>
      <div role="group" aria-label={k.range} className="flex flex-wrap gap-1">
        {(['7', '28', '90'] as const).map((value) => <Button key={value} variant="secondary" size="sm" aria-pressed={preset === value} onClick={() => choosePreset(value)} data-testid={`button-range-${value}`}>{k[`d${value}`]}</Button>)}
        <Button variant="secondary" size="sm" aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')} data-testid="button-range-custom">{k.custom}</Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-[12px] text-muted-ink">{c.from}<input type="date" className={dateInput} value={range.from} onChange={(e) => { setPreset('custom'); setRange({ ...range, from: e.target.value }); setOffset(0); }} data-testid={`traffic-from-${service}`} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-muted-ink">{c.to}<input type="date" className={dateInput} value={range.to} onChange={(e) => { setPreset('custom'); setRange({ ...range, to: e.target.value }); setOffset(0); }} data-testid={`traffic-to-${service}`} /></label>
        <div className="sm:min-w-[180px]"><SelectField label={c.view} value={view} testId={`traffic-view-${service}`} options={views.map((v) => ({ value: v, label: c[`v_${v}` as keyof ConnectionsCopy] as string }))} onChange={(v) => { setView(v as GetGoogleReportsView); setOffset(0); }} /></div>
      </div>
      <p className="text-[12px] text-muted-ink">{c.reportNote}</p>
      {!valid && <p role="alert" className="text-[13px] font-medium text-danger">{c.rangeBad}</p>}
      {valid && q.isPending && <LoadingBlock rows={4} />}
      {valid && q.isError && !data && <ErrorState body={c.reportFailed} onRetry={() => void q.refetch()} retrying={q.isFetching} />}
      {valid && q.isError && data && <p role="alert" className={warn}>{k.refreshFailed} <button type="button" className="underline" onClick={() => void q.refetch()} data-testid={`button-retry-report-${service}`}>{c.retry}</button></p>}
      {valid && data && (
        <div className={cn('flex min-w-0 flex-col gap-3 transition-opacity', q.isFetching && 'opacity-60')} aria-busy={q.isFetching}>
          {(cov === 'partial' || flags.truncated || flags.sampling || flags.threshold) && (
            <ul className="flex flex-col gap-2" data-testid={`traffic-flags-${service}`}>
              {cov === 'partial' && <li className={warn}>{c.flagPartial}</li>}
              {flags.truncated && <li className={warn}>{c.flagTruncated}</li>}
              {flags.sampling && <li className={warn}>{c.flagSampling}</li>}
              {flags.threshold && <li className={warn}>{c.flagThreshold}</li>}
            </ul>
          )}
          {cov === 'missing' ? <EmptyState title={k.missingTitle} body={k.missingBody} /> :
           cov === 'zero' ? <EmptyState title={k.zeroTitle} body={k.zeroBody} /> :
           cov === 'partial-zero' ? <EmptyState title={k.zeroTitle} body={k.partialZero} /> :
           rows.length === 0 ? <EmptyState title={k.emptyPage} /> : (
            <div tabIndex={0} role="region" aria-label={service === 'ga4' ? k.tabGa4 : k.tabGsc} className="max-w-full overflow-x-auto rounded-[12px] border border-line bg-white">
              <table className="w-full min-w-[480px] text-left text-[13px]" data-testid={`traffic-table-${service}`}>
                <thead className="bg-canvas text-[11px] text-muted-ink"><tr>{cols.map((x) => <th key={x} scope="col" className="px-3 py-2 font-medium">{head(x)}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{cols.map((x) => <td key={x} className={cn('max-w-[320px] break-words px-3 py-2 text-ink', typeof r[x] === 'number' && 'tabular-nums')}>{cell(r[x])}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {(rows.length > 0 || offset > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-[12px] text-muted-ink">{t(c.rows, { from: rows.length ? offset + 1 : 0, to: rows.length ? offset + rows.length : 0, total: data.totalRows })}</span>
              <Button variant="secondary" size="sm" disabled={offset === 0 || q.isFetching} onClick={() => setOffset(Math.max(0, offset - limit))} data-testid={`button-prev-${service}`}>{c.prev}</Button>
              <Button variant="secondary" size="sm" disabled={data.nextOffset == null || q.isFetching} onClick={() => setOffset(data.nextOffset ?? offset)} data-testid={`button-next-${service}`}>{c.next}</Button>
            </div>
          )}
          <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-canvas p-3 text-[12px] text-ink" data-testid={`traffic-meta-${service}`}>
            <p className="font-semibold">{c.meta}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              <div><dt className="text-muted-ink">{c.metaTz}</dt><dd>{data.timeZone ?? '-'}</dd></div>
              <div><dt className="text-muted-ink">{c.metaCur}</dt><dd>{data.currency ?? '-'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted-ink">{c.available}</dt><dd className="break-words">{data.availableDates.length ? `${data.availableDates[0]} – ${data.availableDates[data.availableDates.length - 1]} (${data.availableDates.length})` : c.none}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted-ink">{c.missing}</dt><dd className="break-words">{data.missingDates.length ? data.missingDates.join(', ') : c.none}</dd></div>
            </dl>
            {data.notes.length > 0 && <div><p className="text-muted-ink">{c.notes}</p><ul className="list-disc pl-4">{data.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrafficPage() {
  const { d, locale } = useI18n();
  const { project, projectHref } = useProjects();
  const k = copy[locale];
  const c = connectionsCopy[locale];
  useDocumentTitle(d.nav.traffic);
  const [tab, setTab] = useState<GoogleService>('ga4');
  const refs = useRef<Record<GoogleService, HTMLButtonElement | null>>({ ga4: null, gsc: null });
  const tabs: { id: GoogleService; label: string }[] = [{ id: 'ga4', label: k.tabGa4 }, { id: 'gsc', label: k.tabGsc }];
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((x) => x.id === tab);
    const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); setTab(tabs[next].id); refs.current[tabs[next].id]?.focus();
  };
  if (!project) return null;
  const settings = projectHref('/settings');
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-5" data-testid="page-traffic">
      <PageHeader title={k.title} subtitle={k.subtitle} actions={<Link href={`${settings}${settings.includes('?') ? '&' : '?'}tab=connections`} className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-link hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan" data-testid="link-traffic-settings">{k.manage}</Link>} />
      <Panel className="flex min-w-0 flex-col gap-4 p-4 md:p-6">
        <div role="tablist" aria-label={k.tabs} onKeyDown={onKey} className="flex w-full gap-1 overflow-x-auto rounded-lg border border-line bg-canvas p-1 sm:w-auto sm:self-start">
          {tabs.map((x) => (
            <button key={x.id} ref={(el) => { refs.current[x.id] = el; }} type="button" role="tab" id={`tab-traffic-${x.id}`} aria-controls={`panel-traffic-${x.id}`} aria-selected={tab === x.id} tabIndex={tab === x.id ? 0 : -1} onClick={() => setTab(x.id)}
              className={cn('h-10 flex-1 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan sm:flex-none', tab === x.id ? 'bg-navy text-white' : 'text-muted-ink hover:bg-white hover:text-ink')}
              data-testid={`tab-traffic-${x.id}`}>{x.label}</button>
          ))}
        </div>
        <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] font-medium text-ink">{tab === 'ga4' ? c.ga4Note : c.gscScope}</p>
        <div role="tabpanel" id={`panel-traffic-${tab}`} aria-labelledby={`tab-traffic-${tab}`} tabIndex={0} className="min-w-0 focus-visible:outline-none">
          <Report key={`${project.id}:${tab}`} projectId={project.id} service={tab} c={c} k={k} />
        </div>
      </Panel>
    </div>
  );
}
