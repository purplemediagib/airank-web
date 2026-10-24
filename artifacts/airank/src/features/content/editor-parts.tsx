import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/airank/primitives';
import { useToast } from '@/hooks/use-toast';
import type { ContentDocument } from '@/lib/content-api';
import { useStudio } from './studio';
import { Banner, Card, Field, MarkdownPreview, Modal, areaCls, inputCls, sanitizeHtml, useErr, useFmt, useTx } from './ui';
import { EditButton } from './actions';

export function JobDialog({ kind, onClose, fields, onGo }: { kind: null | 'research' | 'rewrite' | 'create'; onClose: () => void; fields: { topic: string; expertise: string }; onGo: (k: 'research' | 'rewrite' | 'create', extra: Record<string, unknown>) => void }) {
  const tx = useTx();
  const [instr, setInstr] = useState(''); const [urls, setUrls] = useState('');
  if (!kind) return null;
  const title = { research: tx('Research and brief', 'Tutkimus ja brief'), rewrite: tx('Suggest changes', 'Ehdota muutoksia'), create: tx('Generate full draft', 'Luo koko luonnos') }[kind];
  const go = () => onGo(kind, { instructions: instr, topic: fields.topic, expertise: fields.expertise, ...(urls.trim() ? { sourceUrls: urls.split(/\s+/).filter(Boolean) } : {}) });
  return (
    <Modal open onClose={onClose} title={title} description={kind === 'rewrite' ? tx('You will choose which passages to apply. Nothing changes automatically.', 'Valitset itse mitkä kohdat toteutetaan. Mikään ei muutu automaattisesti.') : kind === 'create' ? tx('The result is a proposal you can compare before applying as a new revision.', 'Tulos on ehdotus, jota voit vertailla ennen uutena versiona toteuttamista.') : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>{tx('Cancel', 'Peruuta')}</Button><Button onClick={go}>{tx('Start job', 'Käynnistä työ')}</Button></>}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-muted-ink">{tx('Topic and expert input from the Details panel are included.', 'Tietopaneelin aihe ja asiantuntijasyöte otetaan mukaan.')}</p>
        <Field label={tx('Instructions (optional)', 'Ohjeet (valinnainen)')} id="jd-ins"><textarea id="jd-ins" rows={3} className={areaCls} value={instr} onChange={(e) => setInstr(e.target.value)} /></Field>
        <Field label={tx('Extra source URLs (https, one per line, max 12)', 'Lisälähteet (https, yksi per rivi, enintään 12)')} id="jd-urls"><textarea id="jd-urls" rows={3} className={areaCls + ' font-mono'} value={urls} onChange={(e) => setUrls(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function ReviewDialog({ mode, onClose, doc, onDone }: { mode: null | 'approved' | 'changes_requested' | 'in_review'; onClose: () => void; doc: ContentDocument; onDone: (d: ContentDocument) => void }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast();
  const [facts, setFacts] = useState(false); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [e, setE] = useState('');
  if (!mode) return null;
  const title = { approved: tx('Approve revision', 'Hyväksy versio'), changes_requested: tx('Request changes', 'Pyydä muutoksia'), in_review: tx('Send for review', 'Lähetä tarkistettavaksi') }[mode];
  const go = async () => {
    setBusy(true); setE('');
    try { const d = await s.client.review(doc.id, doc.version, mode, mode === 'approved' && facts, note); onDone(d); toast({ title }); setNote(''); setFacts(false); onClose(); }
    catch (x) { setE(err(x)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={title} description={`${doc.title} · v${doc.version}`} footer={<><Button variant="ghost" onClick={onClose}>{tx('Cancel', 'Peruuta')}</Button><Button disabled={busy || (mode === 'approved' && !facts)} onClick={go}>{title}</Button></>}>
      <div className="flex flex-col gap-4">
        {e && <Banner tone="error">{e}</Banner>}
        {mode === 'approved' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={facts} onChange={(x) => setFacts(x.target.checked)} /><span>{tx('I have checked the facts and claims in this exact revision against reliable sources.', 'Olen tarkistanut tämän version faktat ja väitteet luotettavista lähteistä.')}</span></label>}
        <Field label={tx('Note (optional)', 'Muistiinpano (valinnainen)')} id="rv-note"><textarea id="rv-note" rows={3} className={areaCls} value={note} onChange={(x) => setNote(x.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function useActor() {
  const s = useStudio(); const tx = useTx();
  return (a?: string | null) => (!a ? '—' : a === s.userId ? tx('You', 'Sinä') : `${tx('User', 'Käyttäjä')} ${String(a).slice(0, 6)}`);
}

export function HistoryDrawer({ open, onClose, doc, dirty, onRestored }: { open: boolean; onClose: () => void; doc: ContentDocument; dirty: boolean; onRestored: (d: ContentDocument) => void }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const f = useFmt(); const { toast } = useToast();
  const q = useQuery({ queryKey: s.key('revisions', doc.id, doc.version), queryFn: () => s.client.request<any[]>('GET', `/documents/${encodeURIComponent(doc.id)}/revisions`), enabled: open, retry: false });
  const [sel, setSel] = useState<number | null>(null); const [busy, setBusy] = useState(false); const actor = useActor();
  const rev = q.data?.find((r) => r.version === sel);
  const restore = async () => {
    setBusy(true);
    try { const d = await s.client.request<ContentDocument>('POST', `/documents/${encodeURIComponent(doc.id)}/restore`, { expectedVersion: doc.version, revision: sel }); onRestored(d); toast({ title: tx('Restored as a new draft revision', 'Palautettu uutena luonnosversiona') }); }
    catch (e) { toast({ variant: 'destructive', title: tx('Restore failed', 'Palautus epäonnistui'), description: err(e) }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} wide title={tx('Version history', 'Versiohistoria')} description={tx('Restoring creates a new draft revision; older versions stay in the history.', 'Palautus luo uuden luonnosversion; vanhat versiot säilyvät historiassa.')}>
      {q.isPending ? <LoadingBlock rows={4} /> : q.isError ? <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} /> : (q.data ?? []).length === 0 ? <EmptyState compact title={tx('No revisions', 'Ei versioita')} /> : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <ul className="max-h-[420px] divide-y divide-line overflow-auto rounded-lg border border-line">{q.data!.map((r) => <li key={r.version}><button type="button" aria-pressed={sel === r.version} onClick={() => setSel(r.version)} className={'w-full px-3 py-2 text-left text-sm hover:bg-canvas ' + (sel === r.version ? 'bg-tint' : '')}><span className="font-semibold">v{r.version}{r.version === doc.version ? ` · ${tx('current', 'nykyinen')}` : ''}</span><span className="block text-[12px] text-muted-ink">{f.dt(r.created_at)}</span><span className="block truncate text-[12px] text-muted-ink">{actor(r.actor)}</span></button></li>)}</ul>
          <div className="min-w-0">{rev ? <>
            <p className="text-[15px] font-semibold">{rev.payload.title}</p>
            <div className="mt-2 max-h-[320px] overflow-auto rounded-lg border border-line p-3"><MarkdownPreview markdown={String(rev.payload.markdown ?? '')} /></div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <EditButton disabled={busy || dirty || rev.version === doc.version} onClick={restore}>{tx('Restore this version', 'Palauta tämä versio')}</EditButton>
              {dirty && <span className="text-[12px] text-warning">{tx('Save or copy your unsaved edits first.', 'Tallenna tai kopioi tallentamattomat muokkaukset ensin.')}</span>}
            </div></> : <p className="text-sm text-muted-ink">{tx('Select a version to preview.', 'Valitse esikatseltava versio.')}</p>}</div>
        </div>
      )}
    </Modal>
  );
}

export function ExportDialog({ open, onClose, doc, dirty }: { open: boolean; onClose: () => void; doc: ContentDocument; dirty: boolean }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast();
  const q = useQuery({ queryKey: s.key('export', doc.id, doc.version), queryFn: () => s.client.export(doc.id), enabled: open, retry: false });
  const [tab, setTab] = useState<'markdown' | 'html' | 'plain' | 'schema'>('markdown');
  const d = q.data;
  const text = !d ? '' : tab === 'markdown' ? d.markdown : tab === 'html' ? sanitizeHtml(d.html) : tab === 'plain' ? d.plainText : JSON.stringify(d.structuredDataSuggestion, null, 2);
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast({ title: tx('Copied', 'Kopioitu') }); } catch { toast({ variant: 'destructive', title: tx('Clipboard unavailable', 'Leikepöytä ei käytettävissä') }); } };
  const download = () => { const ext = { markdown: 'md', html: 'html', plain: 'txt', schema: 'json' }[tab]; const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); a.href = url; a.download = `${(doc.title || 'document').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60)}.${ext}`; a.click(); URL.revokeObjectURL(url); };
  return (
    <Modal open={open} onClose={onClose} wide title={tx('Export', 'Vie')} description={tx('Exports the last saved revision.', 'Vie viimeksi tallennetun version.')} footer={<><Button variant="secondary" disabled={!d} onClick={copy}>{tx('Copy', 'Kopioi')}</Button><Button disabled={!d} onClick={download}>{tx('Download', 'Lataa')}</Button></>}>
      {dirty && <div className="mb-3"><Banner tone="warning">{tx('You have unsaved edits that are not part of this export.', 'Tallentamattomat muokkauksesi eivät sisälly vientiin.')}</Banner></div>}
      <div role="tablist" className="mb-3 flex flex-wrap gap-1 rounded-lg bg-canvas p-1">{([['markdown', 'Markdown'], ['html', 'HTML'], ['plain', tx('Plain text', 'Pelkkä teksti')], ['schema', tx('Structured data', 'Rakenteinen data')]] as const).map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={'h-9 flex-1 rounded-md px-2 text-sm font-medium ' + (tab === k ? 'bg-white text-navy shadow-sm' : 'text-muted-ink')}>{l}</button>)}</div>
      {q.isPending ? <LoadingBlock rows={4} /> : q.isError ? <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} /> : <>
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-3 text-[13px]">{text}</pre>
        {tab === 'html' && <p className="mt-2 text-[12px] text-muted-ink">{tx('HTML is sanitized in the browser before display, copy and download.', 'HTML puhdistetaan selaimessa ennen näyttöä, kopiointia ja latausta.')}</p>}
        {tab === 'schema' && d && <p className="mt-2 text-[12px] text-muted-ink">{d.note}</p>}
      </>}
    </Modal>
  );
}

export function Comments({ doc }: { doc: ContentDocument }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const f = useFmt(); const { toast } = useToast();
  const q = useQuery({ queryKey: s.key('comments', doc.id), queryFn: () => s.client.request<any[]>('GET', `/comments?documentId=${encodeURIComponent(doc.id)}`), retry: false });
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const actor = useActor();
  const canPost = s.role !== 'viewer' && (s.can.edit || s.can.review);
  const post = async () => {
    setBusy(true);
    try { await s.client.request('POST', '/comments', { documentId: doc.id, documentVersion: doc.version, text: text.trim() }); setText(''); await q.refetch(); }
    catch (e) { toast({ variant: 'destructive', title: tx('Comment failed', 'Kommentti epäonnistui'), description: err(e) }); } finally { setBusy(false); }
  };
  const resolve = async (c: any, resolved: boolean) => {
    try { await s.client.request('PATCH', `/comments/${encodeURIComponent(c.id)}`, { expectedVersion: c.version, resolved }); await q.refetch(); }
    catch (e) { toast({ variant: 'destructive', title: tx('Update failed', 'Päivitys epäonnistui'), description: err(e) }); }
  };
  return (
    <Card>
      {q.isPending ? <LoadingBlock rows={2} /> : q.isError ? <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} /> : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-ink">{tx('No comments yet.', 'Ei vielä kommentteja.')}</p> : (
        <ul className="divide-y divide-line">{q.data!.map((c) => <li key={c.id} className="py-2 text-sm"><p className={c.resolved ? 'text-muted-ink line-through' : 'text-ink'}>{c.body}</p><p className="mt-0.5 text-[12px] text-muted-ink">{actor(c.actor)} · v{c.documentVersion}{c.documentVersion !== doc.version ? ` (${tx('older revision', 'vanhempi versio')})` : ''} · {f.dt(c.updatedAt)}</p>{s.can.review && <Button variant="link" className="h-auto p-0 text-[12px]" onClick={() => resolve(c, !c.resolved)}>{c.resolved ? tx('Reopen', 'Avaa uudelleen') : tx('Resolve', 'Ratkaise')}</Button>}</li>)}</ul>
      )}
      {canPost ? <div className="mt-3 flex flex-col gap-2"><label htmlFor="cm-text" className="sr-only">{tx('New comment', 'Uusi kommentti')}</label><textarea id="cm-text" rows={3} className={areaCls} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={tx('Add a comment on this revision', 'Lisää kommentti tähän versioon')} /><Button size="sm" disabled={busy || !text.trim()} onClick={post}>{tx('Add comment', 'Lisää kommentti')}</Button></div> : <p className="mt-3 text-[12px] text-muted-ink">{tx('Your role cannot comment.', 'Roolisi ei voi kommentoida.')}</p>}
    </Card>
  );
}
void inputCls;
