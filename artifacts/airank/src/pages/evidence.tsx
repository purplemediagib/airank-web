import { useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Copy, Download, FileJson } from 'lucide-react';
import type { AnalyticsEvidence } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTitle, useI18n } from '@/i18n';
import { ProviderMark } from '@/components/airank/provider-brand';
import { useProjects } from '@/lib/project-context';
import { toMs } from '@/lib/use-analytics';
import { useEvidenceDetail } from '@/lib/use-research';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, StatusBadge } from '@/components/airank/primitives';
import { exclusionLabel, safeUrl, useL } from '@/components/airank/analytics';
import { RunStatusText } from '@/components/airank/prompt-parts';

function Field({ k, children }: { k: string; children: ReactNode }) {
  return <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-0"><dt className="text-[12px] text-muted-ink">{k}</dt><dd className="break-words text-sm text-ink">{children}</dd></div>;
}

/** Route is read literally from the stored envelope when present; never inferred from provider name. */
function readRoute(raw: Record<string, unknown>): string | null {
  for (const k of ['route', 'transport']) { const v = raw[k]; if (typeof v === 'string' && v) return v; }
  return null;
}

function RawDrawer({ raw, id, open, onOpenChange, returnFocus }: { raw: Record<string, unknown>; id: string; open: boolean; onOpenChange: (v: boolean) => void; returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const L = useL();
  const { toast } = useToast();
  const text = JSON.stringify(raw, null, 2);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast({ title: L('Kopioitu leikepöydälle', 'Copied to clipboard') }); }
    catch { toast({ variant: 'destructive', title: L('Kopiointi ei onnistunut tässä selaimessa', 'Copy failed in this browser') }); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `airank-evidence-${id.replace(/[^\w-]/g, '_')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-2xl" onCloseAutoFocus={(e) => { e.preventDefault(); returnFocus.current?.focus(); }}>
        <SheetHeader>
          <SheetTitle>{L('Tallennettu todistekirje', 'Stored evidence envelope')}</SheetTitle>
          <SheetDescription>{L('Vain luku. Tämä on tallennettu todistekirje, ei palveluntarjoajan täydellinen siirtovastaus, jota ei säilytetä. Arkaluonteiset kentät on poistettu. Yksityinen.', 'Read-only. This is the stored evidence envelope, not the full provider transport response, which is not retained. Sensitive fields are removed. Private.')}</SheetDescription>
        </SheetHeader>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void copy()} data-testid="button-raw-copy"><Copy aria-hidden />{L('Kopioi', 'Copy')}</Button>
          <Button variant="secondary" size="sm" onClick={download} data-testid="button-raw-download"><Download aria-hidden />{L('Lataa JSON', 'Download JSON')}</Button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-canvas p-3 font-mono text-[12px] leading-[18px] text-ink ring-1 ring-line" tabIndex={0} aria-label={L('Raakadata', 'Raw data')} data-testid="text-raw">{text}</pre>
      </SheetContent>
    </Sheet>
  );
}

function Body({ e, raw, rawAvailable }: { e: AnalyticsEvidence; raw: Record<string, unknown>; rawAvailable: boolean }) {
  const L = useL();
  const { date } = useI18n();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const route = e.route || readRoute(raw);
  const when = date(new Date(toMs(e.observedAt)), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
  const ok = e.status === 'success' || e.status === 'completed';
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,340px)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel className="p-5" aria-labelledby="prompt-h">
          <h2 id="prompt-h" className="text-[12px] font-semibold uppercase tracking-wide text-muted-ink">{L('Alkuperäinen kysymys', 'Original prompt')} · v{e.promptVersion}</h2>
          <p className="mt-2 text-[15px] font-medium leading-6 text-ink" data-testid="text-prompt">{e.text}</p>
        </Panel>
        <Panel className="p-5" aria-labelledby="answer-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="answer-h" className="text-[16px] font-semibold text-ink">{L('Alkuperäinen vastaus', 'Original answer')}</h2>
            <Button ref={btn} variant="secondary" size="sm" disabled={!rawAvailable} title={!rawAvailable ? L('Palveluntarjoajan raakavastausta ei tallennettu tälle havainnolle', 'The provider raw response was not retained for this observation') : undefined} onClick={() => setOpen(true)} data-testid="button-open-raw"><FileJson aria-hidden />{L('Todistekirje (JSON)', 'Evidence envelope (JSON)')}</Button>
          </div>
          {!rawAvailable && <p className="mt-2 text-[12px] text-muted-ink">{L('Tallennettua todistekirjettä ei ole saatavilla tälle havainnolle.', 'No stored evidence envelope is available for this observation.')}</p>}
          <p className="mt-3 text-[12px] text-muted-ink">{L('Teksti näytetään alkuperäisellä kielellään, muuttamattomana.', 'Shown verbatim in its original language.')}</p>
          <div className="mt-2 max-h-[560px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-canvas p-4 text-sm leading-6 text-ink ring-1 ring-line" data-testid="text-answer">{e.answer || L('Ei vastaustekstiä', 'No answer text')}</div>
        </Panel>
        {e.recommendationSpans.length > 0 && <Panel className="p-5" aria-labelledby="spans-h">
          <h2 id="spans-h" className="text-[16px] font-semibold text-ink">{L('Suositukseen liittyvät tekstikohdat', 'Recommendation evidence spans')}</h2>
          <ul className="mt-3 flex flex-col gap-1.5">{e.recommendationSpans.map((s, i) => <li key={i} className="rounded-md border-l-2 border-cyan bg-tint px-3 py-1.5 text-sm text-ink">{s}</li>)}</ul>
        </Panel>}
        <Panel className="p-5" aria-labelledby="cit-h">
          <h2 id="cit-h" className="text-[16px] font-semibold text-ink">{L('Rakenteiset lähdeviittaukset', 'Structured citations')} <span className="tabular text-muted-ink">({e.citations.length})</span></h2>
          {e.citations.length ? <ol className="mt-3 flex flex-col gap-1.5 text-sm">{e.citations.map((c, i) => { const u = safeUrl(c); return <li key={i} className="flex gap-2 break-all"><span className="tabular w-5 shrink-0 text-muted-ink">{i + 1}.</span>{u ? <a href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-link hover:underline" data-testid={`link-citation-${i}`}>{c}</a> : <span className="text-ink">{c}</span>}</li>; })}</ol> : <p className="mt-2 text-sm text-muted-ink">{L('Ei viittauksia', 'No citations')}</p>}
        </Panel>
      </div>
      <Panel className="h-fit p-5" aria-labelledby="meta-h">
        <h2 id="meta-h" className="text-[16px] font-semibold text-ink">{L('Havainnon tiedot', 'Observation details')}</h2>
        <dl className="mt-2">
          <Field k={L('Tila', 'Status')}><StatusBadge tone={ok ? 'success' : 'warning'}>{ok ? L('Onnistui', 'Succeeded') : <RunStatusText status={e.status} />}</StatusBadge></Field>
          <Field k={L('Palvelu', 'Provider')}><ProviderMark provider={e.provider} /></Field>
          <Field k={L('Malli', 'Model')}><span className="font-mono text-[13px]">{e.model}</span></Field>
          <Field k={L('Reitti', 'Route')}>{route ? <span className="font-mono text-[13px]">{route}</span> : <span className="text-muted-ink">{L('Ei tallennettu', 'Not recorded')}</span>}</Field>
          <Field k={L('Havaittu', 'Observed')}>{when}</Field>
          <Field k={L('Ajo', 'Run')}><span className="font-mono text-[12px]">{e.runId}</span></Field>
          <Field k={L('Mittareissa', 'In metrics')}>{e.exclusion === null ? L('Kyllä', 'Yes') : `${L('Ei', 'No')} (${exclusionLabel(e.exclusion, L)})`}</Field>
          <Field k={L('Brändimaininta', 'Brand mention')}>{e.mentioned ? L('Mainittu', 'Mentioned') : L('Ei mainintaa', 'Not mentioned')}</Field>
          <Field k={L('Oma lähde viitattu', 'Owned source cited')}>{e.ownedCitation ? L('Kyllä', 'Yes') : L('Ei', 'No')}</Field>
          <Field k={L('Suositusluokitus', 'Recommendation')}>{e.recommendation === 'unknown' ? L('Tuntematon (ei sama kuin ei)', 'Unknown (not the same as no)') : e.recommendation}</Field>
          <Field k={L('Sijainti listassa', 'List position')}>{e.position ?? L('Ei järjestettyä listaa', 'No ordered list')}</Field>
        </dl>
        <p className="mt-3 text-[12px] leading-[18px] text-muted-ink">{L('API-pohjainen havainto, ei kuluttajasovelluksen varmennettu sijoitus.', 'API-based observation, not a verified consumer-app ranking.')}</p>
      </Panel>
      <RawDrawer raw={raw} id={e.id} open={open} onOpenChange={setOpen} returnFocus={btn} />
    </div>
  );
}

export default function EvidencePage() {
  const L = useL();
  const { id = '' } = useParams<{ id: string }>();
  const { project, projectHref } = useProjects();
  const q = useEvidenceDetail(project?.id ?? '', id);
  useDocumentTitle(L('Vastauksen todisteet', 'Response evidence'));
  if (!project) return null;
  const back = <Link href={projectHref('/dashboard/sources')} className="mb-2 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-link hover:underline" data-testid="link-back"><ArrowLeft className="size-3.5" aria-hidden />{L('Lähteet', 'Sources')}</Link>;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L('Vastauksen todisteet', 'Response evidence')} subtitle={L('Alkuperäinen kysymys, vastaus, viittaukset ja luokittelu.', 'Original prompt, answer, citations and classification.')} back={back} />
      {q.isPending ? <Panel className="p-4"><LoadingBlock rows={8} /></Panel>
        : q.notFound ? <Panel><EmptyState title={L('Havaintoa ei löytynyt', 'Observation not found')} body={L('Se voi kuulua toiseen projektiin tai tiliin.', 'It may belong to another project or account.')} /></Panel>
        : q.unavailable ? <Panel><EmptyState title={L('Todisteet eivät ole vielä käytettävissä tällä palvelimella', 'Evidence is not available on this server yet')} /></Panel>
        : q.isError || !q.data ? <Panel><ErrorState onRetry={() => void q.refetch()} /></Panel>
        : <Body e={q.data.evidence} raw={q.data.raw as Record<string, unknown>} rawAvailable={q.data.rawAvailable} />}
    </div>
  );
}
