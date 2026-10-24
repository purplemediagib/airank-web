import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Building2, Pause, Play, Upload } from 'lucide-react';
import type { Industry, IndustryActionInput, IndustryDirectory, IndustryPanel } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTitle, useI18n } from '@/i18n';
import { ProviderMark } from '@/components/airank/provider-brand';
import { writeErrorMessage } from '@/lib/api-errors';
import { useProjects } from '@/lib/project-context';
import { useQueryParam } from '@/lib/use-query-param';
import { useIndustry, useIndustryAction, useIndustryDirectory } from '@/lib/use-industries';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { FilterSelect, SearchInput } from '@/components/airank/data';
import { safeUrl, useL } from '@/components/airank/analytics';
import { RunStatus } from '@/components/airank/prompt-parts';

type L = ReturnType<typeof useL>;
const statusTone = { measured: 'success', unmeasured: 'info', draft: 'neutral' } as const;
const statusLabel = (s: Industry['status'], L: L) => s === 'measured' ? L('Mitattu', 'Measured') : s === 'unmeasured' ? L('Julkaistu, ei mitattu', 'Published, not measured') : L('Luonnos – ei mitattu', 'Draft – not measured');

function IndustryStatus({ i }: { i: Industry }) {
  const L = useL();
  return <span className="flex flex-wrap gap-1"><StatusBadge tone={statusTone[i.status]}>{statusLabel(i.status, L)}</StatusBadge>{i.pilot && <StatusBadge tone="warning">{L('Pilotti', 'Pilot')}</StatusBadge>}</span>;
}

function Unavailable({ onRetry, unavailable }: { onRetry: () => void; unavailable: boolean }) {
  const L = useL();
  return unavailable ? <EmptyState title={L('Toimialavertailut eivät ole vielä käytettävissä tällä palvelimella', 'Industry benchmarks are not available on this server yet')} body={L('Mitään esimerkkidataa ei näytetä.', 'No demonstration data is shown.')} /> : <ErrorState onRetry={onRetry} />;
}

/** Server-validated JSON import. Both confirmations are explicit; nothing is inferred from names. */
function ImportDialog({ open, onOpenChange, returnFocus }: { open: boolean; onOpenChange: (v: boolean) => void; returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const L = useL();
  const { d } = useI18n();
  const { toast } = useToast();
  const act = useIndustryAction();
  const [text, setText] = useState('');
  const [verified, setVerified] = useState(false);
  const [neutral, setNeutral] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    setErr(null);
    let panel: unknown;
    try { panel = JSON.parse(text); } catch { setErr(L('JSON ei ole kelvollista.', 'The JSON is not valid.')); return; }
    if (!panel || typeof panel !== 'object' || Array.isArray(panel)) { setErr(L('Paneelin on oltava JSON-objekti.', 'The panel must be a JSON object.')); return; }
    act.mutate({ data: { action: 'import', panel: panel as Record<string, unknown>, verified: true, neutralConfirmed: true } }, {
      onSuccess: () => { toast({ title: L('Paneeli tuotu luonnoksena', 'Panel imported as draft') }); setText(''); setVerified(false); setNeutral(false); onOpenChange(false); },
      onError: (e) => setErr(writeErrorMessage(e, d)),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] rounded-[12px] border-line" onCloseAutoFocus={(e) => { e.preventDefault(); returnFocus.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-ink">{L('Tuo vertailupaneeli', 'Import benchmark panel')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-ink">{L('Palvelin validoi paneelin (FI/fi, 1–100 brändiä vahvistetuilla verkkotunnuksilla, 1–200 neutraalia kysymystä). Paneeli on muuttumaton; muutokset vaativat uuden id:n ja version. Tuonti ei julkaise eikä aja mitään.', 'The server validates the panel (FI/fi, 1–100 brands with confirmed domains, 1–200 neutral prompts). Panels are immutable; changes need a new id and version. Importing neither publishes nor runs anything.')}</DialogDescription>
        </DialogHeader>
        <label className="text-[13px] font-medium text-ink">{L('Paneelin JSON', 'Panel JSON')}
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={12} className="mt-1 w-full rounded-lg border border-line bg-white p-3 font-mono text-[12px] leading-[18px]" placeholder='{"id":"…","version":"…","country":"FI","language":"fi","industry":{"id":"…","name":"…"},"brands":[…],"prompts":[…]}' data-testid="input-panel-json" />
        </label>
        <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1 size-4" checked={verified} onChange={(e) => setVerified(e.target.checked)} data-testid="checkbox-verified" />{L('Olen vahvistanut jokaisen brändin nimen, aliakset ja verkkotunnuksen.', 'I have verified every brand name, alias and domain.')}</label>
        <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1 size-4" checked={neutral} onChange={(e) => setNeutral(e.target.checked)} data-testid="checkbox-neutral" />{L('Vahvistan, että kysymykset ovat neutraaleja eivätkä nimeä seurattuja brändejä.', 'I confirm the prompts are neutral and name no tracked brand.')}</label>
        {err && <p className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger" role="alert" data-testid="text-import-error">{err}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{L('Peruuta', 'Cancel')}</Button>
          <Button disabled={!text.trim() || !verified || !neutral} loading={act.isPending} onClick={submit} data-testid="button-import-submit"><Upload aria-hidden />{L('Tuo luonnokseksi', 'Import as draft')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IndustriesPage() {
  const L = useL();
  const { num } = useI18n();
  const { projectHref } = useProjects();
  const q = useIndustryDirectory();
  const [search, setSearch] = useQueryParam('q', '');
  const [status, setStatus] = useQueryParam('status', 'all');
  const [imp, setImp] = useState(false);
  const impBtn = useRef<HTMLButtonElement | null>(null);
  useDocumentTitle(L('Toimialat', 'Industries'));
  const data = q.data;
  const needle = search.trim().toLocaleLowerCase();
  const rows = (data?.industries ?? []).filter((i) => (status === 'all' || i.status === status) && (!needle || `${i.nameFi} ${i.nameEn}`.toLocaleLowerCase().includes(needle)));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L('Toimialat', 'Industries')} subtitle={L('Kiinteät vertailupaneelit: samat neutraalit kysymykset ja vahvistetut brändit samoilla malleilla. API-pohjaisia havaintoja, ei kuluttajasovellusten sijoituksia.', 'Fixed benchmark panels: the same neutral prompts and verified brands across the same models. API-based observations, not consumer-app rankings.')}
        actions={data?.admin && <Button ref={impBtn} onClick={() => setImp(true)} data-testid="button-import-panel"><Upload aria-hidden />{L('Tuo paneeli', 'Import panel')}</Button>} />
      {q.isPending ? <Panel className="p-4"><LoadingBlock rows={6} /></Panel> : q.isError || !data ? <Panel><Unavailable unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel> : (
        <>
          {data.admin && <ReasonNote>{L('Ylläpitäjänäkymä. Tuonti, julkaisu, ajastus ja manuaaliset ajot ovat erillisiä vaiheita.', 'Admin view. Import, publication, scheduling and manual runs are separate steps.')}</ReasonNote>}
          <Panel className="overflow-hidden" as="div">
            <div className="flex flex-col gap-2 border-b border-line p-4 md:flex-row md:items-center">
              <SearchInput value={search} onChange={setSearch} label={L('Hae toimialaa', 'Search industries')} testId="input-search-industries" />
              <FilterSelect label={L('Tila', 'Status')} value={status} onChange={setStatus} testId="select-industry-status" options={[{ value: 'all', label: L('Kaikki', 'All') }, { value: 'measured', label: L('Mitattu', 'Measured') }, { value: 'unmeasured', label: L('Ei mitattu', 'Not measured') }, { value: 'draft', label: L('Luonnos', 'Draft') }]} />
            </div>
            {!rows.length ? <EmptyState icon={<Building2 className="size-[18px]" aria-hidden />} title={L('Ei toimialoja tällä suodatuksella', 'No industries for this filter')} /> : (
              <ul className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-y-0 md:gap-px md:bg-line xl:grid-cols-3" data-testid="list-industries">
                {rows.map((i) => {
                  const runs = i.panels.reduce((n, p) => n + p.runs.length, 0);
                  return (
                    <li key={i.id} className="bg-white">
                      <Link href={projectHref(`/dashboard/industries/${encodeURIComponent(i.id)}`)} className="flex h-full flex-col gap-2 p-4 hover:bg-canvas" data-testid={`link-industry-${i.id}`}>
                        <span className="text-[15px] font-semibold text-ink">{L(i.nameFi, i.nameEn)}</span>
                        <IndustryStatus i={i} />
                        <span className="tabular mt-auto text-[12px] text-muted-ink">{i.panels.length ? L(`${num(i.panels.length)} paneelia · ${num(runs)} ajoa`, `${num(i.panels.length)} panels · ${num(runs)} runs`) : L('Ehdotettu toimiala – ei paneelia', 'Proposed industry – no panel')}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
      <ImportDialog open={imp} onOpenChange={setImp} returnFocus={impBtn} />
    </div>
  );
}

const DAYS_FI = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AdminPanelActions({ p, dir }: { p: IndustryPanel; dir: IndustryDirectory }) {
  const L = useL();
  const { d, num } = useI18n();
  const { toast } = useToast();
  const act = useIndustryAction();
  const [mode, setMode] = useState<'publish' | 'run' | null>(null);
  const [verified, setVerified] = useState(false);
  const [neutral, setNeutral] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submission = useRef('');
  const trigger = useRef<HTMLElement | null>(null);
  const open = (m: 'publish' | 'run', el: HTMLElement) => { trigger.current = el; setErr(null); setVerified(false); setNeutral(false); submission.current = crypto.randomUUID(); setMode(m); };
  const go = (body: IndustryActionInput, ok: string) => act.mutate({ data: body }, {
    onSuccess: () => { toast({ title: ok }); setMode(null); },
    onError: (e) => { const m = writeErrorMessage(e, d); if (mode) setErr(m); else toast({ variant: 'destructive', title: m }); },
  });
  const over = p.requiredCalls > p.capacity;
  return (
    <div className="flex flex-wrap gap-2" data-testid={`admin-actions-${p.id}`}>
      {!p.published && <Button size="sm" onClick={(e) => open('publish', e.currentTarget)} data-testid={`button-publish-${p.id}`}>{L('Julkaise', 'Publish')}</Button>}
      {p.published && <Button size="sm" variant="secondary" disabled={!dir.activationAvailable && !p.enabled || act.isPending || (over && !p.enabled)} title={!dir.activationAvailable ? L('Ajastin ei ole käytössä tällä palvelimella', 'The scheduler is not enabled on this server') : over ? L('Paneeli ylittää kapasiteetin', 'Panel exceeds capacity') : undefined}
        onClick={() => go({ action: 'schedule', panelId: p.id, enabled: !p.enabled }, p.enabled ? L('Ajastus keskeytetty', 'Schedule paused') : L('Ajastus jatkuu', 'Schedule resumed'))} data-testid={`button-schedule-${p.id}`}>{p.enabled ? <><Pause aria-hidden />{L('Keskeytä', 'Pause')}</> : <><Play aria-hidden />{L('Jatka ajastusta', 'Resume schedule')}</>}</Button>}
      {p.published && <Button size="sm" variant="secondary" onClick={(e) => open('run', e.currentTarget)} data-testid={`button-run-${p.id}`}>{L('Aja nyt', 'Run now')}</Button>}
      <Dialog open={!!mode} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-w-[480px] rounded-[12px] border-line" onCloseAutoFocus={(e) => { e.preventDefault(); trigger.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-ink">{mode === 'run' ? L('Käynnistetäänkö maksullinen ajo?', 'Start a paid run?') : L('Julkaise paneeli', 'Publish panel')}</DialogTitle>
            <DialogDescription className="text-sm text-muted-ink">{mode === 'run'
              ? L(`Ajo tekee täsmälleen ${num(p.requiredCalls)} maksullista mallikutsua (${num(p.prompts)} kysymystä × reitit). Sama ajo ei käynnisty kahdesti.`, `The run makes exactly ${num(p.requiredCalls)} paid model calls (${num(p.prompts)} prompts × routes). The same run is never started twice.`)
              : L('Julkaistu paneeli näkyy kaikille käyttäjille. Julkaisu ei käynnistä ajoa.', 'A published panel is visible to all users. Publishing does not start a run.')}</DialogDescription>
          </DialogHeader>
          {mode === 'publish' && <>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={verified} onChange={(e) => setVerified(e.target.checked)} data-testid="checkbox-publish-verified" />{L('Brändit ja verkkotunnukset on vahvistettu.', 'Brands and domains are verified.')}</label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={neutral} onChange={(e) => setNeutral(e.target.checked)} data-testid="checkbox-publish-neutral" />{L('Kysymykset ovat neutraaleja.', 'Prompts are neutral.')}</label>
          </>}
          {err && <p className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger" role="alert">{err}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>{L('Peruuta', 'Cancel')}</Button>
            {mode === 'run'
              ? <Button loading={act.isPending} onClick={() => go({ action: 'run', panelId: p.id, submissionId: submission.current }, L('Ajo jonossa', 'Run queued'))} data-testid="button-run-confirm">{L(`Käynnistä ${num(p.requiredCalls)} kutsua`, `Start ${num(p.requiredCalls)} calls`)}</Button>
              : <Button disabled={!verified || !neutral} loading={act.isPending} onClick={() => go({ action: 'publish', panelId: p.id, verified: true, neutralConfirmed: true }, L('Paneeli julkaistu', 'Panel published'))} data-testid="button-publish-confirm">{L('Julkaise', 'Publish')}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function compKey(c: string) { try { const o = JSON.parse(c) as Record<string, unknown>; return JSON.stringify([o.panel, o.methodology, o.models, o.routes]); } catch { return c; } }

function PanelView({ p, dir }: { p: IndustryPanel; dir: IndustryDirectory }) {
  const L = useL();
  const { num, date, locale } = useI18n();
  const DAYS = locale === 'fi' ? DAYS_FI : DAYS_EN;
  const fmt = (t: number | null | undefined) => (t ? date(new Date(t), { dateStyle: 'medium', timeStyle: 'short' }) : '–');
  const latestKey = p.runs[0] ? compKey(p.runs[0].composition) : '';
  const lt = p.latest;
  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {[[L('Versio', 'Version'), p.version], [L('Brändit', 'Brands'), num(p.brands)], [L('Kysymykset', 'Prompts'), num(p.prompts)], [L('Kutsua / ajo', 'Calls / run'), `${num(p.requiredCalls)} / ${num(p.capacity)}`],
              [L('Julkaisu', 'Publication'), p.published ? L('Julkaistu', 'Published') : L('Luonnos', 'Draft')], [L('Ajastus', 'Schedule'), p.enabled ? `${p.weekdays.map((x) => DAYS[x]).join(', ')} ${String(p.hour).padStart(2, '0')}:00 ${p.timezone}` : L('Ei käytössä', 'Off')], [L('Seuraava ajo', 'Next run'), fmt(p.nextAt)], [L('Ajoja', 'Runs'), num(p.runs.length)]]
              .map(([k, v]) => <div key={k}><dt className="text-[12px] text-muted-ink">{k}</dt><dd className="tabular font-medium text-ink">{v}</dd></div>)}
          </dl>
          {dir.admin && <AdminPanelActions p={p} dir={dir} />}
        </div>
        {p.requiredCalls > p.capacity && <div className="mt-3"><ReasonNote tone="warning">{L('Paneeli ylittää ajokohtaisen kapasiteetin, joten sitä ei voi ajastaa.', 'The panel exceeds per-run capacity, so it cannot be scheduled.')}</ReasonNote></div>}
      </Panel>
      <Panel className="overflow-hidden" aria-labelledby={`rank-${p.id}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
          <h2 id={`rank-${p.id}`} className="text-[16px] font-semibold text-ink">{L('Viimeisin näkyvyysjärjestys', 'Latest visibility ranking')}</h2>
          {lt && <span className="tabular text-[12px] text-muted-ink" data-testid="text-coverage">{L(`Kattavuus ${num(lt.eligible)} / ${num(lt.expected)} kelvollista vastausta`, `Coverage ${num(lt.eligible)} / ${num(lt.expected)} valid answers`)}</span>}
        </div>
        {!lt ? <EmptyState title={L('Ei vielä mitattu', 'Not measured yet')} body={L('Järjestys näytetään vasta todellisen ajon jälkeen. Mitään arvioita ei näytetä.', 'A ranking appears only after a real run. No estimates are shown.')} /> : (
          <table className="w-full text-left text-sm" data-testid={`table-ranking-${p.id}`}>
            <caption className="sr-only">{L('Näkyvyysjärjestys', 'Visibility ranking')}</caption>
            <thead><tr className="border-y border-line text-[12px] text-muted-ink"><th scope="col" className="h-9 w-10 px-4 font-medium">#</th><th scope="col" className="px-2 font-medium">{L('Brändi', 'Brand')}</th><th scope="col" className="px-2 text-right font-medium">{L('Näkyvyys', 'Visibility')}</th><th scope="col" className="hidden px-2 text-right font-medium sm:table-cell">{L('Maininnat', 'Mentions')}</th><th scope="col" className="hidden px-4 text-right font-medium sm:table-cell">{L('Viittaukset', 'Citations')}</th></tr></thead>
            <tbody>{lt.rankings.map((r, i) => (
              <tr key={r.id} className="border-b border-line last:border-0" data-testid={`row-rank-${r.id}`}>
                <td className="tabular px-4 py-2.5 text-muted-ink">{r.visibility === null ? '–' : i + 1}</td>
                <td className="px-2 font-medium text-ink">{r.name}</td>
                <td className="px-2 text-right"><span className="inline-flex items-center gap-2"><span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-canvas ring-1 ring-line sm:block" aria-hidden><span className="block h-full bg-navy" style={{ width: `${r.visibility ?? 0}%` }} /></span><span className="tabular w-12 font-semibold">{r.visibility === null ? '–' : `${num(r.visibility)} %`}</span></span></td>
                <td className="tabular hidden px-2 text-right sm:table-cell">{num(r.mentions)}</td>
                <td className="tabular hidden px-4 text-right sm:table-cell">{num(r.citations)}</td>
              </tr>))}</tbody>
          </table>
        )}
      </Panel>
      {lt && lt.evidence.length > 0 && <Panel className="p-5" aria-labelledby={`ev-${p.id}`}>
        <h2 id={`ev-${p.id}`} className="mb-3 text-[16px] font-semibold text-ink">{L('Ajon vastaukset', 'Run answers')} <span className="tabular text-muted-ink">({num(lt.evidence.length)})</span></h2>
        <ul className="flex flex-col gap-2" data-testid={`list-industry-evidence-${p.id}`}>
          {lt.evidence.map((e) => (
            <li key={e.id} className="rounded-lg ring-1 ring-line">
              <details className="group">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]">
                  <span lang="fi" className="min-w-0 flex-1 font-medium text-ink">{e.prompt}</span>
                  <span className="flex items-center gap-2 text-[12px] text-muted-ink"><ProviderMark provider={e.provider} />{e.model ? ` · ${e.model}` : ''} · {fmt(e.observedAt)}</span>
                  <RunStatus status={e.status} />
                </summary>
                <div className="border-t border-line px-3 py-3">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{e.answer || L('Ei vastaustekstiä', 'No answer text')}</p>
                  {e.citations.length > 0 && <ol className="mt-2 flex flex-col gap-1 text-[13px]">{e.citations.map((c, i) => { const u = safeUrl(c.url); return <li key={i} className="break-all">{u ? <a href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-link hover:underline">{c.title || c.url}</a> : <span>{c.title || c.url}</span>}</li>; })}</ol>}
                </div>
              </details>
            </li>))}
        </ul>
      </Panel>}
      <Panel className="p-5" aria-labelledby={`hist-${p.id}`}>
        <h2 id={`hist-${p.id}`} className="mb-3 text-[16px] font-semibold text-ink">{L('Ajohistoria', 'Run history')}</h2>
        {!p.runs.length ? <p className="text-sm text-muted-ink">{L('Ei ajoja.', 'No runs.')}</p> : (
          <ul className="divide-y divide-line" data-testid={`list-runs-${p.id}`}>
            {p.runs.map((r, i) => { const same = compKey(r.composition) === latestKey; return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="text-ink">{fmt(r.createdAt)} <span className="font-mono text-[11px] text-muted-ink">{r.id.slice(0, 10)}</span></span>
                <span className="flex gap-1"><RunStatus status={r.status} />{i > 0 && <StatusBadge tone={same ? 'success' : 'warning'}>{same ? L('Vertailukelpoinen', 'Comparable') : L('Eri koostumus – ei vertailukelpoinen', 'Different composition – not comparable')}</StatusBadge>}</span>
              </li>); })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function IndustryDetailPage() {
  const L = useL();
  const { id = '' } = useParams<{ id: string }>();
  const { projectHref } = useProjects();
  const q = useIndustry(id);
  const ind = q.data?.industries[0];
  const [panelRaw, setPanel] = useQueryParam('panel', '');
  useDocumentTitle(ind ? L(ind.nameFi, ind.nameEn) : L('Toimiala', 'Industry'));
  const panel = useMemo(() => ind?.panels.find((p) => p.id === panelRaw) ?? ind?.panels[0], [ind, panelRaw]);
  const back = <Link href={projectHref('/dashboard/industries')} className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-link hover:underline" data-testid="link-back"><ArrowLeft className="size-3.5" aria-hidden />{L('Toimialat', 'Industries')}</Link>;
  if (q.isPending) return <><PageHeader title={L('Toimiala', 'Industry')} back={back} /><Panel className="p-4"><LoadingBlock rows={6} /></Panel></>;
  if (q.notFound) return <><PageHeader title={L('Toimiala', 'Industry')} back={back} /><Panel><EmptyState title={L('Toimialaa ei löytynyt', 'Industry not found')} /></Panel></>;
  if (q.isError || !q.data || !ind) return <><PageHeader title={L('Toimiala', 'Industry')} back={back} /><Panel><Unavailable unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel></>;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L(ind.nameFi, ind.nameEn)} back={back} subtitle={L('Kiinteä paneeli, samat kysymykset kaikille brändeille. Näkyvyys = maininnat / kelvolliset vastaukset.', 'Fixed panel, same prompts for every brand. Visibility = mentions / valid answers.')}
        actions={ind.panels.length > 1 && panel ? <FilterSelect label={L('Paneelin versio', 'Panel version')} value={panel.id} onChange={setPanel} testId="select-panel-version" options={ind.panels.map((p) => ({ value: p.id, label: `${p.version}${p.published ? '' : ` (${L('luonnos', 'draft')})`}` }))} /> : undefined} />
      <IndustryStatus i={ind} />
      {!panel ? <Panel><EmptyState icon={<Building2 className="size-[18px]" aria-hidden />} title={L('Ehdotettu toimiala – ei vielä mitattu', 'Proposed industry – not measured yet')} body={L('Tälle toimialalle ei ole vielä vahvistettua paneelia. Tuloksia ei arvioida.', 'This industry has no verified panel yet. No results are estimated.')} /></Panel> : <PanelView key={panel.id} p={panel} dir={q.data} />}
    </div>
  );
}
