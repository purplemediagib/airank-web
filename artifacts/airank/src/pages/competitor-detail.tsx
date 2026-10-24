import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { Archive, ArrowLeft, Pencil } from 'lucide-react';
import type { AnalyticsEvidence } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTitle, useI18n } from '@/i18n';
import { writeErrorMessage } from '@/lib/api-errors';
import { useProjects } from '@/lib/project-context';
import { useResearch, useResearchWrite } from '@/lib/use-research';
import { EmptyState, LoadingBlock, PageHeader, Panel, ReasonNote } from '@/components/airank/primitives';
import { ConfirmDialog } from '@/components/airank/forms';
import { useL } from '@/components/airank/analytics';
import { BrandDialog, BrandStatus, Chips, EvidenceLinks, ResearchFailure, brandToDraft } from '@/components/airank/research-parts';

export default function CompetitorDetailPage() {
  const L = useL();
  const { d, num } = useI18n();
  const { toast } = useToast();
  const { id = '' } = useParams<{ id: string }>();
  const { project, projectHref } = useProjects();
  const pid = project?.id ?? '';
  const q = useResearch(pid);
  const write = useResearchWrite(pid);
  const [edit, setEdit] = useState(false);
  const [archive, setArchive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const editBtn = useRef<HTMLButtonElement | null>(null);
  const r = q.data;
  const brand = r?.competitors.find((b) => b.id === id);
  useDocumentTitle(brand?.name ?? L('Kilpailija', 'Competitor'));
  const evidence = useMemo(() => new Map<string, AnalyticsEvidence>((r?.evidence ?? []).map((e) => [e.id, e])), [r]);
  const linked = useMemo(() => (r?.candidates ?? []).filter((c) => c.brandId === id), [r, id]);
  const linkedIds = useMemo(() => [...new Set(linked.flatMap((c) => c.evidenceIds))], [linked]);
  if (!project) return null;
  const readOnly = project.status === 'archived';
  const back = <Link href={projectHref('/dashboard/competitors')} className="mb-2 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-link hover:underline" data-testid="link-back"><ArrowLeft className="size-3.5" aria-hidden />{L('Kilpailijat', 'Competitors')}</Link>;

  if (q.isPending) return <><PageHeader title={L('Kilpailija', 'Competitor')} back={back} /><Panel className="p-4"><LoadingBlock rows={6} /></Panel></>;
  if (q.isError || !r) return <><PageHeader title={L('Kilpailija', 'Competitor')} back={back} /><Panel><ResearchFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel></>;
  if (!brand) return <><PageHeader title={L('Kilpailija', 'Competitor')} back={back} /><Panel><EmptyState title={L('Kilpailijaa ei löytynyt', 'Competitor not found')} body={L('Se voi kuulua toiseen projektiin.', 'It may belong to another project.')} /></Panel></>;

  const send = (body: Parameters<typeof write.mutate>[0]['data'], ok: string, dialog: boolean) => {
    setErr(null);
    write.mutate({ projectId: pid, data: body }, {
      onSuccess: () => { toast({ title: ok }); if (dialog) setEdit(false); },
      onError: (e) => { const m = writeErrorMessage(e, d); if (dialog) setErr(m); else toast({ variant: 'destructive', title: m }); },
    });
  };
  const active = brand.status === 'active';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={brand.name} subtitle={L('Vahvistettu identiteetti ja havaitut vastaukset.', 'Confirmed identity and observed answers.')} back={back}
        actions={active && <div className="flex gap-2">
          <Button ref={editBtn} variant="secondary" disabled={readOnly || write.isPending} onClick={() => { setErr(null); setEdit(true); }} data-testid="button-edit-competitor"><Pencil aria-hidden />{L('Muokkaa', 'Edit')}</Button>
          <ConfirmDialog open={archive} onOpenChange={setArchive} destructive title={L(`Arkistoidaanko ${brand.name}?`, `Archive ${brand.name}?`)} body={L('Brändi poistuu tulevista kohorteista. Aiemmat mittaukset säilyvät.', 'The brand leaves future cohorts. Past measurements are kept.')} confirmLabel={L('Arkistoi', 'Archive')}
            onConfirm={() => send({ action: 'archive', id: brand.id, expectedVersion: r.version }, L('Kilpailija arkistoitu', 'Competitor archived'), false)}
            trigger={<Button variant="ghost" disabled={readOnly || write.isPending} data-testid="button-archive-competitor"><Archive aria-hidden />{L('Arkistoi', 'Archive')}</Button>} />
        </div>} />
      {!active && <ReasonNote tone="warning">{L('Arkistoitu kilpailija ei kuulu tuleviin kohortteihin. Historialliset mittaukset säilyvät.', 'An archived competitor is excluded from future cohorts. Historical measurements are kept.')}</ReasonNote>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Panel className="p-5" aria-labelledby="ident">
          <h2 id="ident" className="text-[16px] font-semibold text-ink">{L('Identiteetti', 'Identity')}</h2>
          <dl className="mt-3 text-sm">
            {[
              [L('Tila', 'Status'), <BrandStatus status={brand.status} />],
              [L('Versio', 'Version'), <span className="tabular">v{brand.version}</span>],
              [L('Aliakset', 'Aliases'), <Chips items={brand.aliases} />],
              [L('Verkkotunnukset', 'Domains'), brand.domains.length ? <Chips items={brand.domains} mono /> : <span className="text-muted-ink">{L('Ei vahvistettu – ei arvata', 'Not confirmed – never guessed')}</span>],
              [L('Kohorttiversio', 'Cohort version'), <span className="tabular">{r.version}</span>],
            ].map(([k, v], i) => <div key={i} className="flex flex-col gap-1 border-b border-line py-2.5 last:border-0"><dt className="text-[12px] text-muted-ink">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p className="mt-3 text-[12px] leading-[18px] text-muted-ink">{L('Vertailu tehdään samoilla neutraaleilla kysymyksillä ja ajoilla kuin oma brändi, ei brändikohtaisilla kysymyksillä.', 'Comparisons use the same neutral questions and runs as your brand, never brand-specific questions.')}</p>
        </Panel>
        <Panel className="p-5" aria-labelledby="ev">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ev" className="text-[16px] font-semibold text-ink">{L('Yhdistetyistä ehdokkaista havaitut vastaukset', 'Answers from linked candidates')}</h2>
            <span className="tabular text-[12px] text-muted-ink" data-testid="text-linked-count">{L(`${num(linked.length)} ehdokasta · ${num(linkedIds.length)} vastausta`, `${num(linked.length)} candidates · ${num(linkedIds.length)} answers`)}</span>
          </div>
          {linked.length > 0 && <p className="mb-3 text-[12px] text-muted-ink">{L('Tunnistetut nimet', 'Extracted names')}: <span className="text-ink">{linked.map((c) => c.name).join(', ')}</span></p>}
          <EvidenceLinks ids={linkedIds} evidence={evidence} testId="list-competitor-evidence" />
        </Panel>
      </div>
      <BrandDialog open={edit} onOpenChange={setEdit} returnFocus={editBtn} title={L('Muokkaa kilpailijaa', 'Edit competitor')} description={L('Muutos luo uuden kohorttiversion.', 'The change creates a new cohort version.')}
        initial={brandToDraft(brand)} pending={write.isPending} error={err} submitLabel={L('Tallenna', 'Save')}
        onSubmit={(v) => send({ action: 'update', id: brand.id, expectedVersion: r.version, ...v }, L('Kilpailija päivitetty', 'Competitor updated'), true)} />
    </div>
  );
}
