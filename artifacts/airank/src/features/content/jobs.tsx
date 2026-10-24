import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/airank/primitives';
import { useToast } from '@/hooks/use-toast';
import { isActiveJob, useStudio } from './studio';
import { Banner, Card, ExtLink, JobBadge, inputCls, useErr, useFmt, useStatusLabels, useTx } from './ui';
import { JobResult } from './results';
import { ReconcileButton } from './publish';
import type { ContentJob } from '@/lib/content-api';

export function JobActions({ job }: { job: ContentJob }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast(); const [busy, setBusy] = useState(false);
  if (job.kind === 'publish') return null; // CMS writes are never cancelled or retried blindly
  const act = async (what: 'cancel' | 'retry') => {
    setBusy(true);
    try { await (what === 'cancel' ? s.client.cancel(job.id) : s.client.retry(job.id)); s.refresh(); }
    catch (e) { toast({ variant: 'destructive', title: tx('Action failed', 'Toiminto epäonnistui'), description: err(e) }); }
    finally { setBusy(false); }
  };
  if (!s.can.edit) return null;
  return <>
    {isActiveJob(job) && <Button variant="secondary" size="sm" disabled={busy} onClick={() => act('cancel')}>{tx('Cancel job', 'Peru työ')}</Button>}
    {job.status === 'failed' && <Button variant="secondary" size="sm" disabled={busy} onClick={() => act('retry')}>{tx('Retry (completed stages reused)', 'Yritä uudelleen (valmiit vaiheet käytetään)')}</Button>}
  </>;
}

export function JobsView() {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const sl = useStatusLabels();
  const [status, setStatus] = useState(''); const [kind, setKind] = useState('');
  const rows = s.jobs.filter((j) => (!status || j.status === status) && (!kind || j.kind === kind));
  if (s.jobsPending) return <LoadingBlock rows={5} />;
  return (
    <Card title={tx('Jobs', 'Työt')} actions={<div className="flex gap-2">
      <select aria-label={tx('Status', 'Tila')} className={inputCls + ' w-auto'} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{tx('All statuses', 'Kaikki tilat')}</option>{Object.entries(sl.job).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
      <select aria-label={tx('Type', 'Tyyppi')} className={inputCls + ' w-auto'} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">{tx('All types', 'Kaikki tyypit')}</option>{Object.entries(sl.kind).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    </div>}>
      {rows.length === 0 ? <EmptyState compact title={tx('No jobs match', 'Ei hakua vastaavia töitä')} /> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[12px] uppercase text-muted-ink"><tr><th className="py-2 pr-3">{tx('Type', 'Tyyppi')}</th><th className="pr-3">{tx('Status', 'Tila')}</th><th className="pr-3">{tx('Created', 'Luotu')}</th><th>{tx('Error', 'Virhe')}</th></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((j) => <tr key={j.id}><td className="py-2 pr-3"><Link className="font-medium text-link hover:underline" href={s.ph(`/dashboard/content/jobs/${j.id}`)}>{sl.kind[j.kind] ?? j.kind}</Link></td><td className="pr-3"><JobBadge status={j.status} /></td><td className="pr-3 text-muted-ink">{f.dt(j.created_at)}</td><td className="font-mono text-[12px] text-danger">{j.error ?? ''}</td></tr>)}</tbody></table></div>
      )}
    </Card>
  );
}

export function JobDetailView({ id }: { id: string }) {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const sl = useStatusLabels(); const err = useErr();
  const q = useQuery({
    queryKey: s.key('job', id), queryFn: () => s.client.job(id), retry: false,
    refetchInterval: (x) => (document.visibilityState === 'visible' && x.state.data && isActiveJob(x.state.data) ? 3000 : false),
  });
  if (q.isPending) return <LoadingBlock rows={4} />;
  if (q.isError) return <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} />;
  const job = q.data; const stages = Object.keys(job.checkpoint ?? {});
  const children = job.kind === 'sitemap' ? (job.result?.jobs ?? []).map((cid: string) => s.jobs.find((j) => j.id === cid) ?? { id: cid } as ContentJob) : [];
  const docId = job.input?.documentId;
  return (
    <div className="flex flex-col gap-4">
      <Card title={sl.kind[job.kind] ?? job.kind} actions={<><JobBadge status={job.status} /><JobActions job={job} /></>}>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-muted-ink">{tx('Created', 'Luotu')}</dt><dd>{f.dt(job.created_at)}</dd>
          <dt className="text-muted-ink">{tx('Updated', 'Päivitetty')}</dt><dd>{f.dt(job.updated_at)}</dd>
          {job.input?.url && <><dt className="text-muted-ink">URL</dt><dd><ExtLink href={job.input.url} /></dd></>}
          {docId && <><dt className="text-muted-ink">{tx('Document', 'Asiakirja')}</dt><dd><Link className="text-link hover:underline" href={s.ph(`/dashboard/content/documents/${docId}`)}>{tx('Open document', 'Avaa asiakirja')}</Link> · v{job.input.documentVersion}</dd></>}
        </dl>
        {stages.length > 0 && <div className="mt-3"><p className="text-[12px] font-semibold uppercase text-muted-ink">{tx('Completed stages', 'Valmiit vaiheet')}</p><ul className="mt-1 flex flex-wrap gap-1.5">{stages.map((k) => <li key={k} className="rounded-md bg-canvas px-2 py-0.5 text-[12px]">{k}</li>)}</ul></div>}
        {isActiveJob(job) && <p className="mt-3 text-sm text-muted-ink" aria-live="polite">{tx('Updating automatically while this page is visible.', 'Päivittyy automaattisesti, kun sivu on näkyvissä.')}</p>}
      </Card>
      {job.status === 'failed' && <Banner tone="error"><p className="font-semibold">{tx('Job failed', 'Työ epäonnistui')}</p><p>{err(job.error ?? 'REQUEST_FAILED')}</p>{['SOURCE_FETCH_FAILED', 'ROBOTS_DISALLOWED'].includes(job.error ?? '') && job.kind === 'import' && <p className="mt-1"><Link className="font-semibold underline" href={s.ph('/dashboard/content/library?import=paste')}>{tx('Paste the content instead', 'Liitä sisältö käsin')}</Link></p>}</Banner>}
      {job.status === 'uncertain' && <Banner tone="warning" action={job.kind === 'publish' ? <ReconcileButton job={job} /> : undefined}><p className="font-semibold">{tx('Outcome uncertain', 'Lopputulos epävarma')}</p><p>{err(job.error ?? 'PUBLICATION_UNCERTAIN')}</p></Banner>}
      {job.kind === 'publish' && job.status === 'failed' && job.error === 'PUBLICATION_UNCERTAIN' && <ReconcileButton job={job} />}
      {job.kind === 'sitemap' && children.length > 0 && (
        <Card title={tx('Imports from this sitemap', 'Sivukartan tuonnit')}>
          <ul className="divide-y divide-line text-sm">{children.map((c: ContentJob) => <li key={c.id} className="flex flex-wrap items-center gap-2 py-2"><span className="min-w-0 flex-1 truncate"><ExtLink href={c.input?.url} /></span>{c.status ? <JobBadge status={c.status} /> : null}
            {c.result?.documentId && <Link className="text-link hover:underline" href={s.ph(`/dashboard/content/documents/${c.result.documentId}`)}>{tx('Open', 'Avaa')}</Link>}
            {c.status === 'failed' && <><span className="font-mono text-[12px] text-danger">{c.error}</span><Link className="text-link hover:underline" href={s.ph('/dashboard/content/library?import=paste')}>{tx('Paste instead', 'Liitä käsin')}</Link></>}
            {c.id && <Link className="text-[12px] text-muted-ink hover:underline" href={s.ph(`/dashboard/content/jobs/${c.id}`)}>{tx('Details', 'Tiedot')}</Link>}</li>)}</ul>
        </Card>
      )}
      {job.status === 'completed' && <JobResult job={job} />}
    </div>
  );
}
