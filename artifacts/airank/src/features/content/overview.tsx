import { Link, useLocation } from 'wouter';
import { FilePlus2, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/airank/primitives';
import { useStudio, isActiveJob } from './studio';
import { Banner, Card, DocBadge, JobBadge, Stat, useFmt, useStatusLabels, useTx } from './ui';
import { EditButton, useOpenJob, useRunJob } from './actions';
import { oppKindLabel } from './results';

export function OverviewView() {
  const s = useStudio(); const tx = useTx(); const f = useFmt(); const sl = useStatusLabels(); const [, nav] = useLocation();
  const { run, busy } = useRunJob(); const open = useOpenJob();
  const docs: any[] = s.overview.documents ?? []; const opps: any[] = s.overview.opportunities ?? [];
  const openOpps = opps.filter((o) => ['new', 'in_progress'].includes(o.status));
  const queue = docs.filter((d) => d.status === 'in_review');
  const active = s.jobs.filter(isActiveJob);
  return (
    <div className="flex flex-col gap-5">
      {!s.modelOk && <Banner tone="warning">{tx('AI generation is not configured on this deployment. Editing, saving, review and export still work.', 'Tekoälygenerointia ei ole määritetty. Muokkaus, tallennus, tarkistus ja vienti toimivat silti.')}</Banner>}
      {!s.can.edit && <Banner>{tx('You have read-only access to editing in this project.', 'Sinulla on tässä projektissa vain lukuoikeus muokkaukseen.')}</Banner>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tx('Open opportunities', 'Avoimet mahdollisuudet')} value={f.n(openOpps.length)} />
        <Stat label={tx('Documents', 'Asiakirjat')} value={f.n(docs.length)} sub={`${f.n(docs.filter((d) => d.status === 'draft').length)} ${tx('drafts', 'luonnosta')}`} />
        <Stat label={tx('Awaiting review', 'Odottaa tarkistusta')} value={f.n(queue.length)} />
        <Stat label={tx('Active jobs', 'Aktiiviset työt')} value={f.n(active.length)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <EditButton onClick={() => nav(s.ph('/dashboard/content/library?import=1'))}><Upload aria-hidden /> {tx('Import content', 'Tuo sisältöä')}</EditButton>
        <EditButton variant="secondary" onClick={() => nav(s.ph('/dashboard/content/new'))}><FilePlus2 aria-hidden /> {tx('New content', 'Uusi sisältö')}</EditButton>
        <EditButton variant="secondary" disabled={busy} onClick={async () => open(await run('opportunities', {}))}><Search aria-hidden /> {tx('Find opportunities', 'Etsi mahdollisuudet')}</EditButton>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={tx('Top opportunities', 'Tärkeimmät mahdollisuudet')} actions={<Link href={s.ph('/dashboard/content/opportunities')} className="text-[13px] text-link hover:underline">{tx('All', 'Kaikki')}</Link>}>
          {openOpps.length === 0 ? <EmptyState compact title={tx('No open opportunities', 'Ei avoimia mahdollisuuksia')} body={tx('Run “Find opportunities” to analyse search and AI visibility data.', 'Aja “Etsi mahdollisuudet” analysoidaksesi haku- ja tekoälynäkyvyysdataa.')} /> : (
            <ul className="divide-y divide-line">{openOpps.slice(0, 6).map((o) => <li key={o.id} className="py-2 text-sm"><Link href={s.ph(`/dashboard/content/opportunities?open=${o.id}`)} className="font-medium text-ink hover:underline">{oppKindLabel(tx, o.kind)}</Link><p className="truncate text-[12px] text-muted-ink">{o.url || o.query || o.question}</p></li>)}</ul>
          )}
        </Card>
        <Card title={tx('Review queue', 'Tarkistusjono')}>
          {queue.length === 0 ? <EmptyState compact title={tx('Nothing waiting for review', 'Mikään ei odota tarkistusta')} /> : (
            <ul className="divide-y divide-line">{queue.map((d) => <li key={d.id} className="flex items-center gap-2 py-2 text-sm"><Link href={s.ph(`/dashboard/content/documents/${d.id}`)} className="min-w-0 flex-1 truncate font-medium hover:underline">{d.title || tx('Untitled', 'Nimetön')}</Link><DocBadge status={d.status} /></li>)}</ul>
          )}
        </Card>
        <Card title={tx('Recent drafts', 'Viimeisimmät luonnokset')}>
          {docs.length === 0 ? <EmptyState compact title={tx('No documents yet', 'Ei vielä asiakirjoja')} body={tx('Import an owned page, paste content or start from a brief.', 'Tuo oma sivu, liitä sisältöä tai aloita briefistä.')} /> : (
            <ul className="divide-y divide-line">{docs.slice(0, 6).map((d) => <li key={d.id} className="flex items-center gap-2 py-2 text-sm"><Link href={s.ph(`/dashboard/content/documents/${d.id}`)} className="min-w-0 flex-1 truncate font-medium hover:underline">{d.title || tx('Untitled', 'Nimetön')}</Link><span className="text-[12px] text-muted-ink">{f.d(d.updatedAt)}</span><DocBadge status={d.status} /></li>)}</ul>
          )}
        </Card>
        <Card title={tx('Recent jobs', 'Viimeisimmät työt')} actions={<Link href={s.ph('/dashboard/content/jobs')} className="text-[13px] text-link hover:underline">{tx('All', 'Kaikki')}</Link>}>
          {s.jobs.length === 0 ? <EmptyState compact title={tx('No jobs yet', 'Ei vielä töitä')} /> : (
            <ul className="divide-y divide-line">{s.jobs.slice(0, 6).map((j) => <li key={j.id} className="flex items-center gap-2 py-2 text-sm"><Link href={s.ph(`/dashboard/content/jobs/${j.id}`)} className="min-w-0 flex-1 truncate font-medium hover:underline">{sl.kind[j.kind] ?? j.kind}</Link><JobBadge status={j.status} /></li>)}</ul>
          )}
        </Card>
      </div>
      <p className="text-[12px] text-muted-ink"><Button variant="link" className="h-auto p-0 text-[12px]" onClick={() => nav(s.ph('/dashboard/content/impact'))}>{tx('See impact of published revisions', 'Katso julkaistujen versioiden vaikutus')}</Button></p>
    </div>
  );
}
