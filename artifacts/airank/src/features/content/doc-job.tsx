import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/airank/primitives';
import { useToast } from '@/hooks/use-toast';
import { isActiveJob, jobsFor, useStudio } from './studio';
import { Banner, Card, JobBadge, MarkdownPreview, useErr, useFmt, useTx } from './ui';
import { EditButton, PaidButton, useRunJob } from './actions';
import { AuditResult, CreateResult, MissingInfo, ResearchResult, SourceChips, SourceErrors } from './results';
import { hasUnsavedBuffer } from './editor';

const KIND = { audit: 'audit', brief: 'research', changes: 'rewrite', draft: 'create' } as const;

export function DocJobView({ id, mode }: { id: string; mode: string }) {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const f = useFmt(); const qc = useQueryClient(); const [, nav] = useLocation(); const { toast } = useToast();
  const kind = KIND[mode as keyof typeof KIND];
  const dq = useQuery({ queryKey: s.key('doc', id), queryFn: () => s.client.document(id), retry: false, refetchOnWindowFocus: false });
  const { run, busy } = useRunJob();
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [applying, setApplying] = useState(false);
  if (!kind) return <ErrorState title={tx('Page not found', 'Sivua ei löytynyt')} />;
  if (dq.isPending) return <LoadingBlock rows={4} />;
  if (dq.isError) return <ErrorState body={err(dq.error)} onRetry={() => void dq.refetch()} />;
  const doc = dq.data;
  const list = jobsFor(s.jobs, kind, id);
  const job = list[0];
  const title = { audit: tx('Content audit', 'Sisältöauditointi'), brief: tx('Research and brief', 'Tutkimus ja brief'), changes: tx('Suggested changes', 'Muutosehdotukset'), draft: tx('Full draft comparison', 'Koko luonnoksen vertailu') }[mode as 'audit'];
  const stale = !!job && job.input?.documentVersion !== doc.version;
  const unsaved = hasUnsavedBuffer(s.userId, s.projectId, id);
  const back = s.ph(`/dashboard/content/documents/${id}`);
  const rerun = () => run(kind, { documentId: id, documentVersion: doc.version, locale: doc.locale, topic: doc.topic ?? '', expertise: doc.expertise ?? '' });
  const changes: any[] = job?.status === 'completed' ? (job.result?.output?.changes ?? []) : [];
  const apply = async (ids?: string[]) => {
    if (!job) return;
    setApplying(true);
    try {
      const d = await s.client.apply(id, doc.version, job.id, ids);
      qc.setQueryData(s.key('doc', id), d); s.refresh(); toast({ title: tx('Applied as a new draft revision', 'Toteutettu uutena luonnosversiona'), description: `v${d.version}` }); nav(back);
    } catch (e) { toast({ variant: 'destructive', title: tx('Could not apply', 'Toteutus epäonnistui'), description: err(e) }); void dq.refetch(); }
    finally { setApplying(false); }
  };
  const toggle = (cid: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(cid)) n.delete(cid); else n.add(cid); return n; });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]"><Link href={back} className="text-link hover:underline">← {doc.title || tx('Untitled', 'Nimetön')}</Link><span className="text-muted-ink">v{doc.version}</span></div>
      <div className="flex flex-wrap items-center gap-3"><h1 className="flex-1 text-[22px] font-semibold text-ink">{title}</h1>{job && <JobBadge status={job.status} />}
        <PaidButton variant="secondary" disabled={busy || (!!job && isActiveJob(job)) || unsaved} onClick={async () => { await rerun(); }}>{job ? tx('Run again', 'Aja uudelleen') : tx('Run', 'Aja')}</PaidButton></div>
      {unsaved && <Banner tone="warning" action={<Link href={back} className="text-sm font-semibold underline">{tx('Open editor', 'Avaa editori')}</Link>}>{tx('You have unsaved edits in the editor. Save them before running or applying anything here.', 'Editorissa on tallentamattomia muokkauksia. Tallenna ne ennen ajamista tai toteuttamista täällä.')}</Banner>}
      {!job ? <EmptyState title={tx('Nothing here yet', 'Tässä ei ole vielä mitään')} body={tx('Run the job to see results for this revision.', 'Aja työ nähdäksesi tulokset tälle versiolle.')} /> : <>
        {isActiveJob(job) && <Banner>{tx('Working… this page updates automatically.', 'Työstetään… sivu päivittyy automaattisesti.')} {s.can.edit && <Link className="underline" href={s.ph(`/dashboard/content/jobs/${job.id}`)}>{tx('Job details', 'Työn tiedot')}</Link>}</Banner>}
        {job.status === 'failed' && <Banner tone="error" action={<Link className="text-sm font-semibold underline" href={s.ph(`/dashboard/content/jobs/${job.id}`)}>{tx('Details and retry', 'Tiedot ja uusinta')}</Link>}>{err(job.error ?? 'REQUEST_FAILED')}</Banner>}
        {job.status === 'completed' && <p className="text-[12px] text-muted-ink">{tx('Result for revision', 'Tulos versiolle')} v{job.input?.documentVersion} · {f.dt(job.updated_at)}</p>}
        {stale && job.status === 'completed' && mode !== 'audit' && mode !== 'brief' && <Banner tone="warning">{tx('The document changed after this proposal was made (v' + job.input?.documentVersion + ' → v' + doc.version + '). It can no longer be applied. Run it again.', 'Asiakirja muuttui ehdotuksen jälkeen (v' + job.input?.documentVersion + ' → v' + doc.version + '). Sitä ei voi enää toteuttaa. Aja uudelleen.')}</Banner>}
        {stale && job.status === 'completed' && (mode === 'audit' || mode === 'brief') && <Banner>{tx('This result describes an older revision.', 'Tulos koskee vanhempaa versiota.')}</Banner>}
        {job.status === 'completed' && mode === 'audit' && <AuditResult r={job.result} />}
        {job.status === 'completed' && mode === 'brief' && <ResearchResult r={job.result} />}
        {job.status === 'completed' && mode === 'draft' && <>
          <div className="flex flex-wrap items-center gap-2"><EditButton disabled={applying || stale || unsaved} onClick={() => apply()}>{tx('Apply as new draft revision', 'Toteuta uutena luonnosversiona')}</EditButton><span className="text-[12px] text-muted-ink">{tx('Replaces title, description and text; the previous version stays in history. Review the facts first.', 'Korvaa otsikon, kuvauksen ja tekstin; edellinen versio säilyy historiassa. Tarkista faktat ensin.')}</span></div>
          <div className="grid gap-4 lg:grid-cols-2"><Card title={tx('Current', 'Nykyinen')}><MarkdownPreview markdown={doc.markdown} /></Card><div className="min-w-0"><CreateResult r={job.result} /></div></div></>}
        {job.status === 'completed' && mode === 'changes' && <>
          <SourceErrors errors={job.result?.sourceErrors} />
          {job.result?.output?.summary && <p className="text-sm text-ink">{String(job.result.output.summary)}</p>}
          <div className="flex flex-wrap items-center gap-2"><EditButton disabled={applying || stale || unsaved || selected.size === 0} onClick={() => apply([...selected])}>{tx(`Apply selected (${selected.size})`, `Toteuta valitut (${selected.size})`)}</EditButton>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{tx('Clear selection', 'Tyhjennä valinta')}</Button><span className="text-[12px] text-muted-ink">{tx('Only the passages you tick are applied.', 'Vain valitsemasi kohdat toteutetaan.')}</span></div>
          {changes.length === 0 ? <EmptyState compact title={tx('No changes proposed', 'Ei ehdotettuja muutoksia')} /> : <ul className="flex flex-col gap-3">{changes.map((c) => (
            <li key={c.id} className="rounded-[12px] border border-line bg-white p-4"><label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-5" checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={!s.can.edit || stale} aria-label={tx('Select this change', 'Valitse tämä muutos')} />
              <span className="grid min-w-0 flex-1 gap-3 md:grid-cols-2"><span><span className="text-[12px] font-semibold uppercase text-muted-ink">{tx('Original', 'Alkuperäinen')}</span><span className="mt-1 block whitespace-pre-wrap rounded-lg bg-[#fff1f1] p-2 text-sm">{c.original}</span></span><span><span className="text-[12px] font-semibold uppercase text-muted-ink">{tx('Replacement', 'Korvaava')}</span><span className="mt-1 block whitespace-pre-wrap rounded-lg bg-[#eefaf2] p-2 text-sm">{c.replacement}</span></span></span></label>
              <p className="mt-2 text-sm"><span className="font-semibold">{tx('Reason', 'Peruste')}: </span>{c.reason}</p><SourceChips ids={c.sourceIds} /></li>))}</ul>}
          <MissingInfo items={job.result?.output?.missingInformation} />
        </>}
      </>}
    </div>
  );
}
