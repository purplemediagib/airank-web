import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, ChevronDown, Radar } from 'lucide-react';
import { getGetQuickCheckQueryKey, getListProjectQuickChecksQueryKey, useGetQuickCheck, useListProjectQuickChecks } from '@workspace/api-client-react';
import type { QuickCheckReport } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { ProviderMark } from './provider-brand';
import { useAccount } from '@/lib/account';
import { isQuickCheckPending, quickCheckTime, sortedQuickChecks } from '@/lib/quick-check-snapshot-data';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock, Panel, StatusBadge } from './primitives';
import { useL } from './analytics';

/** Groups saved quick-check observations by the quick check's own prompts. Never linked to tracked prompts. */
export function quickCheckAnswersByPrompt(report: QuickCheckReport) {
  const prompts = [...report.prompts].sort((a, b) => a.sequence - b.sequence);
  return prompts.map((p) => ({ prompt: p, observations: report.observations.filter((o) => o.prompt_id === p.id) }));
}

/** Monitoring entry point: navigates to the Prompts runs tab where the existing confirmation dialog must be used. Never auto-runs. */
export function MonitoringEntryLink({ projectId, label, testId, variant = 'secondary' }: { projectId: string; label?: string; testId: string; variant?: 'default' | 'secondary' | 'ghost' }) {
  const { href } = useI18n();
  const L = useL();
  return (
    <Button asChild variant={variant} size="sm" data-testid={testId}>
      <Link href={`${href('/dashboard/prompts')}?project=${encodeURIComponent(projectId)}&tab=runs`}><Radar aria-hidden />{label ?? L('Siirry seurantaan (vahvistus vaaditaan)', 'Go to monitoring (confirmation required)')}</Link>
    </Button>
  );
}

export function QuickCheckAnswers({ report }: { report: QuickCheckReport }) {
  const L = useL();
  const groups = quickCheckAnswersByPrompt(report);
  if (!groups.length) return <p className="text-xs text-muted-ink">{L('Tarkistukseen ei tallennettu kysymyksiä.', 'No prompts were saved for this check.')}</p>;
  return (
    <ol className="flex flex-col gap-3" data-testid={`list-quick-answers-${report.id}`}>
      {groups.map(({ prompt, observations }) => (
        <li key={prompt.id} className="rounded-lg border border-line bg-white p-3">
          <p className="text-sm font-semibold text-ink"><span className="tabular mr-2 text-muted-ink">{prompt.sequence}.</span>{prompt.prompt_text}</p>
          {!observations.length ? <p className="mt-2 text-xs text-muted-ink">{L('Ei tallennettuja vastauksia.', 'No saved answers.')}</p> : (
            <ul className="mt-2 flex flex-col gap-2">
              {observations.map((o, i) => (
                <li key={`${o.provider}-${i}`} className="rounded-md bg-canvas p-2.5 text-xs" data-testid={`quick-answer-${prompt.id}-${o.provider}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink"><ProviderMark provider={o.provider} /></span>
                    {o.model && <span className="font-mono text-[11px] text-muted-ink">{o.model}</span>}
                    {o.provider_status !== 'success' && <StatusBadge tone="neutral">{o.provider_status === 'incomplete' ? L('Keskeneräinen · ei mukana mittareissa', 'Incomplete · excluded from metrics') : L('Ei saatavilla', 'Unavailable')}</StatusBadge>}
                  </div>
                  {o.answer_text
                    ? <p className="whitespace-pre-wrap break-words leading-5 text-ink">{o.answer_text}</p>
                    : <p className="text-muted-ink">{L('Vastausta ei saatu; ei lasketa nollaksi.', 'No answer received; not counted as zero.')}</p>}
                  {o.citations.length > 0 && <p className="mt-1 text-[11px] text-muted-ink">{L('Lähdeviittauksia', 'Citations')}: {o.citations.length}</p>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function CheckRow({ id, projectId, status, createdAt, domain }: { id: string; projectId: string; status: string; createdAt: number; domain: string }) {
  const L = useL();
  const { href, date } = useI18n();
  const uid = useAccount().user?.id;
  const [open, setOpen] = useState(false);
  const pending = isQuickCheckPending(status);
  const r = useGetQuickCheck(id, { query: { queryKey: [...getGetQuickCheckQueryKey(id), uid], enabled: open && !!uid, staleTime: 30_000 } });
  const report = r.data?.project_id === projectId ? r.data : undefined;
  const valid = report ? report.observations.filter((o) => o.provider_status === 'success').length : null;
  const statusLabel = ({
    completed: L('Valmis', 'Completed'), failed: L('Epäonnistui', 'Failed'),
    partial: L('Osittainen', 'Partial'), pending: L('Odottaa', 'Pending'),
    queued: L('Jonossa', 'Queued'), running: L('Käynnissä', 'Running'),
    processing: L('Käynnissä', 'Processing'),
  } as Record<string, string>)[status] ?? L('Tuntematon tila', 'Unknown status');
  return (
    <li className="py-3" data-testid={`row-quick-check-${id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-expanded={open} aria-controls={`qc-${id}`} disabled={pending} onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-left text-sm font-semibold text-ink hover:text-link disabled:opacity-60" data-testid={`button-toggle-quick-check-${id}`}>
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          {date(new Date(quickCheckTime(createdAt)), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </button>
        <StatusBadge tone={pending ? 'info' : status === 'failed' ? 'warning' : 'neutral'}>{statusLabel}</StatusBadge>
        <span className="text-xs text-muted-ink">{domain}</span>
        <Link href={`${href('/start')}?project=${encodeURIComponent(projectId)}&scan=${encodeURIComponent(id)}`} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline" data-testid={`link-quick-check-report-${id}`}>{L('Koko raportti', 'Full report')} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
      </div>
      {open && (
        <div id={`qc-${id}`} className="mt-2">
          {r.isPending ? <LoadingBlock rows={2} /> : r.isError || !report ? <ErrorState onRetry={() => void r.refetch()} /> : <>
            <p className="mb-2 text-xs text-muted-ink">{L('Kelvolliset vastaukset', 'Valid answers')}: <span className="tabular font-semibold text-ink">{valid} / {report.score.expected_answers}</span></p>
            <QuickCheckAnswers report={report} />
          </>}
        </div>
      )}
    </li>
  );
}

/** Every saved quick check for the project, newest first, with on-demand saved answers. */
export function SavedQuickChecks({ projectId }: { projectId: string }) {
  const L = useL();
  const uid = useAccount().user?.id;
  const list = useListProjectQuickChecks(projectId, { query: { queryKey: [...getListProjectQuickChecksQueryKey(projectId), uid], enabled: !!projectId && !!uid, staleTime: 30_000 } });
  const checks = sortedQuickChecks(list.data ?? []);
  return (
    <Panel className="flex flex-col gap-2 p-5" aria-labelledby="saved-quick-title" data-testid="panel-all-quick-checks">
      <div>
        <h2 id="saved-quick-title" className="text-base font-semibold text-ink">{L('Kaikki tallennetut pikatarkistukset', 'All saved quick checks')}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-ink">{L('Kertaluonteisia tarkistuksia omilla kysymyksillään. Niitä ei yhdistetä seurattuihin kysymyksiin eikä seurannan trendeihin.', 'One-off checks with their own prompts. They are not linked to tracked prompts or monitoring trends.')}</p>
      </div>
      {list.isPending ? <LoadingBlock rows={3} /> : list.isError ? <ErrorState onRetry={() => void list.refetch()} /> : !checks.length
        ? <EmptyState compact title={L('Ei tallennettuja pikatarkistuksia', 'No saved quick checks')} />
        : <ul className="divide-y divide-line" data-testid="list-all-quick-checks">{checks.map((c) => <CheckRow key={c.id} id={c.id} projectId={projectId} status={c.status} createdAt={c.created_at} domain={c.domain} />)}</ul>}
    </Panel>
  );
}
