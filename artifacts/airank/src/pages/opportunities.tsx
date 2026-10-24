import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, CheckCircle2, Lightbulb, Play, RefreshCw, RotateCcw } from 'lucide-react';
import type { Opportunity, OpportunityStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTitle, useI18n } from '@/i18n';
import { readApiError, writeErrorMessage } from '@/lib/api-errors';
import { useProjects } from '@/lib/project-context';
import { useQueryParam } from '@/lib/use-query-param';
import { useResearch } from '@/lib/use-research';
import { useOpportunities, useOpportunityRefresh, useOpportunityUpdate } from '@/lib/use-opportunities';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { ConfirmDialog, SubTabs } from '@/components/airank/forms';
import { useL } from '@/components/airank/analytics';
import { EvidenceLinks, PAGE_SIZE, Pager, clampPage } from '@/components/airank/research-parts';

type L = ReturnType<typeof useL>;
const STATUSES: OpportunityStatus[] = ['new', 'in_progress', 'completed'];
const statusLabel = (s: OpportunityStatus, L: L) => s === 'new' ? L('Uusi', 'New') : s === 'in_progress' ? L('Työn alla', 'In progress') : L('Valmis', 'Completed');
const statusTone = { new: 'info', in_progress: 'warning', completed: 'success' } as const;
const kindLabel = (k: Opportunity['kind'], L: L) => k === 'visibility_gap' ? L('Näkyvyysvaje', 'Visibility gap') : L('Lähdeviittausten tarkistus', 'Citation review');

function Unavailable({ unavailable, onRetry }: { unavailable: boolean; onRetry: () => void }) {
  const L = useL();
  return unavailable ? <EmptyState title={L('Mahdollisuudet eivät ole vielä käytettävissä tällä palvelimella', 'Opportunities are not available on this server yet')} body={L('Mitään esimerkkidataa ei näytetä.', 'No demonstration data is shown.')} /> : <ErrorState onRetry={onRetry} />;
}

/** Priority is explained from counts; partial coverage is always stated. */
function PriorityNote({ o }: { o: Opportunity }) {
  const L = useL();
  const { num } = useI18n();
  const partial = o.expected > 0 && o.eligible < o.expected;
  return (
    <p className="text-[12px] leading-[18px] text-muted-ink" data-testid={`text-priority-${o.id}`}>
      <span className="font-medium text-ink">{o.priority === 'high' ? L('Korkea prioriteetti', 'High priority') : L('Keskitason prioriteetti', 'Medium priority')}</span>
      {' · '}{L(`Perustuu ${num(o.evidenceIds.length)} vastaukseen ${num(o.runIds.length)} ajosta; ${num(o.eligible)} / ${num(o.expected)} kelvollista.`, `Based on ${num(o.evidenceIds.length)} answers from ${num(o.runIds.length)} runs; ${num(o.eligible)} / ${num(o.expected)} valid.`)}
      {partial && <span className="text-warning"> {L('Osittainen kattavuus – tulkitse varoen.', 'Partial coverage – interpret with care.')}</span>}
    </p>
  );
}

function RefreshButton({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const L = useL();
  const { d } = useI18n();
  const { toast } = useToast();
  const r = useOpportunityRefresh(projectId);
  return <Button variant="secondary" disabled={disabled} loading={r.isPending} onClick={() => r.mutate({ projectId, data: { refresh: true } }, { onSuccess: (l) => toast({ title: L(`Päivitetty: ${l.length} mahdollisuutta`, `Refreshed: ${l.length} opportunities`) }), onError: (e) => toast({ variant: 'destructive', title: writeErrorMessage(e, d) }) })} data-testid="button-refresh-opportunities"><RefreshCw aria-hidden />{L('Päivitä tallennetuista tuloksista', 'Refresh from stored results')}</Button>;
}

function List({ rows, status }: { rows: Opportunity[]; status: OpportunityStatus }) {
  const L = useL();
  const { date } = useI18n();
  const { projectHref } = useProjects();
  const [pageRaw, setPage] = useQueryParam('page', '1');
  const [prio, setPrio] = useQueryParam('priority', 'all');
  const filtered = rows.filter((o) => o.status === status && (prio === 'all' || o.priority === prio)).sort((a, b) => (a.priority === b.priority ? b.updatedAt - a.updatedAt : a.priority === 'high' ? -1 : 1));
  const page = clampPage(pageRaw, filtered.length);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <Panel className="overflow-hidden" as="div">
      <div className="flex flex-wrap gap-2 border-b border-line p-3" role="group" aria-label={L('Prioriteetti', 'Priority')}>
        {(['all', 'high', 'medium'] as const).map((p) => <button key={p} type="button" aria-pressed={prio === p} onClick={() => { setPrio(p); setPage('1'); }} className={`h-11 rounded-lg px-3 text-[13px] font-medium md:h-8 ${prio === p ? 'bg-tint text-ink' : 'border border-line bg-white text-ink hover:bg-canvas'}`} data-testid={`filter-priority-${p}`}>{p === 'all' ? L('Kaikki', 'All') : p === 'high' ? L('Korkea', 'High') : L('Keskitaso', 'Medium')}</button>)}
      </div>
      {!filtered.length ? <EmptyState icon={<Lightbulb className="size-[18px]" aria-hidden />} title={status === 'completed' ? L('Ei valmiita toimenpiteitä', 'No completed actions') : status === 'in_progress' ? L('Ei työn alla olevia', 'Nothing in progress') : L('Ei uusia mahdollisuuksia', 'No new opportunities')} body={L('Mahdollisuudet syntyvät vain tallennetuista mittaustuloksista kiinteillä säännöillä.', 'Opportunities come only from stored measurements via fixed rules.')} /> : (
        <>
          <ul className="divide-y divide-line" data-testid={`list-opportunities-${status}`}>
            {shown.map((o) => (
              <li key={o.id}>
                <Link href={projectHref(`/dashboard/opportunities/${encodeURIComponent(o.id)}`)} className="flex flex-col gap-1.5 px-4 py-3.5 hover:bg-canvas md:px-5" data-testid={`link-opportunity-${o.id}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink">{L(o.titleFi, o.titleEn)}</span>
                    <StatusBadge tone={o.priority === 'high' ? 'warning' : 'neutral'}>{o.priority === 'high' ? L('Korkea', 'High') : L('Keskitaso', 'Medium')}</StatusBadge>
                    <StatusBadge tone="neutral">{kindLabel(o.kind, L)}</StatusBadge>
                  </span>
                  <span className="line-clamp-2 text-[13px] text-muted-ink">{L(o.rationaleFi, o.rationaleEn)}</span>
                  <span className="flex flex-wrap items-center justify-between gap-2"><PriorityNote o={o} /><span className="text-[12px] text-muted-ink">{L('Päivitetty', 'Updated')} {date(new Date(o.updatedAt), { dateStyle: 'medium' })}</span></span>
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={page} total={filtered.length} onPage={(p) => setPage(String(p))} label={L(`${filtered.length} mahdollisuutta`, `${filtered.length} opportunities`)} />
        </>
      )}
    </Panel>
  );
}

export function OpportunitiesPage() {
  const L = useL();
  const { project } = useProjects();
  const q = useOpportunities(project?.id ?? '');
  useDocumentTitle(L('Toimenpiteet', 'Opportunities'));
  if (!project) return null;
  const rows = q.data ?? [];
  const count = (s: OpportunityStatus) => rows.filter((o) => o.status === s).length;
  const readOnly = project.status === 'archived';
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L('Toimenpiteet', 'Opportunities')} subtitle={L('Toimenpide-ehdotuksia tallennetuista vastauksista ja lähdeviittauksista. Ei sivustoauditointeja, hakumääriä tai luvattuja tulosparannuksia.', 'Suggested actions from stored answers and citations. No site audits, search volumes or promised score improvements.')}
        actions={<RefreshButton projectId={project.id} disabled={readOnly || q.unavailable} />} />
      {q.isPending ? <Panel className="p-4"><LoadingBlock rows={6} /></Panel> : q.isError ? <Panel><Unavailable unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel>
        : !rows.length ? <Panel><EmptyState icon={<Lightbulb className="size-[18px]" aria-hidden />} title={L('Ei vielä näyttöön perustuvia mahdollisuuksia', 'No evidence-backed opportunities yet')} body={L('Päivitys ajaa kiinteät säännöt tallennettuihin tuloksiin ilman maksullisia kutsuja. Jos mittauksia ei ole, mitään ei luoda.', 'Refresh runs fixed rules on stored results without paid calls. If there are no measurements, nothing is created.')} action={<RefreshButton projectId={project.id} disabled={readOnly} />} /></Panel>
        : <SubTabs label={L('Tila', 'Status')} fallback="new" tabs={STATUSES.map((s) => ({ value: s, label: `${statusLabel(s, L)} (${count(s)})` }))}>
            {(tab) => <List key={tab} rows={rows} status={tab as OpportunityStatus} />}
          </SubTabs>}
    </div>
  );
}

export function OpportunityDetailPage() {
  const L = useL();
  const { d, date, num } = useI18n();
  const { toast } = useToast();
  const { id = '' } = useParams<{ id: string }>();
  const { project, projectHref } = useProjects();
  const pid = project?.id ?? '';
  const q = useOpportunities(pid);
  const upd = useOpportunityUpdate(pid);
  const research = useResearch(pid);
  const evMap = useMemo(() => new Map((research.data?.evidence ?? []).map((e) => [e.id, e])), [research.data]);
  const o = q.data?.find((x) => x.id === id);
  const [notes, setNotes] = useState('');
  const [base, setBase] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reopen, setReopen] = useState(false);
  const init = useRef<string | null>(null);
  useDocumentTitle(o ? L(o.titleFi, o.titleEn) : L('Mahdollisuus', 'Opportunity'));
  useEffect(() => { if (o && init.current !== o.id) { init.current = o.id; setNotes(o.notes); setBase(o.version); } }, [o]);
  if (!project) return null;
  const back = <Link href={projectHref('/dashboard/opportunities')} className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-link hover:underline" data-testid="link-back"><ArrowLeft className="size-3.5" aria-hidden />{L('Toimenpiteet', 'Opportunities')}</Link>;
  const shell = (body: React.ReactNode) => <><PageHeader title={L('Mahdollisuus', 'Opportunity')} back={back} />{body}</>;
  if (q.isPending) return shell(<Panel className="p-4"><LoadingBlock rows={6} /></Panel>);
  if (q.isError) return shell(<Panel><Unavailable unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel>);
  if (!o) return shell(<Panel><EmptyState title={L('Mahdollisuutta ei löytynyt', 'Opportunity not found')} body={L('Se voi kuulua toiseen projektiin.', 'It may belong to another project.')} /></Panel>);

  const readOnly = project.status === 'archived';
  const stale = base !== null && base !== o.version;
  const save = (status: OpportunityStatus, ok: string) => {
    setErr(null);
    upd.mutate({ projectId: pid, opportunityId: o.id, data: { expectedVersion: base ?? o.version, status, notes } }, {
      onSuccess: (n) => { setBase(n.version); setNotes(n.notes); toast({ title: ok }); },
      onError: (e) => setErr(readApiError(e).status === 409 ? L('Mahdollisuutta on muutettu muualla. Lataa uusin versio ennen tallennusta.', 'This opportunity changed elsewhere. Load the latest version before saving.') : writeErrorMessage(e, d)),
    });
  };
  const reload = () => { setNotes(o.notes); setBase(o.version); setErr(null); };
  const dis = readOnly || upd.isPending || stale;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L(o.titleFi, o.titleEn)} back={back} subtitle={kindLabel(o.kind, L)}
        actions={<StatusBadge tone={statusTone[o.status]} data-testid="status-opportunity">{statusLabel(o.status, L)}</StatusBadge>} />
      {stale && <ReasonNote tone="warning"><span className="flex flex-wrap items-center gap-2">{L('Tätä mahdollisuutta on päivitetty muualla.', 'This opportunity was updated elsewhere.')}<button type="button" className="font-medium underline" onClick={reload} data-testid="button-reload-opportunity">{L('Lataa uusin versio', 'Load latest version')}</button></span></ReasonNote>}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="p-5" aria-labelledby="why-h">
            <h2 id="why-h" className="text-[16px] font-semibold text-ink">{L('Miksi', 'Why')}</h2>
            <p className="mt-2 text-sm leading-6 text-ink">{L(o.rationaleFi, o.rationaleEn)}</p>
            <div className="mt-3"><PriorityNote o={o} /></div>
          </Panel>
          <Panel className="p-5" aria-labelledby="act-h">
            <h2 id="act-h" className="text-[16px] font-semibold text-ink">{L('Ehdotettu toimenpide', 'Suggested action')}</h2>
            <p className="mt-2 text-sm leading-6 text-ink">{L(o.actionFi, o.actionEn)}</p>
            <p className="mt-3 text-[12px] text-muted-ink">{L('Toimenpiteen merkitseminen valmiiksi ei muuta mitattuja tuloksia. Vaikutus näkyy vain tulevissa mittauksissa, jos lainkaan.', 'Marking an action complete does not change measured results. Any effect appears only in future measurements, if at all.')}</p>
          </Panel>
          <Panel className="p-5" aria-labelledby="ev-h">
            <h2 id="ev-h" className="mb-3 text-[16px] font-semibold text-ink">{L('Todisteet', 'Evidence')} <span className="tabular text-muted-ink">({num(o.evidenceIds.length)})</span></h2>
            <EvidenceLinks ids={o.evidenceIds} evidence={evMap} testId="list-opportunity-evidence" />
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel className="flex flex-col gap-3 p-5" aria-labelledby="work-h">
            <h2 id="work-h" className="text-[16px] font-semibold text-ink">{L('Työn tila', 'Work status')}</h2>
            <label className="text-[13px] font-medium text-ink">{L('Muistiinpanot', 'Notes')}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={5} disabled={readOnly} className="mt-1 w-full rounded-lg border border-line bg-white p-3 text-sm" data-testid="input-opportunity-notes" />
            </label>
            {err && <p className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger" role="alert" data-testid="text-opportunity-error">{err}</p>}
            <div className="flex flex-wrap gap-2">
              {o.status === 'new' && <Button disabled={dis} loading={upd.isPending} onClick={() => save('in_progress', L('Siirretty työn alle', 'Moved to in progress'))} data-testid="button-start"><Play aria-hidden />{L('Aloita', 'Start')}</Button>}
              {o.status !== 'completed' && <Button variant={o.status === 'new' ? 'secondary' : 'default'} disabled={dis} onClick={() => save('completed', L('Merkitty valmiiksi', 'Marked complete'))} data-testid="button-complete"><CheckCircle2 aria-hidden />{L('Merkitse valmiiksi', 'Mark complete')}</Button>}
              {o.status !== 'completed' && <Button variant="ghost" disabled={dis || notes === o.notes} onClick={() => save(o.status, L('Muistiinpanot tallennettu', 'Notes saved'))} data-testid="button-save-notes">{L('Tallenna muistiinpanot', 'Save notes')}</Button>}
              {o.status === 'completed' && <>
                <Button variant="ghost" disabled={dis || notes === o.notes} onClick={() => save('completed', L('Muistiinpanot tallennettu', 'Notes saved'))} data-testid="button-save-notes">{L('Tallenna muistiinpanot', 'Save notes')}</Button>
                <ConfirmDialog open={reopen} onOpenChange={setReopen} title={L('Avataanko uudelleen?', 'Reopen this action?')} body={L('Toimenpide palaa työn alle. Valmistumismerkintä säilyy historiassa.', 'The action returns to in progress. The completion stays in the history.')} confirmLabel={L('Avaa uudelleen', 'Reopen')} onConfirm={() => save('in_progress', L('Avattu uudelleen', 'Reopened'))}
                  trigger={<Button variant="secondary" disabled={dis} data-testid="button-reopen"><RotateCcw aria-hidden />{L('Avaa uudelleen', 'Reopen')}</Button>} />
              </>}
            </div>
          </Panel>
          <Panel className="p-5" aria-labelledby="meta-h">
            <h2 id="meta-h" className="text-[16px] font-semibold text-ink">{L('Tiedot', 'Details')}</h2>
            <dl className="mt-2 text-sm">
              {[[L('Sääntöversio', 'Rule version'), o.ruleVersion], [L('Versio', 'Version'), `v${o.version}`], [L('Luotu', 'Created'), date(new Date(o.createdAt), { dateStyle: 'medium', timeStyle: 'short' })], [L('Päivitetty', 'Updated'), date(new Date(o.updatedAt), { dateStyle: 'medium', timeStyle: 'short' })], [L('Ajot', 'Runs'), num(o.runIds.length)]].map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-line py-2 last:border-0"><dt className="text-muted-ink">{k}</dt><dd className="tabular text-right text-ink">{v}</dd></div>)}
            </dl>
          </Panel>
          <Panel className="p-5" aria-labelledby="hist-h">
            <h2 id="hist-h" className="mb-2 text-[16px] font-semibold text-ink">{L('Historia', 'History')}</h2>
            {!o.history.length ? <p className="text-sm text-muted-ink">{L('Ei muutoksia.', 'No changes.')}</p> : (
              <ol className="flex flex-col gap-2" data-testid="list-opportunity-history">
                {[...o.history].sort((a, b) => b.at - a.at).map((h, i) => (
                  <li key={i} className="border-l-2 border-line pl-3 text-[13px]">
                    <span className="flex flex-wrap items-center gap-2"><StatusBadge tone={statusTone[h.status]}>{statusLabel(h.status, L)}</StatusBadge><span className="text-muted-ink">{date(new Date(h.at), { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                    {h.notes && <p className="mt-1 whitespace-pre-wrap break-words text-ink">{h.notes}</p>}
                  </li>))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
