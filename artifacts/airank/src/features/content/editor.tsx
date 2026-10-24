import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bold, Code, Heading2, Heading3, ImageIcon, Link2, List, Quote, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DisabledAction, ErrorState, LoadingBlock } from '@/components/airank/primitives';
import { useToast } from '@/hooks/use-toast';
import type { ContentDocument } from '@/lib/content-api';
import { jobsFor, useStudio } from './studio';
import { Banner, Card, DocBadge, ExtLink, Field, MarkdownPreview, Modal, areaCls, errCode, findRawHtml, inputCls, useErr, useFmt, useTx } from './ui';
import { RichEditor, richRoundTrip } from './rich';
import { Comments, ExportDialog, HistoryDrawer, JobDialog, ReviewDialog } from './editor-parts';
import { PaidButton, useRunJob } from './actions';
import { PublishDialog } from './publish';
import { Deterministic } from './results';

type Fields = { title: string; description: string; markdown: string; topic: string; expertise: string; locale: 'fi' | 'en' };
const pick = (d: ContentDocument): Fields => ({ title: d.title ?? '', description: d.description ?? '', markdown: d.markdown ?? '', topic: d.topic ?? '', expertise: d.expertise ?? '', locale: d.locale });
/** Unsaved buffers survive route changes inside the Studio (editor <-> audit/changes pages). */
const buffers = new Map<string, { doc: ContentDocument; f: Fields }>();
/** Namespaced by account and project so drafts can never leak across identities. */
export const bufferKey = (userId: string, projectId: string, docId: string) => `${userId}:${projectId}:${docId}`;
export const hasUnsavedBuffer = (userId: string, projectId: string, docId: string) => { const b = buffers.get(bufferKey(userId, projectId, docId)); return !!b && JSON.stringify(b.f) !== JSON.stringify(pick(b.doc)); };

export function EditorView({ id }: { id: string }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const f = useFmt(); const { toast } = useToast(); const qc = useQueryClient(); const [, nav] = useLocation();
  const q = useQuery({ queryKey: s.key('doc', id), queryFn: () => s.client.document(id), retry: false, refetchOnWindowFocus: false, staleTime: Infinity });
  const server = q.data;
  const bkey = bufferKey(s.userId, s.projectId, id);
  const [base, setBase] = useState<ContentDocument | null>(null);
  const [richState, setRichState] = useState<{ checked: boolean; lossy: null | 'html' | 'changed' }>({ checked: false, lossy: null });
  const [lossyEdit, setLossyEdit] = useState(false);
  const [fields, setFields] = useState<Fields | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'rich' | 'write' | 'preview' | 'split'>('write');
  const [panel, setPanel] = useState<'details' | 'checks' | 'comments'>('details');
  const [pending, setPending] = useState<null | ((d: ContentDocument) => void)>(null);
  const [jobDlg, setJobDlg] = useState<null | 'research' | 'rewrite' | 'create'>(null);
  const [reviewDlg, setReviewDlg] = useState<null | 'approved' | 'changes_requested' | 'in_review'>(null);
  const [histOpen, setHistOpen] = useState(false); const [exportOpen, setExportOpen] = useState(false); const [pubOpen, setPubOpen] = useState(false);
  const { run } = useRunJob();
  const initFor = useRef<string | null>(null); const ta = useRef<HTMLTextAreaElement>(null);

  // The edit base is frozen when editing starts (or restored with the buffer). It never follows refetches.
  useEffect(() => {
    if (!server || initFor.current === bkey) return;
    initFor.current = bkey;
    const b = buffers.get(bkey);
    if (b) { setBase(b.doc); setFields(b.f); } else { setBase(server); setFields(pick(server)); }
  }, [server, bkey]);
  useEffect(() => { if (fields && base && initFor.current === bkey) { if (JSON.stringify(fields) !== JSON.stringify(pick(base))) buffers.set(bkey, { doc: base, f: fields }); else buffers.delete(bkey); } }, [fields, base, bkey]);
  const dirty = !!(fields && base && JSON.stringify(fields) !== JSON.stringify(pick(base)));
  const newer = !!(server && base && server.version !== base.version);
  // A clean buffer has nothing to lose, so it follows the server. A dirty one waits for acknowledgement.
  useEffect(() => { if (server && base && !dirty && !saving && server.version !== base.version) { setBase(server); setFields(pick(server)); } }, [server, base, dirty, saving]);
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  const set = (k: keyof Fields, v: string) => setFields((x) => (x ? { ...x, [k]: v } as Fields : x));
  const save = async (): Promise<ContentDocument | null> => {
    if (!base || !fields) return null;
    setSaving(true);
    try {
      const changes: Partial<ContentDocument> = {}; const orig = pick(base);
      (Object.keys(fields) as (keyof Fields)[]).forEach((k) => { if (fields[k] !== orig[k]) (changes as any)[k] = fields[k]; });
      const next = await s.client.save(id, base.version, changes);
      qc.setQueryData(s.key('doc', id), next); buffers.delete(bkey); setBase(next); setFields(pick(next)); setConflict(false); s.refresh();
      toast({ title: tx('Saved', 'Tallennettu'), description: `v${next.version}` });
      return next;
    } catch (e) {
      if (errCode(e) === 'VERSION_CONFLICT') setConflict(true);
      toast({ variant: 'destructive', title: tx('Save failed', 'Tallennus epäonnistui'), description: err(e) });
      return null;
    } finally { setSaving(false); }
  };
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void saveRef.current(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
  /** Save-before-job: never submit against a stale or unsaved revision. */
  const withSaved = (fn: (d: ContentDocument) => void) => { if (!base) return; if (dirty) setPending(() => fn); else fn(base); };
  const reload = async () => {
    try { const d = await s.client.document(id); qc.setQueryData(s.key('doc', id), d); buffers.delete(bkey); setBase(d); setFields(pick(d)); setConflict(false); }
    catch (e) { toast({ variant: 'destructive', title: tx('Reload failed', 'Lataus epäonnistui'), description: err(e) }); }
  };
  const copyMine = async () => { try { await navigator.clipboard.writeText(JSON.stringify(fields, null, 2)); toast({ title: tx('Copied your changes', 'Muutoksesi kopioitu') }); } catch { toast({ variant: 'destructive', title: tx('Clipboard unavailable', 'Leikepöytä ei käytettävissä') }); } };

  const wrap = (before: string, after = before, ph = '') => {
    const el = ta.current; if (!el || !fields) return;
    const a = el.selectionStart, b = el.selectionEnd; const sel = fields.markdown.slice(a, b) || ph;
    set('markdown', fields.markdown.slice(0, a) + before + sel + after + fields.markdown.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length); });
  };
  const linePrefix = (p: string) => {
    const el = ta.current; if (!el || !fields) return; const a = el.selectionStart; const start = fields.markdown.lastIndexOf('\n', a - 1) + 1;
    set('markdown', fields.markdown.slice(0, start) + p + fields.markdown.slice(start)); requestAnimationFrame(() => el.focus());
  };
  const insertTable = () => { const c = tx('Column', 'Sarake'); wrap(`\n\n| ${c} 1 | ${c} 2 |\n| --- | --- |\n| `, ` |  |\n\n`, tx('Value', 'Arvo')); };

  const raw = useMemo(() => (fields ? findRawHtml(fields.markdown) : []), [fields]);
  const chooseMode = (m: 'rich' | 'write' | 'preview' | 'split') => {
    if (m !== 'rich' || !fields) { setMode(m); return; }
    const r = richRoundTrip(fields.markdown);
    if (r.ok) { setRichState({ checked: true, lossy: null }); setMode('rich'); } else setRichState({ checked: true, lossy: r.reason });
  };
  const readOnly = !s.can.edit;
  if (q.isPending || (server && (!base || !fields))) return <LoadingBlock rows={6} />;
  if (q.isError || !base || !fields) return <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} />;

  const tools: [string, React.JSX.Element, () => void][] = [
    [tx('Heading 2', 'Otsikko 2'), <Heading2 key="h2" />, () => linePrefix('## ')], [tx('Heading 3', 'Otsikko 3'), <Heading3 key="h3" />, () => linePrefix('### ')],
    [tx('Bold', 'Lihavointi'), <Bold key="b" />, () => wrap('**')], [tx('Code', 'Koodi'), <Code key="c" />, () => wrap('`')],
    [tx('Link', 'Linkki'), <Link2 key="l" />, () => wrap('[', '](https://)', tx('link text', 'linkin teksti'))], [tx('Image', 'Kuva'), <ImageIcon key="i" />, () => wrap('![', '](https://)', tx('description', 'kuvaus'))],
    [tx('List', 'Lista'), <List key="li" />, () => linePrefix('- ')], [tx('Quote', 'Lainaus'), <Quote key="q" />, () => linePrefix('> ')], [tx('Table', 'Taulukko'), <Table2 key="t" />, insertTable],
  ];
  const lastAudit = jobsFor(s.jobs, 'audit', id).find((j) => j.status === 'completed');
  const goto = (p: string) => nav(s.ph(`/dashboard/content/documents/${id}${p}`));
  const reviewBlocked = dirty ? tx('Save your changes before changing review status.', 'Tallenna muutokset ennen tarkistustilan muuttamista.') : '';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-ink">
        <Link href={s.ph('/dashboard/content/library')} className="text-link hover:underline">{tx('Content library', 'Sisältökirjasto')}</Link><span aria-hidden>/</span><span className="truncate">{base.title || tx('Untitled', 'Nimetön')}</span>
        <DocBadge status={base.status} /><span>v{base.version} · {f.dt(base.updatedAt)}</span>{dirty && <span className="font-semibold text-warning">{tx('Unsaved changes', 'Tallentamattomia muutoksia')}</span>}
      </div>
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2 lg:top-16">
        <Button disabled={readOnly || !dirty || saving} onClick={() => void save()} data-testid="button-save-draft">{saving ? tx('Saving…', 'Tallennetaan…') : tx('Save draft', 'Tallenna luonnos')}</Button>
        <PaidButton variant="secondary" disabled={false} onClick={() => withSaved((d) => runJob('audit', d))}>{tx('Audit', 'Auditoi')}</PaidButton>
        <PaidButton variant="secondary" onClick={() => setJobDlg('research')}>{tx('Research & brief', 'Tutkimus ja brief')}</PaidButton>
        <PaidButton variant="secondary" onClick={() => setJobDlg('rewrite')}>{tx('Suggest changes', 'Ehdota muutoksia')}</PaidButton>
        <PaidButton variant="secondary" onClick={() => setJobDlg('create')}>{tx('Generate full draft', 'Luo koko luonnos')}</PaidButton>
        <div className="flex-1" />
        {base.status === 'in_review' && s.can.review ? (
          <><Button variant="secondary" disabled={!!reviewBlocked} onClick={() => setReviewDlg('changes_requested')}>{tx('Request changes', 'Pyydä muutoksia')}</Button><Button disabled={!!reviewBlocked} onClick={() => setReviewDlg('approved')}>{tx('Approve', 'Hyväksy')}</Button></>
        ) : s.can.review ? (
          <Button variant="secondary" disabled={!!reviewBlocked || base.status === 'approved'} onClick={() => setReviewDlg('in_review')}>{tx('Send for review', 'Lähetä tarkistettavaksi')}</Button>
        ) : (
          <DisabledAction variant="secondary" reason={tx('Currently only project owners and reviewers can send a document for review. Editors cannot yet; ask an owner.', 'Tällä hetkellä vain projektin omistajat ja tarkastajat voivat lähettää asiakirjan tarkistettavaksi. Muokkaajat eivät vielä voi; pyydä omistajaa.')}>{tx('Send for review', 'Lähetä tarkistettavaksi')}</DisabledAction>
        )}
        <Button variant="secondary" onClick={() => setHistOpen(true)}>{tx('Version history', 'Versiohistoria')}</Button>
        <Button variant="secondary" onClick={() => setExportOpen(true)}>{tx('Export', 'Vie')}</Button>
        {s.can.review && base.status === 'approved' && !dirty ? <Button onClick={() => setPubOpen(true)}>{tx('Publish', 'Julkaise')}</Button>
          : <DisabledAction reason={!s.can.review ? tx('Only owners and reviewers can publish.', 'Vain omistajat ja tarkastajat voivat julkaista.') : tx('Only the saved, approved revision can be published.', 'Vain tallennettu, hyväksytty versio voidaan julkaista.')}>{tx('Publish', 'Julkaise')}</DisabledAction>}
      </div>
      {readOnly && <Banner>{tx('Read-only: your role cannot edit this document.', 'Vain luku: roolisi ei voi muokata tätä asiakirjaa.')}</Banner>}
      {!s.modelOk && s.can.edit && <Banner tone="warning">{tx('AI jobs are unavailable (no model configured). You can still edit and save.', 'Tekoälytyöt eivät ole käytettävissä (mallia ei ole määritetty). Voit silti muokata ja tallentaa.')}</Banner>}
      {(conflict || (newer && dirty)) && <Banner tone="error" action={<div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setReloadConfirm(true)}>{tx('Reload latest', 'Lataa uusin')}</Button><Button size="sm" variant="secondary" onClick={copyMine}>{tx('Copy my changes', 'Kopioi muutokseni')}</Button><Button size="sm" variant="ghost" onClick={() => setConflict(false)} disabled={newer && dirty}>{tx('Keep editing', 'Jatka muokkausta')}</Button></div>}>
        <p className="font-semibold">{newer && server ? tx(`A newer version (v${server.version}) exists; your edits are based on v${base.version}`, `Uudempi versio (v${server.version}) on olemassa; muokkauksesi perustuvat versioon v${base.version}`) : tx('A newer version exists', 'Uudempi versio on olemassa')}</p><p>{tx('Your unsaved edits are still here. Nothing was overwritten. Copy them before reloading.', 'Tallentamattomat muokkauksesi ovat tallessa. Mitään ei ylikirjoitettu. Kopioi ne ennen latausta.')}</p></Banner>}
      {base.status !== 'draft' && dirty && <Banner tone="warning">{tx('Saving edits returns this document to Draft and clears approval.', 'Muokkausten tallennus palauttaa asiakirjan luonnokseksi ja poistaa hyväksynnän.')}</Banner>}
      {raw.length > 0 && <Banner tone="warning"><p className="font-semibold">{tx(`${raw.length} raw HTML fragment(s) found`, `${raw.length} raakaa HTML-osaa löytyi`)}</p><p>{tx('Raw HTML embeds are not supported. They are kept in the source but stripped from the preview and export. Replace them with Markdown.', 'Raakaa HTML:ää ei tueta. Ne säilyvät lähteessä mutta poistetaan esikatselusta ja viennistä. Korvaa ne Markdownilla.')} <code className="break-all">{raw.slice(0, 3).join(' ')}</code></p></Banner>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Field label={tx('Title', 'Otsikko')} id="ed-title"><input id="ed-title" className={inputCls + ' text-[18px] font-semibold'} maxLength={300} readOnly={readOnly} value={fields.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <div className="rounded-[12px] border border-line bg-white">
            <div className="flex flex-wrap items-center gap-1 border-b border-line p-1.5">
              {tools.map(([l, ic, fn]) => <Button key={l} type="button" size="icon" variant="ghost" aria-label={l} title={l} disabled={readOnly || mode === 'preview' || mode === 'rich'} onClick={fn} className="size-9 [&_svg]:size-4">{ic}</Button>)}
              <div className="flex-1" />
              <div role="group" aria-label={tx('View', 'Näkymä')} className="flex gap-0.5 rounded-lg bg-canvas p-0.5 text-[13px]">{([['rich', tx('Rich text', 'Rikas teksti')], ['write', tx('Source', 'Lähde')], ['split', tx('Split', 'Jaettu')], ['preview', tx('Preview', 'Esikatselu')]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => chooseMode(k)} className={'h-8 rounded-md px-2.5 font-medium ' + (mode === k ? 'bg-white text-navy shadow-sm' : 'text-muted-ink') + (k === 'split' ? ' hidden lg:block' : '')}>{l}</button>)}</div>
            </div>
            {richState.lossy && <div className="p-2"><Banner tone="warning" action={richState.lossy === 'changed' ? <Button size="sm" variant="secondary" onClick={() => { setRichState({ checked: true, lossy: null }); setMode('rich'); }}>{tx('Use rich text anyway', 'Käytä rikasta tekstiä silti')}</Button> : undefined}>{richState.lossy === 'html' ? tx('Rich text is unavailable: the Markdown contains raw HTML or embeds that cannot be represented. Nothing was removed; edit it in Source mode.', 'Rikas teksti ei ole käytettävissä: Markdown sisältää raakaa HTML:ää tai upotuksia, joita ei voi esittää. Mitään ei poistettu; muokkaa lähdetilassa.') : tx('Rich text would normalise some formatting in this Markdown. The content is kept only if you choose to continue; Source mode never changes it.', 'Rikas teksti normalisoisi osan tämän Markdownin muotoilusta. Sisältö muuttuu vain jos jatkat; lähdetila ei koskaan muuta sitä.')}</Banner></div>}
            {lossyEdit && <div className="p-2"><Banner tone="warning" action={<Button size="sm" variant="ghost" onClick={() => setLossyEdit(false)}>{tx('Dismiss', 'Sulje')}</Button>}>{tx('That edit cannot be represented in Markdown without raw HTML, so it was undone. Use Source mode.', 'Tätä muokkausta ei voi esittää Markdownina ilman raakaa HTML:ää, joten se kumottiin. Käytä lähdetilaa.')}</Banner></div>}
            {mode === 'rich' && <RichEditor value={fields.markdown} readOnly={readOnly} label={tx('Rich text editor', 'Rikkaan tekstin editori')} onChange={(md) => set('markdown', md)} onLossy={() => setLossyEdit(true)} />}
            <div className={mode === 'split' ? 'grid min-h-[480px] lg:grid-cols-2 lg:divide-x lg:divide-line' : ''}>
              {(mode === 'write' || mode === 'split') && <textarea ref={ta} aria-label={tx('Markdown source', 'Markdown-lähde')} spellCheck lang={fields.locale} readOnly={readOnly} value={fields.markdown} onChange={(e) => set('markdown', e.target.value)} className="block min-h-[480px] w-full resize-y rounded-b-[12px] bg-white p-4 font-mono text-[14px] leading-6 text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-cyan" />}
              {(mode === 'preview' || mode === 'split') && <div className="min-h-[480px] overflow-auto p-4" aria-label={tx('Preview', 'Esikatselu')}>{fields.markdown.trim() ? <MarkdownPreview markdown={fields.markdown} /> : <p className="text-sm text-muted-ink">{tx('Nothing to preview yet.', 'Ei vielä esikatseltavaa.')}</p>}</div>}
            </div>
            <p className="border-t border-line px-3 py-2 text-[12px] text-muted-ink">{tx('Markdown is stored exactly as written. Headings, paragraphs, links, images, lists and tables are supported; raw HTML is not.', 'Markdown tallennetaan täsmälleen kirjoitettuna. Otsikot, kappaleet, linkit, kuvat, listat ja taulukot tuetaan; raakaa HTML:ää ei.')} · {fields.markdown.split(/\s+/).filter(Boolean).length} {tx('words', 'sanaa')}</p>
          </div>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <div role="tablist" className="flex gap-1 rounded-lg bg-canvas p-1">{([['details', tx('Details', 'Tiedot')], ['checks', tx('Checks', 'Tarkistukset')], ['comments', tx('Comments', 'Kommentit')]] as const).map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={panel === k} onClick={() => setPanel(k)} className={'h-10 flex-1 rounded-md text-sm font-medium ' + (panel === k ? 'bg-white text-navy shadow-sm' : 'text-muted-ink')}>{l}</button>)}</div>
          {panel === 'details' && (
            <Card><div className="flex flex-col gap-3">
              <Field label={tx('Search description', 'Hakukuvaus')} hint={`${fields.description.length}/1000`} id="ed-desc"><textarea id="ed-desc" rows={3} maxLength={1000} readOnly={readOnly} className={areaCls} value={fields.description} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label={tx('Topic', 'Aihe')} id="ed-topic"><input id="ed-topic" className={inputCls} readOnly={readOnly} value={fields.topic} onChange={(e) => set('topic', e.target.value)} /></Field>
              <Field label={tx('Language', 'Kieli')} id="ed-lang"><select id="ed-lang" disabled={readOnly} className={inputCls} value={fields.locale} onChange={(e) => set('locale', e.target.value)}><option value="fi">Suomi</option><option value="en">English</option></select></Field>
              <Field label={tx('Expert input and facts', 'Asiantuntijan syöte ja faktat')} hint={tx('Used by research and draft jobs.', 'Tutkimus- ja luonnostyöt käyttävät tätä.')} id="ed-exp"><textarea id="ed-exp" rows={5} readOnly={readOnly} className={areaCls} value={fields.expertise} onChange={(e) => set('expertise', e.target.value)} /></Field>
              {base.sourceUrl && <p className="text-[13px]"><span className="font-semibold">{tx('Source page', 'Lähdesivu')}: </span><ExtLink href={base.sourceUrl} /></p>}
            </div></Card>
          )}
          {panel === 'checks' && (
            <div className="flex flex-col gap-3">
              {(lastAudit?.result?.deterministic ?? base.audit) ? <Deterministic data={lastAudit?.result?.deterministic ?? base.audit} /> : <Card><p className="text-sm text-muted-ink">{tx('No audit yet. Run Audit to see checks.', 'Auditointia ei ole vielä. Aja Audit nähdäksesi tarkistukset.')}</p></Card>}
              <div className="flex flex-wrap gap-2 text-sm">{(['/audit', '/brief', '/changes', '/draft'] as const).map((p, i) => <Button key={p} variant="secondary" size="sm" onClick={() => goto(p)}>{[tx('Audit results', 'Auditointitulokset'), tx('Brief', 'Brief'), tx('Suggested changes', 'Muutosehdotukset'), tx('Full draft', 'Koko luonnos')][i]}</Button>)}</div>
            </div>
          )}
          {panel === 'comments' && <Comments doc={base} />}
        </aside>
      </div>

      <Modal open={!!pending} onClose={() => setPending(null)} title={tx('Save changes first?', 'Tallennetaanko muutokset ensin?')} description={tx('Jobs run on a saved revision. Your unsaved edits will be saved as a new version, then the job starts.', 'Työt ajetaan tallennetulla versiolla. Tallentamattomat muokkauksesi tallennetaan uutena versiona ja sitten työ käynnistyy.')}
        footer={<><Button variant="ghost" onClick={() => setPending(null)}>{tx('Cancel', 'Peruuta')}</Button><Button disabled={saving} onClick={async () => { const fn = pending; const d = await save(); if (d && fn) { setPending(null); fn(d); } }}>{tx('Save and continue', 'Tallenna ja jatka')}</Button></>}><span /></Modal>
      <JobDialog kind={jobDlg} onClose={() => setJobDlg(null)} fields={fields} onGo={(kind, extra) => { setJobDlg(null); withSaved((d) => runJob(kind, d, extra)); }} />
      <ReviewDialog mode={reviewDlg} onClose={() => setReviewDlg(null)} doc={base} onDone={(d) => { qc.setQueryData(s.key('doc', id), d); setBase(d); setFields(pick(d)); s.refresh(); }} />
      <HistoryDrawer open={histOpen} onClose={() => setHistOpen(false)} doc={base} dirty={dirty} onRestored={(d) => { qc.setQueryData(s.key('doc', id), d); buffers.delete(bkey); setBase(d); setFields(pick(d)); s.refresh(); setHistOpen(false); }} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} doc={base} dirty={dirty} />
      <PublishDialog open={pubOpen} onClose={() => setPubOpen(false)} doc={base} />
      <Modal open={reloadConfirm} onClose={() => setReloadConfirm(false)} title={tx('Replace unsaved changes?', 'Korvataanko tallentamattomat muutokset?')}
        description={tx('Loading the latest saved revision replaces your local text and metadata. Copy your changes first if you want to keep them.', 'Uusimman tallennetun version lataaminen korvaa paikallisen tekstisi ja metatiedot. Kopioi muutoksesi ensin, jos haluat säilyttää ne.')}
        footer={<><Button variant="secondary" onClick={copyMine}>{tx('Copy my changes', 'Kopioi muutokseni')}</Button><Button variant="ghost" onClick={() => setReloadConfirm(false)}>{tx('Cancel', 'Peruuta')}</Button><Button onClick={async () => { await reload(); setReloadConfirm(false); }}>{tx('Replace with latest', 'Korvaa uusimmalla')}</Button></>}><p className="text-sm text-muted-ink">{tx('No server history will be deleted.', 'Palvelimen versiohistoriaa ei poisteta.')}</p></Modal>
    </div>
  );
  function runJob(kind: 'audit' | 'research' | 'rewrite' | 'create', d: ContentDocument, extra: Record<string, unknown> = {}) {
    void run(kind, { documentId: d.id, documentVersion: d.version, locale: d.locale, ...extra }).then((j) => { if (j) goto({ audit: '/audit', research: '/brief', rewrite: '/changes', create: '/draft' }[kind]); });
  }
}
