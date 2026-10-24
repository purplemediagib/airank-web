import { useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, FileDown, FileSpreadsheet, FileText, Save } from 'lucide-react';
import type { ProjectAnalytics, ReportDetail } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTitle, useI18n } from '@/i18n';
import { readApiError, writeErrorMessage } from '@/lib/api-errors';
import { useProjects } from '@/lib/project-context';
import { toMs, useAnalytics, useAnalyticsFilters } from '@/lib/use-analytics';
import { fetchReportFresh, useCreateReportWrite, useReport, useReports } from '@/lib/use-reports';
import { buildCsv, buildPdf, downloadBlob, reportFileName } from '@/lib/report-export';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { FilterSelect } from '@/components/airank/data';
import { SubTabs } from '@/components/airank/forms';
import { AnalyticsFailure, GroupTrend, pctText, useL } from '@/components/airank/analytics';
import { AnalyticsFilterBar } from '@/components/airank/analytics-filters';

type L = ReturnType<typeof useL>;

function Summary({ a, L, runId }: { a: ProjectAnalytics; L: L; runId?: string }) {
  const { pct, num } = useI18n();
  const m = a.metrics;
  const items: [string, string][] = [
    [L('Näkyvyys', 'Visibility'), pctText(m.visibility, pct) ?? '–'],
    [L('Suositusosuus', 'Recommendation rate'), pctText(m.recommendationRate, pct) ?? '–'],
    [L('Omat lähdeviittaukset', 'Owned citations'), pctText(m.citationRate, pct) ?? '–'],
    [L('Kattavuus', 'Coverage'), `${num(m.eligible)} / ${num(m.expected)}`],
    [L('Valitun otoksen ajot', 'Selected sample runs'), num(a.runs.filter(r=>runId?r.id===runId:r.group===a.selectedGroup&&r.kind==='neutral').length)],
    [L('Vastaukset', 'Answers'), num(a.evidence.length)],
  ];
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="report-summary">{items.map(([k, v]) => <Panel key={k} className="p-4" as="div"><dt className="text-[12px] text-muted-ink">{k}</dt><dd className="tabular mt-1 text-[20px] font-semibold text-ink">{v}</dd></Panel>)}</dl>;
}

/** Download buttons always re-fetch the protected snapshot (expiry, session, ownership). */
export function useReportDownload(projectId: string) {
  const L = useL();
  const { d } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, kind: 'pdf' | 'csv') => {
    setBusy(`${id}:${kind}`);
    try {
      const r = await fetchReportFresh(projectId, id);
      if (kind === 'csv') downloadBlob(new Blob([buildCsv(r)], { type: 'text/csv;charset=utf-8' }), reportFileName(r, 'csv'));
      else downloadBlob(await buildPdf(r), reportFileName(r, 'pdf'));
    } catch (e) {
      const s = readApiError(e).status;
      toast({ variant: 'destructive', title: s === 410 ? L('Raportti on vanhentunut (30 päivää). Luo uusi raportti.', 'The report has expired (30 days). Create a new report.') : s === 401 ? L('Istunto on päättynyt. Kirjaudu uudelleen.', 'Your session has ended. Sign in again.') : s === null ? L('Tiedoston luonti epäonnistui.', 'The file could not be created.') : writeErrorMessage(e, d) });
    } finally { setBusy(null); }
  };
  return { busy, run };
}

type Section = 'overview' | 'cohort' | 'questions';
const SECTIONS: Section[] = ['overview', 'cohort', 'questions'];

function Preview({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const L = useL();
  const { d, locale, date } = useI18n();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { project, projectHref } = useProjects();
  const f = useAnalyticsFilters();
  const q = useAnalytics(projectId, f.params);
  const create = useCreateReportWrite(projectId);
  const [lang, setLang] = useState<'fi' | 'en'>(locale === 'en' ? 'en' : 'fi');
  const month = date(new Date(), { month: 'long', year: 'numeric' });
  const [title, setTitle] = useState<string | null>(null);
  const titleValue = title ?? `${project?.brandName ?? 'AI Rank'} · ${month}`;
  const [sections, setSections] = useState<Section[]>(SECTIONS);
  const secLabel = (x: Section) => x === 'overview' ? L('Yleiskatsaus ja näkyvyys', 'Overview and visibility') : x === 'cohort' ? L('Kilpailijavertailu', 'Competitor comparison') : L('Kysymykset ja lähteet', 'Questions and sources');
  const save = () => create.mutate({ projectId, data: { locale: lang, filters: f.params, title: titleValue.trim().slice(0, 160) || 'AI Rank', sections } }, {
    onSuccess: (r) => { toast({ title: L('Raportti tallennettu', 'Report saved') }); navigate(projectHref(`/dashboard/reports/${encodeURIComponent(r.id)}`)); },
    onError: (e) => toast({ variant: 'destructive', title: writeErrorMessage(e, d) }),
  });
  if (q.isPending) return <Panel className="p-4"><LoadingBlock rows={5} /></Panel>;
  if (q.isError || !q.data) return <Panel><AnalyticsFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel>;
  const a = q.data;
  const selected = { ...a, runs: a.runs.filter((r) => f.params.runId ? r.id === f.params.runId : r.group === a.selectedGroup) };
  return (
    <div className="flex flex-col gap-4">
      <AnalyticsFilterBar f={f} a={a} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Panel className="flex flex-col gap-4 p-5" aria-labelledby="new-report-h">
          <h2 id="new-report-h" className="text-[18px] font-semibold text-ink">{L('Luo raportti', 'Create report')}</h2>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">{L('Raportin nimi', 'Report title')}
            <input value={titleValue} onChange={(e) => setTitle(e.target.value)} maxLength={160} disabled={readOnly} className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-normal md:h-10" data-testid="input-report-title" />
          </label>
          <FilterSelect label={L('Raportin kieli', 'Report language')} value={lang} onChange={(v) => setLang(v === 'en' ? 'en' : 'fi')} testId="select-report-locale" options={[{ value: 'fi', label: 'Suomi' }, { value: 'en', label: 'English' }]} />
          <fieldset className="flex flex-col gap-2" disabled={readOnly}>
            <legend className="mb-1 text-[13px] font-semibold text-ink">{L('Sisällytettävät osiot', 'Included sections')}</legend>
            {SECTIONS.map((x) => <label key={x} className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" className="size-4" checked={sections.includes(x)} onChange={(e) => setSections(e.target.checked ? SECTIONS.filter((y) => y === x || sections.includes(y)) : sections.filter((y) => y !== x))} data-testid={`checkbox-section-${x}`} />{secLabel(x)}</label>)}
            <label className="flex items-center gap-2 text-sm text-muted-ink"><input type="checkbox" className="size-4" checked disabled readOnly data-testid="checkbox-section-methodology" />{L('Kattavuus ja laskentatapa', 'Coverage and methodology')}</label>
            <p className="text-[12px] leading-[17px] text-muted-ink">{L('Kattavuutta ja laskentatapaa ei voi jättää pois. CSV sisältää aina kaikki vastaavat rivit osioista riippumatta.', 'Coverage and methodology are always included. The CSV always contains all matching rows regardless of sections.')}</p>
          </fieldset>
          <Button disabled={readOnly} loading={create.isPending} onClick={save} data-testid="button-save-report"><Save aria-hidden />{L('Tallenna raportti', 'Save report')}</Button>
          <p className="text-[12px] text-muted-ink">{L('PDF ja CSV ladataan tallennetusta raportista.', 'PDF and CSV are downloaded from the saved report.')}</p>
        </Panel>
        <Panel className="flex min-w-0 flex-col gap-4 p-5 md:p-6" aria-label={L('Raportin esikatselu', 'Report preview')}>
          <div>
            <h2 className="text-[22px] font-semibold text-ink break-words" data-testid="text-preview-title">{titleValue || 'AI Rank'}</h2>
            <p className="mt-1 text-sm text-ink">{project?.brandName}{project?.ownedDomains?.length ? ` · ${project.ownedDomains.join(', ')}` : ''}</p>
            <p className="mt-1 text-[12px] text-muted-ink">{f.from} – {f.to} · UTC · {a.methodology}</p>
          </div>
          {a.totalRuns === 0 ? <EmptyState title={L('Valituilla suodattimilla ei ole seuranta-ajoja', 'No monitoring runs for the selected filters')} body={L('Voit silti tallentaa raportin; se kertoo rehellisesti, ettei dataa ole.', 'You can still save a report; it will honestly state that there is no data.')} /> : <>
            <Summary a={a} L={L} runId={f.params.runId} />
            {sections.includes('overview') && <GroupTrend a={selected} from={f.from} days={f.days} />}
          </>}
          <ReasonNote>{L('Tallennus ottaa muuttumattoman tilannekuvan kaikista vastaavista tallennetuista tiedoista valitussa koostumusryhmässä. Raportti on yksityinen ja vanhenee 30 päivässä.', 'Saving takes an immutable snapshot of all matching stored data in the selected composition group. The report is private and expires after 30 days.')}</ReasonNote>
        </Panel>
      </div>
    </div>
  );
}

function SavedList({ projectId }: { projectId: string }) {
  const L = useL();
  const { date } = useI18n();
  const { projectHref } = useProjects();
  const q = useReports(projectId);
  const dl = useReportDownload(projectId);
  if (q.isPending) return <Panel className="p-4"><LoadingBlock rows={4} /></Panel>;
  if (q.isError || !q.data) return <Panel>{q.unavailable ? <EmptyState title={L('Raportit eivät ole vielä käytettävissä tällä palvelimella', 'Reports are not available on this server yet')} /> : <ErrorState onRetry={() => void q.refetch()} />}</Panel>;
  if (!q.data.length) return <Panel><EmptyState icon={<FileText className="size-[18px]" aria-hidden />} title={L('Ei tallennettuja raportteja', 'No saved reports')} body={L('Valitse suodattimet esikatselussa ja tallenna raportti.', 'Choose filters in the preview and save a report.')} /></Panel>;
  const now = Date.now();
  return (
    <Panel className="overflow-hidden" as="div">
      <ul className="divide-y divide-line" data-testid="list-reports">
        {q.data.map((r) => { const expired = toMs(r.expiresAt) <= now; return (
          <li key={r.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between" data-testid={`row-report-${r.id}`}>
            <div className="min-w-0">
              <Link href={projectHref(`/dashboard/reports/${encodeURIComponent(r.id)}`)} className="font-semibold text-ink hover:text-link hover:underline break-words" data-testid={`link-report-${r.id}`}>{r.title || 'AI Rank'}</Link>
              <p className="text-[12px] text-muted-ink">{date(new Date(toMs(r.createdAt)), { dateStyle: 'medium', timeStyle: 'short' })} · {r.locale.toUpperCase()} · {expired ? L('Vanhentunut', 'Expired') : `${L('Vanhenee', 'Expires')} ${date(new Date(toMs(r.expiresAt)), { dateStyle: 'medium' })}`}</p>
            </div>
            <div className="flex gap-2">
              {expired ? <StatusBadge tone="neutral">{L('Vanhentunut', 'Expired')}</StatusBadge> : <>
                <Button size="sm" variant="secondary" loading={dl.busy === `${r.id}:pdf`} disabled={!!dl.busy} onClick={() => void dl.run(r.id, 'pdf')} data-testid={`button-pdf-${r.id}`}><FileDown aria-hidden />PDF</Button>
                <Button size="sm" variant="secondary" loading={dl.busy === `${r.id}:csv`} disabled={!!dl.busy} onClick={() => void dl.run(r.id, 'csv')} data-testid={`button-csv-${r.id}`}><FileSpreadsheet aria-hidden />CSV</Button>
              </>}
            </div>
          </li>); })}
      </ul>
    </Panel>
  );
}

export function ReportsPage() {
  const L = useL();
  const { project } = useProjects();
  useDocumentTitle(L('Raportit', 'Reports'));
  if (!project) return null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L('Raportit', 'Reports')} subtitle={L('Tallennetut, muuttumattomat tilannekuvat mittauksista. PDF ja CSV luodaan tallennetusta tilannekuvasta.', 'Saved, immutable measurement snapshots. PDF and CSV are generated from the saved snapshot.')} />
      <SubTabs label={L('Raportit', 'Reports')} fallback="new" tabs={[{ value: 'new', label: L('Uusi raportti', 'New report') }, { value: 'saved', label: L('Tallennetut', 'Saved') }]}>
        {(tab) => tab === 'saved' ? <SavedList projectId={project.id} /> : <Preview projectId={project.id} readOnly={project.status === 'archived'} />}
      </SubTabs>
    </div>
  );
}

function Detail({ r, projectId }: { r: ReportDetail; projectId: string }) {
  const L = useL();
  const { date } = useI18n();
  const dl = useReportDownload(projectId);
  const s = r.snapshot, f = s.filters;
  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[[L('Luotu', 'Created'), date(new Date(toMs(r.createdAt)), { dateStyle: 'medium', timeStyle: 'short' })], [L('Vanhenee', 'Expires'), date(new Date(toMs(r.expiresAt)), { dateStyle: 'medium' })], [L('Aikaväli', 'Range'), `${f.from ?? '–'} – ${f.to ?? '–'}`], [L('Palvelu / aihe', 'Provider / topic'), `${f.provider ?? L('kaikki', 'all')} / ${f.topic ?? L('kaikki', 'all')}`], [L('Kieli ja markkina', 'Language and market'), `${s.locale.toUpperCase()} · ${s.market} · ${L('mittaus', 'measured in')} ${s.measurementLanguage} · ${s.timezone}`], [L('Menetelmä', 'Methodology'), `${s.analytics.methodology} · ${s.schemaVersion}`], [L('Osiot', 'Sections'), [...(s.sections ?? []).map((x) => x === 'overview' ? L('Yleiskatsaus', 'Overview') : x === 'cohort' ? L('Kilpailijat', 'Competitors') : x === 'questions' ? L('Kysymykset', 'Questions') : x), L('Kattavuus ja laskentatapa', 'Coverage and methodology')].join(', ')]].map(([k, v]) => <div key={k}><dt className="text-[12px] text-muted-ink">{k}</dt><dd className="text-ink">{v}</dd></div>)}
        </dl>
        <div className="flex gap-2">
          <Button loading={dl.busy === `${r.id}:pdf`} disabled={!!dl.busy} onClick={() => void dl.run(r.id, 'pdf')} data-testid="button-download-pdf"><FileDown aria-hidden />{L('Lataa PDF', 'Download PDF')}</Button>
          <Button variant="secondary" loading={dl.busy === `${r.id}:csv`} disabled={!!dl.busy} onClick={() => void dl.run(r.id, 'csv')} data-testid="button-download-csv"><FileSpreadsheet aria-hidden />{L('Lataa CSV', 'Download CSV')}</Button>
        </div>
      </Panel>
      {s.analytics.totalRuns === 0 ? <Panel><EmptyState title={L('Tilannekuvassa ei ole seuranta-ajoja', 'This snapshot has no monitoring runs')} /></Panel> : <Summary a={s.analytics} L={L} runId={s.filters.runId} />}
      <p className="text-[12px] text-muted-ink">{L(`CSV sisältää kaikki ${s.analytics.evidence.length} tilannekuvan vastausta.`, `The CSV contains all ${s.analytics.evidence.length} answers in the snapshot.`)}</p>
    </div>
  );
}

export function ReportDetailPage() {
  const L = useL();
  const { id = '' } = useParams<{ id: string }>();
  const { project, projectHref } = useProjects();
  const q = useReport(project?.id ?? '', id);
  useDocumentTitle(L('Raportti', 'Report'));
  if (!project) return null;
  const back = <Link href={projectHref('/dashboard/reports?tab=saved')} className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-link hover:underline" data-testid="link-back"><ArrowLeft className="size-3.5" aria-hidden />{L('Raportit', 'Reports')}</Link>;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={q.data?.title || L('Raportti', 'Report')} back={back} />
      {q.isPending ? <Panel className="p-4"><LoadingBlock rows={5} /></Panel>
        : q.expired ? <Panel><EmptyState title={L('Raportti on vanhentunut', 'This report has expired')} body={L('Raportit säilytetään 30 päivää. Luo uusi raportti nykyisistä tiedoista.', 'Reports are kept for 30 days. Create a new report from current data.')} /></Panel>
        : q.notFound ? <Panel><EmptyState title={L('Raporttia ei löytynyt', 'Report not found')} /></Panel>
        : q.isError || !q.data ? <Panel>{q.unavailable ? <EmptyState title={L('Raportit eivät ole vielä käytettävissä tällä palvelimella', 'Reports are not available on this server yet')} /> : <ErrorState onRetry={() => void q.refetch()} />}</Panel>
        : <Detail r={q.data} projectId={project.id} />}
    </div>
  );
}
