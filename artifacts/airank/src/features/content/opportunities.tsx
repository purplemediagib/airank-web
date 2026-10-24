import { useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock, StatusBadge, type Tone } from '@/components/airank/primitives';
import { useToast } from '@/hooks/use-toast';
import { useDocuments, useRecords, useStudio } from './studio';
import { Banner, Card, Drawer, ExtLink, Field, areaCls, inputCls, useErr, useFmt, useTx } from './ui';
import { EditButton, useOpenJob, useRunJob } from './actions';
import { oppKindLabel, SourceChips } from './results';

const STATUSES = ['new', 'in_progress', 'completed', 'dismissed'] as const;

export function OpportunitiesView() {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const err = useErr(); const { toast } = useToast();
  const q = useRecords('opportunities'); const docs = useDocuments(); const [, nav] = useLocation();
  const initial = new URLSearchParams(useSearch()).get('open');
  const [openId, setOpenId] = useState<string | null>(initial);
  const [status, setStatus] = useState('open'); const [kind, setKind] = useState(''); const [prio, setPrio] = useState('');
  const { run, busy } = useRunJob(); const openJob = useOpenJob();
  const statusLabel = (x: string) => ({ new: tx('New', 'Uusi'), in_progress: tx('In progress', 'Työn alla'), completed: tx('Completed', 'Valmis'), dismissed: tx('Dismissed', 'Hylätty') }[x] ?? x);
  const rows = (q.data ?? []).filter((o) => (status === 'open' ? ['new', 'in_progress'].includes(o.status) : !status || o.status === status) && (!kind || o.kind === kind) && (!prio || o.priority === prio));
  const sel = (q.data ?? []).find((o) => o.id === openId);
  const kinds = [...new Set((q.data ?? []).map((o) => o.kind))];
  const tone: Record<string, Tone> = { high: 'error', medium: 'warning', low: 'neutral' };
  const prioLabel = (p: string) => ({ high: tx('High', 'Korkea'), medium: tx('Medium', 'Keskitaso'), low: tx('Low', 'Matala') }[p] ?? p);
  const improve = async (o: any) => {
    const doc = (docs.data ?? []).find((d) => d.sourceUrl && o.url && d.sourceUrl.replace(/\/$/, '') === String(o.url).replace(/\/$/, ''));
    if (doc) { nav(s.ph(`/dashboard/content/documents/${doc.id}`)); return; }
    if (!o.url) return;
    openJob(await run('import', { url: o.url, locale: s.overview.project?.promptLanguage ?? 'fi' }));
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={tx('Status', 'Tila')} className={inputCls + ' w-auto'} value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">{tx('Open', 'Avoimet')}</option><option value="">{tx('All statuses', 'Kaikki tilat')}</option>{STATUSES.map((x) => <option key={x} value={x}>{statusLabel(x)}</option>)}</select>
        <select aria-label={tx('Type', 'Tyyppi')} className={inputCls + ' w-auto'} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">{tx('All types', 'Kaikki tyypit')}</option>{kinds.map((k) => <option key={String(k)} value={String(k)}>{oppKindLabel(tx, String(k))}</option>)}</select>
        <select aria-label={tx('Priority', 'Prioriteetti')} className={inputCls + ' w-auto'} value={prio} onChange={(e) => setPrio(e.target.value)}><option value="">{tx('Any priority', 'Mikä tahansa prioriteetti')}</option>{['high', 'medium', 'low'].map((p) => <option key={p} value={p}>{prioLabel(p)}</option>)}</select>
        <div className="flex-1" />
        <EditButton disabled={busy} onClick={async () => openJob(await run('opportunities', {}))}>{tx('Find opportunities', 'Etsi mahdollisuudet')}</EditButton>
      </div>
      {q.isPending ? <LoadingBlock rows={5} /> : q.isError ? <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} /> : rows.length === 0 ? (
        <EmptyState title={tx('No opportunities here', 'Ei mahdollisuuksia tässä')} body={tx('Opportunities come from your Google Search data and AI visibility gaps. Run “Find opportunities” to refresh.', 'Mahdollisuudet tulevat Google-hakudatasta ja tekoälynäkyvyyden aukoista. Päivitä ajamalla “Etsi mahdollisuudet”.')} />
      ) : (
        <ul className="grid gap-3">{rows.map((o) => (
          <li key={o.id} className="rounded-[12px] border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={tone[o.priority] ?? 'neutral'}>{prioLabel(o.priority)}</StatusBadge><span className="text-sm font-semibold text-ink">{oppKindLabel(tx, o.kind)}</span><span className="text-[12px] text-muted-ink">{statusLabel(o.status)}</span></div>
            <p className="mt-1 break-all text-sm text-ink">{o.url || o.query || o.question}</p>
            <p className="mt-1 text-[13px] text-muted-ink">{o.rationale}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setOpenId(o.id)}>{tx('Evidence', 'Näyttö')}</Button></div>
          </li>))}</ul>
      )}
      <Drawer open={!!sel} onClose={() => setOpenId(null)} title={sel ? oppKindLabel(tx, sel.kind) : ''}>
        {sel && <Evidence o={sel} onImprove={() => improve(sel)} statusLabel={statusLabel} onSaved={() => { s.refresh(); }} f={f} toast={toast} err={err} />}
      </Drawer>
    </div>
  );
}

function Evidence({ o, onImprove, statusLabel, onSaved, f, toast, err }: any) {
  const s = useStudio(); const tx = useTx(); const [, nav] = useLocation();
  const [st, setSt] = useState<string>(o.status); const [note, setNote] = useState<string>(o.note ?? ''); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await s.client.request('PATCH', `/opportunities/${encodeURIComponent(o.id)}`, { expectedVersion: o.version, status: st, note }); onSaved(); toast({ title: tx('Status updated', 'Tila päivitetty') }); }
    catch (e) { toast({ variant: 'destructive', title: tx('Could not update', 'Päivitys epäonnistui'), description: err(e) }); } finally { setBusy(false); }
  };
  const metrics = (m: any) => m && typeof m === 'object' ? <dl className="grid grid-cols-2 gap-x-3 text-sm">{Object.entries(m).filter(([, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-ink">{k}</dt><dd className="text-right">{typeof v === 'number' ? f.n(v, { maximumFractionDigits: 3 }) : String(v)}</dd></div>)}</dl> : null;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-ink">{o.rationale}</p>
      {o.url && <p><ExtLink href={o.url} /></p>}
      {o.query && <p><span className="font-semibold">{tx('Query', 'Haku')}: </span>{o.query}</p>}
      {o.question && <p><span className="font-semibold">{tx('Prompt', 'Kehote')}: </span>{o.question}</p>}
      {o.current && <div><p className="font-semibold">{tx('Current window', 'Nykyinen jakso')}</p>{metrics(o.current)}</div>}
      {o.previous && <div><p className="font-semibold">{tx('Previous window', 'Edellinen jakso')}</p>{metrics(o.previous)}</div>}
      {Array.isArray(o.pages) && <div><p className="font-semibold">{tx('Competing pages', 'Kilpailevat sivut')}</p><ul>{o.pages.map((p: any) => <li key={p.url} className="flex justify-between gap-2"><ExtLink href={p.url} /><span>{f.n(p.impressions)}</span></li>)}</ul></div>}
      {Array.isArray(o.evidenceIds) && o.evidenceIds.length > 0 && <div><p className="font-semibold">{tx('Monitoring evidence', 'Seurantanäyttö')} ({o.evidenceIds.length})</p>{s.role === 'owner' ? <ul className="mt-1 space-y-0.5">{o.evidenceIds.slice(0, 20).map((id: string) => <li key={id}><Link className="text-link hover:underline" href={s.ph(`/dashboard/evidence/${encodeURIComponent(id)}`)}>{id}</Link></li>)}</ul> : <p className="text-muted-ink">{tx('Evidence records are visible to the project owner.', 'Näyttötietueet näkee projektin omistaja.')}</p>}</div>}
      {Array.isArray(o.sourceUrls) && o.sourceUrls.length > 0 && <div><p className="font-semibold">{tx('Cited external sources', 'Viitatut ulkoiset lähteet')}</p><ul>{o.sourceUrls.map((u: string) => <li key={u}><ExtLink href={u} /></li>)}</ul><p className="mt-1 text-[12px] text-muted-ink">{tx('Guidance only: AI Rank does not contact these sites.', 'Vain ohje: AI Rank ei ota yhteyttä näihin sivustoihin.')}</p></div>}
      {o.dataCoverage && <p className="text-[12px] text-muted-ink">{tx('Google data coverage', 'Google-datan kattavuus')}: {Object.entries(o.dataCoverage).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</p>}
      <p className="text-[12px] text-muted-ink">{tx('Generated', 'Luotu')} {f.dt(o.generatedAt)}</p>
      <SourceChips ids={undefined} />
      <div className="flex flex-wrap gap-2">
        {o.url && <EditButton size="sm" onClick={onImprove}>{tx('Improve existing article', 'Paranna olemassa olevaa artikkelia')}</EditButton>}
        <EditButton size="sm" variant="secondary" onClick={() => nav(s.ph(`/dashboard/content/new?topic=${encodeURIComponent(o.query || o.question || '')}`))}>{tx('Create brief', 'Luo brief')}</EditButton>
      </div>
      <div className="border-t border-line pt-4">
        {!s.can.edit && <Banner>{tx('Your role cannot change opportunity status.', 'Roolisi ei voi muuttaa tilaa.')}</Banner>}
        <Field label={tx('Status', 'Tila')} id="op-st"><select id="op-st" disabled={!s.can.edit} className={inputCls} value={st} onChange={(e) => setSt(e.target.value)}>{STATUSES.map((x) => <option key={x} value={x}>{statusLabel(x)}</option>)}</select></Field>
        <div className="mt-3"><Field label={tx('Note', 'Muistiinpano')} id="op-note"><textarea id="op-note" disabled={!s.can.edit} rows={3} className={areaCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
        <div className="mt-3"><EditButton disabled={busy || (st === o.status && note === (o.note ?? ''))} onClick={save}>{tx('Save status', 'Tallenna tila')}</EditButton></div>
      </div>
    </div>
  );
}
void Card;
