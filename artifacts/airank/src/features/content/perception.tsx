import { EmptyState } from '@/components/airank/primitives';
import { StatusBadge } from '@/components/airank/primitives';
import { isActiveJob, jobsFor, useRecords, useStudio } from './studio';
import { Banner, Card, ExtLink, JobBadge, useFmt, useTx } from './ui';
import { PaidButton, useOpenJob, useRunJob } from './actions';
import { PerceptionResult } from './results';

export function PerceptionView() {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const { run, busy } = useRunJob(); const open = useOpenJob();
  const as = useRecords('assessments');
  const facts: any[] = s.overview.brand?.facts ?? [];
  const jobs = jobsFor(s.jobs, 'perception');
  const latest = jobs.find((j) => j.status === 'completed');
  const saved = (as.data ?? []).find((a) => a.kind === 'perception');
  const result = latest?.result ?? saved;
  const running = jobs.find(isActiveJob);
  const verified = facts.filter((x) => x.verified);
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card title={tx('Verified brand facts', 'Varmennetut brändifaktat')}>
        {facts.length === 0 ? <EmptyState compact title={tx('No brand facts yet', 'Ei vielä brändifaktoja')} body={tx('Add and verify facts in Settings → Brand. Without a verified fact nothing is flagged as inaccurate.', 'Lisää ja varmenna faktat Asetukset → Brändi. Ilman varmennettua faktaa mitään ei merkitä virheelliseksi.')} /> : (
          <ul className="space-y-3 text-sm">{facts.map((x) => <li key={x.id}><div className="flex items-center gap-2"><StatusBadge tone={x.verified ? 'success' : 'neutral'} dot={false}>{x.verified ? tx('Verified', 'Varmennettu') : tx('Unverified', 'Varmentamaton')}</StatusBadge></div><p className="mt-1">{x.statement}</p>{x.sourceUrl && <p className="text-[12px]"><ExtLink href={x.sourceUrl} /></p>}</li>)}</ul>
        )}
      </Card>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted-ink">{tx('Compares verbatim AI answers from your monitoring with your verified facts.', 'Vertaa seurannan aitoja tekoälyvastauksia varmennettuihin faktoihisi.')}</p>
          {running && <JobBadge status={running.status} />}
          <PaidButton disabled={busy || !!running} onClick={async () => open(await run('perception', {}))}>{tx('Assess AI perception', 'Arvioi tekoälyn brändikuva')}</PaidButton>
        </div>
        {verified.length === 0 && <Banner tone="warning">{tx('No verified facts: findings can only be “unsupported”, “missing strength” or “aligned”, never proven inaccurate.', 'Ei varmennettuja faktoja: havainnot voivat olla vain “tukematon”, “puuttuva vahvuus” tai “linjassa”, ei koskaan todistetusti virheellinen.')}</Banner>}
        {latest && <p className="text-[12px] text-muted-ink">{tx('Latest assessment', 'Viimeisin arvio')}: {f.dt(latest.updated_at)}</p>}
        {result ? <PerceptionResult r={result} /> : <EmptyState title={tx('No assessment yet', 'Ei vielä arviota')} body={tx('Run an assessment once your monitoring has collected answers.', 'Aja arvio, kun seuranta on kerännyt vastauksia.')} />}
      </div>
    </div>
  );
}
