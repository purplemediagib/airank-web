import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { LoadingBlock } from '@/components/airank/primitives';
import { useToast } from '@/hooks/use-toast';
import type { ContentDocument, ContentJob } from '@/lib/content-api';
import { useStudio } from './studio';
import { Banner, Field, Modal, areaCls, inputCls, useErr, useFmt, useTx } from './ui';

export function PublishDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: ContentDocument }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const f = useFmt(); const { toast } = useToast(); const [, nav] = useLocation();
  const [tab, setTab] = useState<'manual' | 'cms'>('manual');
  const [url, setUrl] = useState(doc.sourceUrl ?? ''); const [busy, setBusy] = useState(false); const [e, setE] = useState('');
  const [target, setTarget] = useState<'draft' | 'publish'>('draft'); const [slug, setSlug] = useState(''); const [wpType, setWpType] = useState<'posts' | 'pages'>('posts');
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [term, setTerm] = useState('');
  const [remote, setRemote] = useState<any>(null); const [confirm, setConfirm] = useState(false); const [locId, setLocId] = useState('');
  const cms = useQuery({ queryKey: s.key('cms-summary'), queryFn: () => s.client.request<any>('GET', '/cms'), enabled: open && tab === 'cms' && s.can.manage, retry: false });
  const items = useQuery({ queryKey: s.key('cms-items', page, term, wpType), queryFn: () => s.client.request<any>('GET', `/cms/items?page=${page}&search=${encodeURIComponent(term)}&type=${wpType}`), enabled: open && tab === 'cms', retry: false });
  const type = items.data?.type ?? cms.data?.type;
  const manual = async () => {
    setBusy(true); setE('');
    try { await s.client.request('POST', `/documents/${encodeURIComponent(doc.id)}/published`, { expectedVersion: doc.version, url: url.trim() }); s.refresh(); toast({ title: tx('Publication recorded', 'Julkaisu kirjattu') }); onClose(); nav(s.ph('/dashboard/content/impact')); }
    catch (x) { setE(err(x)); } finally { setBusy(false); }
  };
  const cmsPublish = async () => {
    setBusy(true); setE('');
    try {
      const input: Record<string, unknown> = { documentId: doc.id, documentVersion: doc.version, locale: doc.locale, targetStatus: target, ...(slug ? { slug } : {}) };
      if (type === 'wordpress') input.wpType = wpType;
      if (remote) { input.remoteId = remote.id; input.expectedRemoteModified = remote.modified; }
      if (type === 'webflow') input.cmsLocaleId = locId || remote?.locale || '';
      if (url.trim()) input.publishedUrl = url.trim();
      const job = await s.submitter.submit('publish', input); s.refresh(); onClose(); nav(s.ph(`/dashboard/content/jobs/${job.id}`));
    } catch (x) { setE(err(x)); } finally { setBusy(false); setConfirm(false); }
  };
  return (
    <Modal open={open} onClose={onClose} wide title={tx('Publish', 'Julkaise')} description={`${doc.title} · v${doc.version} · ${tx('approved revision', 'hyväksytty versio')}`}>
      <div className="flex flex-col gap-4">
        <div role="tablist" className="flex gap-1 rounded-lg bg-canvas p-1">{([['manual', tx('Record manual publication', 'Kirjaa manuaalinen julkaisu')], ['cms', tx('Publish through CMS', 'Julkaise CMS:n kautta')]] as const).map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={'h-10 flex-1 rounded-md text-sm font-medium ' + (tab === k ? 'bg-white text-navy shadow-sm' : 'text-muted-ink')}>{l}</button>)}</div>
        {e && <Banner tone="error">{e}</Banner>}
        {tab === 'manual' ? <>
          <p className="text-sm text-muted-ink">{tx('You published this revision yourself. Enter the live URL on one of your owned domains. This only records it, so impact tracking can start.', 'Julkaisit tämän version itse. Anna live-osoite omalta verkkotunnukseltasi. Tämä vain kirjaa sen, jotta vaikutuksen seuranta voi alkaa.')}</p>
          <Field label={tx('Live URL', 'Live-osoite')} id="pb-url"><input id="pb-url" type="url" className={inputCls} placeholder="https://" value={url} onChange={(x) => setUrl(x.target.value)} /></Field>
          <div><Button disabled={busy || !/^https:\/\//i.test(url.trim())} onClick={manual}>{tx('Record publication', 'Kirjaa julkaisu')}</Button></div>
        </> : <>
          {items.isError ? <Banner tone="warning">{err(items.error)}</Banner> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tx('Target status', 'Kohdetila')} id="pb-target"><select id="pb-target" className={inputCls} value={target} onChange={(x) => setTarget(x.target.value as 'draft' | 'publish')}><option value="draft">{tx('Save as CMS draft', 'Tallenna CMS-luonnoksena')}</option><option value="publish">{tx('Publish live', 'Julkaise live')}</option></select></Field>
            <Field label={tx('Slug (optional)', 'Slug (valinnainen)')} id="pb-slug"><input id="pb-slug" className={inputCls} value={slug} onChange={(x) => setSlug(x.target.value.toLowerCase())} placeholder="airank-…" /></Field>
            {type === 'wordpress' && <Field label={tx('WordPress type', 'WordPress-tyyppi')} id="pb-wp"><select id="pb-wp" className={inputCls} value={wpType} onChange={(x) => { setWpType(x.target.value as 'posts' | 'pages'); setPage(1); setRemote(null); }}><option value="posts">{tx('Posts', 'Artikkelit')}</option><option value="pages">{tx('Pages', 'Sivut')}</option></select></Field>}
            <Field label={tx('Expected live URL (optional)', 'Odotettu live-osoite (valinnainen)')} id="pb-pu"><input id="pb-pu" type="url" className={inputCls} value={url} onChange={(x) => setUrl(x.target.value)} placeholder="https://" /></Field>
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="text-sm font-semibold">{tx('Remote item', 'Etäkohde')}</p>
            <p className="text-[12px] text-muted-ink">{tx('Choose an existing item to update it (its current modification time is checked), or leave empty to create a new one.', 'Valitse olemassa oleva kohde päivitettäväksi (sen muokka­usaika tarkistetaan) tai jätä tyhjäksi luodaksesi uuden.')}</p>
            <form className="mt-2 flex gap-2" onSubmit={(x) => { x.preventDefault(); setTerm(search); setPage(1); }}><input aria-label={tx('Search CMS items', 'Hae CMS-kohteita')} className={inputCls} value={search} onChange={(x) => setSearch(x.target.value)} /><Button type="submit" variant="secondary">{tx('Search', 'Hae')}</Button></form>
            {items.isPending ? <LoadingBlock rows={3} /> : items.data && <>
              {items.data.searchScope === 'current_page' && <p className="mt-1 text-[12px] text-muted-ink">{tx('Search covers the current page only.', 'Haku kattaa vain nykyisen sivun.')}</p>}
              <ul className="mt-2 max-h-[220px] divide-y divide-line overflow-auto rounded-lg border border-line">
                <li><label className="flex items-center gap-2 px-3 py-2 text-sm"><input type="radio" name="remote" checked={!remote} onChange={() => setRemote(null)} />{tx('Create new item', 'Luo uusi kohde')}</label></li>
                {items.data.items.map((it: any) => <li key={it.id}><label className="flex items-start gap-2 px-3 py-2 text-sm"><input className="mt-1" type="radio" name="remote" checked={remote?.id === it.id} onChange={() => { setRemote(it); setLocId(it.locale ?? ''); }} /><span className="min-w-0"><span className="block truncate font-medium">{it.title || it.slug}</span><span className="block text-[12px] text-muted-ink">{it.status} · {tx('modified', 'muokattu')} {f.dt(it.modified)}{it.locale ? ` · ${it.locale}` : ''}</span></span></label></li>)}
              </ul>
              <div className="mt-2 flex items-center gap-2 text-sm"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => { setPage(page - 1); setRemote(null); }}>{tx('Previous', 'Edellinen')}</Button><span>{page} / {items.data.totalPages || 1}</span><Button size="sm" variant="secondary" disabled={page >= (items.data.totalPages || 1)} onClick={() => { setPage(page + 1); setRemote(null); }}>{tx('Next', 'Seuraava')}</Button></div>
            </>}
            {type === 'webflow' && <div className="mt-3"><Field label={tx('Webflow locale ID', 'Webflow-kielitunnus')} hint={tx('Required. Prefilled from the selected item; 24 hex characters.', 'Pakollinen. Esitäytetty valitusta kohteesta; 24 heksamerkkiä.')} id="pb-loc"><input id="pb-loc" className={inputCls + ' font-mono'} value={locId} onChange={(x) => setLocId(x.target.value.trim())} /></Field></div>}
          </div>
          <Banner tone="warning">{tx('CMS writes are never retried automatically. If the result is uncertain, check the CMS and reconcile it in Jobs.', 'CMS-kirjoituksia ei yritetä automaattisesti uudelleen. Jos tulos on epävarma, tarkista CMS ja täsmäytä se Työt-näkymässä.')}</Banner>
          {confirm ? <Banner tone="warning" action={<div className="flex gap-2"><Button disabled={busy} onClick={cmsPublish}>{tx('Confirm', 'Vahvista')}</Button><Button variant="ghost" onClick={() => setConfirm(false)}>{tx('Cancel', 'Peruuta')}</Button></div>}>{target === 'publish' ? tx('This will make the content live.', 'Tämä julkaisee sisällön live-tilaan.') : tx('This will save a draft in the CMS.', 'Tämä tallentaa luonnoksen CMS:ään.')}{remote ? ' ' + tx('The existing remote item will be overwritten.', 'Olemassa oleva etäkohde ylikirjoitetaan.') : ''}</Banner>
            : <div><Button disabled={busy || !items.data || (type === 'webflow' && !/^[a-f0-9]{24}$/i.test(locId))} onClick={() => setConfirm(true)}>{target === 'publish' ? tx('Publish live…', 'Julkaise live…') : tx('Save CMS draft…', 'Tallenna CMS-luonnos…')}</Button></div>}
        </>}
      </div>
    </Modal>
  );
}

export function ReconcileButton({ job, publicationId }: { job?: ContentJob; publicationId?: string }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast();
  const [open, setOpen] = useState(false); const [status, setStatus] = useState<'published' | 'draft' | 'not_published'>('not_published');
  const [url, setUrl] = useState(''); const [remote, setRemote] = useState(''); const [note, setNote] = useState(''); const [ok, setOk] = useState(false); const [busy, setBusy] = useState(false); const [e, setE] = useState('');
  const pid = publicationId ?? job?.id;
  if (!s.can.review || !pid) return null;
  const go = async () => {
    setBusy(true); setE('');
    try {
      const pub = await s.client.request<any>('GET', `/publications/${encodeURIComponent(pid)}`);
      await s.client.request('POST', `/publications/${encodeURIComponent(pid)}/reconcile`, { expectedVersion: pub.version, verifiedInCms: true, status, ...(status === 'published' ? { url } : {}), ...(remote ? { remoteId: remote } : {}), note });
      s.refresh(); toast({ title: tx('Publication reconciled', 'Julkaisu täsmäytetty') }); setOpen(false);
    } catch (x) { setE(err(x)); } finally { setBusy(false); }
  };
  return <>
    <Button size="sm" onClick={() => setOpen(true)}>{tx('Reconcile with CMS', 'Täsmäytä CMS:n kanssa')}</Button>
    <Modal open={open} onClose={() => setOpen(false)} title={tx('Reconcile uncertain publication', 'Täsmäytä epävarma julkaisu')} description={tx('Bookkeeping only: this does not write to the CMS. Look at the CMS first and record what is actually there.', 'Vain kirjanpito: tämä ei kirjoita CMS:ään. Katso ensin CMS ja kirjaa mitä siellä todella on.')}
      footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{tx('Cancel', 'Peruuta')}</Button><Button disabled={busy || !ok || (status === 'published' && !/^https:\/\//i.test(url))} onClick={go}>{tx('Record outcome', 'Kirjaa lopputulos')}</Button></>}>
      <div className="flex flex-col gap-4">{e && <Banner tone="error">{e}</Banner>}
        <Field label={tx('What is in the CMS now?', 'Mitä CMS:ssä on nyt?')} id="rc-st"><select id="rc-st" className={inputCls} value={status} onChange={(x) => setStatus(x.target.value as 'published')}><option value="not_published">{tx('Nothing was published', 'Mitään ei julkaistu')}</option><option value="draft">{tx('A draft exists', 'Luonnos on olemassa')}</option><option value="published">{tx('It is live', 'Se on live')}</option></select></Field>
        {status === 'published' && <Field label={tx('Live URL', 'Live-osoite')} id="rc-url"><input id="rc-url" type="url" className={inputCls} value={url} onChange={(x) => setUrl(x.target.value)} placeholder="https://" /></Field>}
        <Field label={tx('Remote ID (optional)', 'Etätunnus (valinnainen)')} id="rc-rem"><input id="rc-rem" className={inputCls} value={remote} onChange={(x) => setRemote(x.target.value)} /></Field>
        <Field label={tx('Note', 'Muistiinpano')} id="rc-note"><textarea id="rc-note" rows={2} className={areaCls} value={note} onChange={(x) => setNote(x.target.value)} /></Field>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={ok} onChange={(x) => setOk(x.target.checked)} />{tx('I have verified this in the CMS.', 'Olen varmistanut tämän CMS:ssä.')}</label></div>
    </Modal>
  </>;
}
