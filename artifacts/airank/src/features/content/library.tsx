import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Upload, FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock, StatusBadge } from '@/components/airank/primitives';
import { useToast } from '@/hooks/use-toast';
import { useDocuments, useRecords, useStudio } from './studio';
import { Banner, Card, DocBadge, ExtLink, Field, Modal, areaCls, inputCls, useErr, useFmt, useTx } from './ui';
import { EditButton, PaidButton, useOpenJob, useRunJob } from './actions';

const MAX_BULK = 50;

export function LibraryView() {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const err = useErr(); const { toast } = useToast();
  const [, nav] = useLocation(); const search = useSearch(); const params = new URLSearchParams(search);
  const docs = useDocuments(); const pubs = useRecords('publications');
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [lang, setLang] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(!!params.get('import'));
  const [bulkBusy, setBulkBusy] = useState(false);
  const open = useOpenJob();
  const rows = useMemo(() => (docs.data ?? []).filter((d) => (!status || d.status === status) && (!lang || d.locale === lang) && (!q || `${d.title} ${d.sourceUrl ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [docs.data, q, status, lang]);
  const pubState = (id: string) => { const p = (pubs.data ?? []).filter((x) => x.documentId === id).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]; return p?.status as string | undefined; };
  const toggle = (id: string) => setSel((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else if (n.size < MAX_BULK) n.add(id); return n; });
  const bulk = async (kind: 'audit' | 'research' | 'rewrite') => {
    setBulkBusy(true);
    try {
      const items = [...sel].map((id) => { const d = docs.data!.find((x) => x.id === id)!; return { kind, documentId: d.id, documentVersion: d.version }; });
      await s.submitter.bulk(items); s.refresh(); setSel(new Set());
      toast({ title: tx('Bulk jobs queued', 'Massatyöt jonossa'), description: String(items.length) }); nav(s.ph('/dashboard/content/jobs'));
    } catch (e) { toast({ variant: 'destructive', title: tx('Bulk request failed', 'Massapyyntö epäonnistui'), description: err(e) }); }
    finally { setBulkBusy(false); }
  };
  const pubLabel = (st?: string) => st === 'published' ? tx('Published', 'Julkaistu') : st === 'draft' ? tx('CMS draft', 'CMS-luonnos') : st === 'uncertain' || st === 'submitting' ? tx('Uncertain', 'Epävarma') : st === 'not_published' ? tx('Not published', 'Ei julkaistu') : '—';
  void open;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={tx('Search documents', 'Hae asiakirjoja')} placeholder={tx('Search title or URL', 'Hae otsikolla tai osoitteella')} className={inputCls + ' max-w-[320px]'} value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label={tx('Status', 'Tila')} className={inputCls + ' w-auto'} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{tx('All statuses', 'Kaikki tilat')}</option>{['draft', 'in_review', 'approved', 'changes_requested'].map((x) => <option key={x} value={x}>{{ draft: tx('Draft', 'Luonnos'), in_review: tx('In review', 'Tarkistuksessa'), approved: tx('Approved', 'Hyväksytty'), changes_requested: tx('Changes requested', 'Muutoksia pyydetty') }[x]}</option>)}</select>
        <select aria-label={tx('Language', 'Kieli')} className={inputCls + ' w-auto'} value={lang} onChange={(e) => setLang(e.target.value)}><option value="">{tx('All languages', 'Kaikki kielet')}</option><option value="fi">Suomi</option><option value="en">English</option></select>
        <div className="flex-1" />
        <EditButton variant="secondary" onClick={() => nav(s.ph('/dashboard/content/new'))}><FilePlus2 aria-hidden /> {tx('New content', 'Uusi sisältö')}</EditButton>
        <EditButton onClick={() => setImportOpen(true)}><Upload aria-hidden /> {tx('Import content', 'Tuo sisältöä')}</EditButton>
      </div>
      {sel.size > 0 && (
        <Banner action={<div className="flex flex-wrap gap-2"><PaidButton size="sm" disabled={bulkBusy} onClick={() => bulk('audit')}>{tx('Audit', 'Auditoi')}</PaidButton><PaidButton size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulk('research')}>{tx('Research', 'Tutki')}</PaidButton><PaidButton size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulk('rewrite')}>{tx('Suggest changes', 'Ehdota muutoksia')}</PaidButton><Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>{tx('Clear', 'Tyhjennä')}</Button></div>}>
          {tx(`${sel.size} selected (max ${MAX_BULK}). Bulk jobs only create suggestions; nothing is applied.`, `${sel.size} valittu (enintään ${MAX_BULK}). Massatyöt luovat vain ehdotuksia; mitään ei toteuteta.`)}
        </Banner>
      )}
      <Card className="overflow-hidden" >
        {docs.isPending ? <LoadingBlock rows={5} /> : docs.isError ? <ErrorState body={err(docs.error)} onRetry={() => void docs.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={(docs.data ?? []).length ? tx('No documents match the filters', 'Suodattimet eivät täsmää') : tx('Your library is empty', 'Kirjastosi on tyhjä')} body={(docs.data ?? []).length ? undefined : tx('Import a page from your site, paste content or start from a brief.', 'Tuo sivu sivustoltasi, liitä sisältöä tai aloita briefistä.')} />
        ) : (
          <div className="-m-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-canvas text-[12px] uppercase text-muted-ink"><tr><th className="w-10 p-3"><span className="sr-only">{tx('Select', 'Valitse')}</span></th><th className="p-3">{tx('Title', 'Otsikko')}</th><th>{tx('Source URL', 'Lähdeosoite')}</th><th>{tx('Language', 'Kieli')}</th><th>{tx('Status', 'Tila')}</th><th>{tx('Revision', 'Versio')}</th><th>{tx('Audit issues', 'Auditointihuomiot')}</th><th>{tx('Publication', 'Julkaisu')}</th></tr></thead>
            <tbody className="divide-y divide-line">{rows.map((d) => (
              <tr key={d.id} className="hover:bg-canvas/60">
                <td className="p-3"><input type="checkbox" className="size-4" aria-label={tx(`Select ${d.title}`, `Valitse ${d.title}`)} checked={sel.has(d.id)} disabled={!s.can.edit || (!sel.has(d.id) && sel.size >= MAX_BULK)} onChange={() => toggle(d.id)} /></td>
                <td className="max-w-[280px] p-3"><Link href={s.ph(`/dashboard/content/documents/${d.id}`)} className="block truncate font-medium text-ink hover:underline">{d.title || tx('Untitled', 'Nimetön')}</Link></td>
                <td className="max-w-[220px] truncate pr-3"><ExtLink href={d.sourceUrl} /></td>
                <td className="uppercase">{d.locale}</td><td><DocBadge status={d.status} /></td>
                <td className="text-muted-ink">v{d.version} · {f.d(d.updatedAt)}</td>
                <td>{d.audit?.issues ? d.audit.issues.length : '—'}</td>
                <td><StatusBadge tone={pubState(d.id) === 'published' ? 'success' : pubState(d.id) === 'uncertain' ? 'warning' : 'neutral'} dot={false}>{pubLabel(pubState(d.id))}</StatusBadge></td>
              </tr>))}</tbody></table></div>
        )}
      </Card>
      <ImportDialog open={importOpen} initial={params.get('import') === 'paste' ? 'paste' : 'url'} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function ImportDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: 'url' | 'paste' }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast(); const [, nav] = useLocation();
  const { run, busy } = useRunJob();
  const [tab, setTab] = useState<'url' | 'paste' | 'sitemap'>(initial);
  const [url, setUrl] = useState(''); const [locale, setLocale] = useState<'fi' | 'en'>((s.overview.project?.promptLanguage as 'fi' | 'en') ?? 'fi');
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [max, setMax] = useState(100);
  const [description, setDescription] = useState('');
  const [pasting, setPasting] = useState(false); const [formErr, setFormErr] = useState('');
  const go = async () => {
    setFormErr('');
    try {
      if (tab === 'paste') {
        if (!title.trim() || !text.trim()) { setFormErr(tx('Title and content are required.', 'Otsikko ja sisältö vaaditaan.')); return; }
        setPasting(true);
        const d = await s.client.create({ title: title.trim(), description, markdown: text, locale, ...(url ? { sourceUrl: url.trim() } : {}) });
        s.refresh(); onClose(); nav(s.ph(`/dashboard/content/documents/${d.id}`)); return;
      }
      if (!/^https:\/\//i.test(url.trim())) { setFormErr(tx('Enter an https:// address on one of your owned domains.', 'Anna https://-osoite omalta verkkotunnukseltasi.')); return; }
      const job = await run(tab === 'url' ? 'import' : 'sitemap', tab === 'url' ? { url: url.trim(), locale } : { url: url.trim(), locale, maxPages: max });
      if (job) { onClose(); nav(s.ph(`/dashboard/content/jobs/${job.id}`)); }
    } catch (e) { setFormErr(err(e)); toast({ variant: 'destructive', title: tx('Import failed', 'Tuonti epäonnistui'), description: err(e) }); }
    finally { setPasting(false); }
  };
  const tabs = [['url', tx('From URL', 'Osoitteesta')], ['paste', tx('Paste content', 'Liitä sisältö')], ['sitemap', tx('Sitemap', 'Sivukartta')]] as const;
  return (
    <Modal open={open} onClose={onClose} title={tx('Import content', 'Tuo sisältöä')} description={tx('Pages must belong to your owned domains. Existing edits are never overwritten.', 'Sivujen tulee kuulua omiin verkkotunnuksiisi. Olemassa olevia muokkauksia ei ylikirjoiteta.')}
      footer={<><Button variant="ghost" onClick={onClose}>{tx('Cancel', 'Peruuta')}</Button><Button disabled={busy || pasting} onClick={go}>{tab === 'paste' ? tx('Create document', 'Luo asiakirja') : tab === 'url' ? tx('Import page', 'Tuo sivu') : tx('Discover and import', 'Etsi ja tuo')}</Button></>}>
      <div className="flex flex-col gap-4">
        <div role="tablist" className="flex gap-1 rounded-lg bg-canvas p-1">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={'h-9 flex-1 rounded-md text-sm font-medium ' + (tab === k ? 'bg-white text-navy shadow-sm' : 'text-muted-ink')}>{l}</button>)}</div>
        {formErr && <Banner tone="error">{formErr}</Banner>}
        {tab === 'paste' && <Field label={tx('Title', 'Otsikko')} id="imp-title"><input id="imp-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} /></Field>}
        {tab === 'paste' && <Field label={tx('Description', 'Kuvaus')} id="imp-description"><textarea id="imp-description" rows={3} className={areaCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>}
        <Field label={tab === 'sitemap' ? tx('Sitemap URL', 'Sivukartan osoite') : tab === 'paste' ? tx('Source page URL (optional)', 'Lähdesivun osoite (valinnainen)') : tx('Page URL', 'Sivun osoite')} id="imp-url"><input id="imp-url" type="url" inputMode="url" className={inputCls} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        {tab === 'paste' && <Field label={tx('Markdown or text', 'Markdown tai teksti')} id="imp-md"><textarea id="imp-md" rows={9} className={areaCls + ' font-mono'} value={text} onChange={(e) => setText(e.target.value)} /></Field>}
        {tab === 'sitemap' && <Field label={tx('Maximum pages', 'Sivuja enintään')} hint={tx('Up to 500. Each page becomes its own import job.', 'Enintään 500. Jokaisesta sivusta tulee oma tuontityö.')} id="imp-max"><input id="imp-max" type="number" min={1} max={500} className={inputCls} value={max} onChange={(e) => setMax(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} /></Field>}
        <Field label={tx('Language', 'Kieli')} id="imp-lang"><select id="imp-lang" className={inputCls} value={locale} onChange={(e) => setLocale(e.target.value as 'fi' | 'en')}><option value="fi">Suomi</option><option value="en">English</option></select></Field>
      </div>
    </Modal>
  );
}
