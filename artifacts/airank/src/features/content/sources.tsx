import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/airank/primitives';
import { useRecords, useStudio } from './studio';
import { Banner, Card, ExtLink, inputCls, useErr, useFmt, useTx } from './ui';

export function SourcesView() {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const err = useErr();
  const q = useRecords('sources'); const as = useRecords('assessments');
  const [sel, setSel] = useState<string | null>(window.location.hash.slice(1) || null); const [term, setTerm] = useState('');
  useEffect(() => { const h = () => setSel(window.location.hash.slice(1) || null); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const rows = (q.data ?? []).filter((x) => !term || `${x.title} ${x.url}`.toLowerCase().includes(term.toLowerCase()));
  const cur = (q.data ?? []).find((x) => x.id === sel);
  const citing = cur ? (as.data ?? []).filter((a) => JSON.stringify(a.output ?? a).includes(cur.id)) : [];
  void s;
  if (q.isPending) return <LoadingBlock rows={5} />;
  if (q.isError) return <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} />;
  if ((q.data ?? []).length === 0) return <EmptyState title={tx('No source snapshots yet', 'Ei vielä lähdekopioita')} body={tx('Sources are fetched and stored privately when research, audit or perception jobs run.', 'Lähteet haetaan ja tallennetaan yksityisesti, kun tutkimus-, auditointi- tai brändikuvatyöt ajetaan.')} />;
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card title={tx('Source snapshots', 'Lähdekopiot')}>
        <input aria-label={tx('Search sources', 'Hae lähteitä')} className={inputCls + ' mb-3'} value={term} onChange={(e) => setTerm(e.target.value)} placeholder={tx('Search title or URL', 'Hae otsikolla tai osoitteella')} />
        <ul className="max-h-[560px] divide-y divide-line overflow-auto">{rows.map((x) => <li key={x.id}><button type="button" onClick={() => { setSel(x.id); history.replaceState(null, '', `#${x.id}`); }} aria-pressed={sel === x.id} className={'w-full px-2 py-2 text-left text-sm hover:bg-canvas ' + (sel === x.id ? 'bg-tint' : '')}><span className="block truncate font-medium">{x.title || x.url}</span><span className="block truncate text-[12px] text-muted-ink">{x.url}</span><span className="text-[12px] text-muted-ink">{f.dt(x.fetchedAt)}</span></button></li>)}</ul>
      </Card>
      <div className="min-w-0">{!cur ? <EmptyState compact title={tx('Select a source', 'Valitse lähde')} /> : (
        <Card title={cur.title || cur.url}>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-muted-ink">URL</dt><dd><ExtLink href={cur.url} /></dd>
            <dt className="text-muted-ink">{tx('Fetched', 'Haettu')}</dt><dd>{f.dt(cur.fetchedAt)}</dd>
            <dt className="text-muted-ink">{tx('Source hash', 'Lähteen tiiviste')}</dt><dd className="break-all font-mono text-[12px]">{cur.contentHash ?? '—'}</dd>
          </dl>
          <div className="mt-3 space-y-2">
            {cur.contentTruncated && <Banner tone="warning">{tx('Extraction hit the size limit; the text is truncated.', 'Poiminta saavutti kokorajan; teksti on katkaistu.')}</Banner>}
            <Banner>{tx('Limits: server HTML only, no JavaScript rendering, embedded components are not read.', 'Rajaukset: vain palvelimen HTML, ei JavaScript-renderöintiä, upotettuja komponentteja ei lueta.')}</Banner>
          </div>
          <h3 className="mt-4 text-[13px] font-semibold">{tx('Extracted text (shown as plain text)', 'Poimittu teksti (näytetään pelkkänä tekstinä)')}</h3>
          <pre className="mt-1 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-3 text-[13px]">{String(cur.markdown ?? '')}</pre>
          <h3 className="mt-4 text-[13px] font-semibold">{tx('Cited by', 'Viittaajat')}</h3>
          {citing.length === 0 ? <p className="text-sm text-muted-ink">{tx('No stored assessment cites this source yet.', 'Mikään tallennettu arvio ei vielä viittaa tähän lähteeseen.')}</p> : <ul className="list-disc pl-5 text-sm">{citing.map((a) => <li key={a.id}>{a.kind} · {f.dt(a.updatedAt)}</li>)}</ul>}
        </Card>)}</div>
    </div>
  );
}
