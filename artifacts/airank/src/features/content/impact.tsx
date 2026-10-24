import { EmptyState, ErrorState, LoadingBlock, StatusBadge } from '@/components/airank/primitives';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { isActiveJob, jobsFor, useDocuments, useRecords, useStudio } from './studio';
import { Banner, Card, ExtLink, JobBadge, useErr, useFmt, useTx } from './ui';
import { useRunJob } from './actions';
import { ImpactResult } from './results';
import { ReconcileButton } from './publish';

export function ImpactView() {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const err = useErr(); const { run, busy } = useRunJob();
  const pubs = useRecords('publications'); const docs = useDocuments(); const as = useRecords('assessments');
  if (pubs.isPending) return <LoadingBlock rows={4} />;
  if (pubs.isError) return <ErrorState body={err(pubs.error)} onRetry={() => void pubs.refetch()} />;
  const list = [...(pubs.data ?? [])].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (list.length === 0) return <EmptyState title={tx('No published revisions yet', 'Ei vielä julkaistuja versioita')} body={tx('When you publish an approved revision (or record a manual publication), its before/after impact appears here.', 'Kun julkaiset hyväksytyn version (tai kirjaat manuaalisen julkaisun), sen ennen/jälkeen-vaikutus näkyy tässä.')} />;
  const stLabel = (x: string) => ({ published: tx('Published', 'Julkaistu'), draft: tx('CMS draft', 'CMS-luonnos'), uncertain: tx('Uncertain', 'Epävarma'), submitting: tx('Submitting', 'Lähetetään'), not_published: tx('Not published', 'Ei julkaistu') }[x] ?? x);
  return (
    <div className="flex flex-col gap-5">
      <Banner>{tx('Editorial checklist, AI visibility, Google Search and AI traffic are reported separately. Missing metrics show — and are never counted as zero.', 'Toimituksellinen tarkistuslista, tekoälynäkyvyys, Google-haku ja tekoälyliikenne raportoidaan erikseen. Puuttuva mittari näkyy merkillä — eikä sitä lasketa nollaksi.')}</Banner>
      {list.map((p) => {
        const doc = (docs.data ?? []).find((d) => d.id === p.documentId);
        const jobs = jobsFor(s.jobs, 'impact', p.documentId);
        const done = jobs.find((j) => j.status === 'completed' && j.result?.publicationId === p.id) ?? jobs.find((j) => j.status === 'completed');
        const saved = (as.data ?? []).find((a) => a.kind === 'impact' && a.documentId === p.documentId);
        const res = done?.result ?? saved;
        const running = jobs.find(isActiveJob);
        const uncertain = ['uncertain', 'submitting'].includes(p.status);
        return (
          <Card key={p.id} title={doc?.title ?? p.documentId} actions={<StatusBadge tone={p.status === 'published' ? 'success' : uncertain ? 'warning' : 'neutral'}>{stLabel(p.status)}</StatusBadge>}>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[160px_1fr]">
              <dt className="text-muted-ink">{tx('Revision', 'Versio')}</dt><dd>v{p.documentVersion} · {p.channel === 'manual' ? tx('manual', 'manuaalinen') : p.channel}</dd>
              <dt className="text-muted-ink">{tx('Published', 'Julkaistu')}</dt><dd>{f.dt(p.publishedAt)}</dd>
              <dt className="text-muted-ink">URL</dt><dd><ExtLink href={p.url} /></dd>
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {doc && <Link href={s.ph(`/dashboard/content/documents/${doc.id}`)} className="text-sm text-link hover:underline">{tx('Open document', 'Avaa asiakirja')}</Link>}
              {uncertain && <ReconcileButton publicationId={p.id} />}
              {p.status === 'published' && doc && s.can.edit && <Button size="sm" variant="secondary" disabled={busy || !!running} onClick={() => void run('impact', { documentId: doc.id, documentVersion: doc.version })}>{tx('Check impact', 'Tarkista vaikutus')}</Button>}
              {running && <JobBadge status={running.status} />}
            </div>
            {uncertain && <div className="mt-3"><Banner tone="warning">{tx('The CMS outcome is uncertain. Check the CMS and reconcile; do not publish again.', 'CMS-lopputulos on epävarma. Tarkista CMS ja täsmäytä; älä julkaise uudelleen.')}</Banner></div>}
            {p.status === 'published' && <div className="mt-4">{res ? <ImpactResult r={res} /> : <p className="text-sm text-muted-ink">{tx('No impact check yet. Collecting data: a full 28-day window is needed.', 'Vaikutuksen tarkistusta ei ole vielä. Dataa kerätään: tarvitaan täysi 28 päivän jakso.')}</p>}</div>}
          </Card>
        );
      })}
    </div>
  );
}
