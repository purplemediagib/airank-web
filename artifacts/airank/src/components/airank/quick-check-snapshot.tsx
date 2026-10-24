import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import type { QuickCheckReport } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { ProviderMark } from './provider-brand';
import { useQuickCheckSnapshot } from '@/lib/use-quick-check-snapshot';
import { isQuickCheckPending, quickCheckTime, quickCheckVisibility } from '@/lib/quick-check-snapshot-data';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock, Panel, StatusBadge } from './primitives';
import { useL } from './analytics';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MonitoringEntryLink, QuickCheckAnswers } from './saved-quick-checks';

export type ProviderCoverage = { provider: string; success: number; expected: number; failed: number };

/** Only provider_status === 'success' counts as a valid answer; missing or failed answers are unavailable, never zero. */
export function providerCoverage(report: QuickCheckReport): ProviderCoverage[] {
  const rows = new Map<string, ProviderCoverage>();
  const order = [...report.score.providers_requested, ...report.observations.map((o) => o.provider)];
  for (const p of order) if (!rows.has(p)) rows.set(p, { provider: p, success: 0, expected: 0, failed: 0 });
  for (const o of report.observations) {
    const row = rows.get(o.provider)!;
    row.expected += 1;
    if (o.provider_status === 'success') row.success += 1; else row.failed += 1;
  }
  const prompts = report.prompts.length;
  for (const row of rows.values()) if (prompts > row.expected) row.expected = prompts;
  return [...rows.values()];
}

function Gauge({ value, label }: { value: number | null; label: string }) {
  const { num } = useI18n();
  const circumference = Math.PI * 66;
  const progress = value === null ? 0 : Math.max(0, Math.min(10, value)) / 10;
  return (
    <div className="relative mx-auto h-[104px] w-full max-w-[210px]" role="img" aria-label={label}>
      <svg viewBox="0 0 160 92" className="h-full w-full overflow-visible" aria-hidden="true">
        <path d="M 14 82 A 66 66 0 0 1 146 82" fill="none" stroke="#e4ebef" strokeWidth="10" strokeLinecap="round" />
        {value !== null && <path d="M 14 82 A 66 66 0 0 1 146 82" fill="none" stroke="#0da6bb" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${circumference * progress} ${circumference}`} />}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-center gap-1 text-ink">
        <span className="tabular text-4xl font-semibold tracking-tight" data-testid="value-snapshot-score">{value === null ? '—' : num(value, { maximumFractionDigits: 1 })}</span>
        <span className="text-sm font-medium text-muted-ink">/ 10</span>
      </div>
    </div>
  );
}

function Bar({ value, tone = 'teal', testId }: { value: number | null; tone?: 'teal' | 'ink'; testId?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e4ebef]" data-testid={testId}>
      {value !== null && <div className={`h-full rounded-full ${tone === 'teal' ? 'bg-[#0da6bb]' : 'bg-[#46607a]'}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />}
    </div>
  );
}

export function QuickCheckSnapshot({ projectId }: { projectId: string }) {
  const q = useQuickCheckSnapshot(projectId);
  const { href, num, pct, date } = useI18n();
  const L = useL();
  const r = q.snapshot;
  const [showAnswers, setShowAnswers] = useState(false);
  const s = r?.score;
  const stamp = (time: number) => date(new Date(quickCheckTime(time)), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const status = (value: string) => ({
    pending: L('Odottaa', 'Pending'), queued: L('Jonossa', 'Queued'), running: L('Käynnissä', 'Running'), processing: L('Käynnissä', 'Running'),
    completed: L('Valmis', 'Completed'), partial: L('Osittainen', 'Partial'), complete: L('Kattava', 'Complete'),
    failed: L('Epäonnistui', 'Failed'), no_measurements: L('Ei mittauksia', 'No measurements'),
    legacy: L('Vanha menetelmä', 'Legacy method'), unavailable: L('Ei saatavilla', 'Unavailable'),
  }[value] ?? L('Tuntematon tila', 'Unknown status'));
  const evidenceLink = (id: string) => `${href('/start')}?project=${encodeURIComponent(projectId)}&scan=${encodeURIComponent(id)}`;
  const vis = r ? quickCheckVisibility(r) : null;
  const providers = r ? providerCoverage(r) : [];
  const coverage = s && s.expected_answers > 0 ? s.valid_answers / s.expected_answers : null;
  return (
    <Panel className="flex min-w-0 flex-col gap-4 p-5" aria-labelledby="quick-snapshot-title" data-testid="panel-quick-check-snapshot">
      <div>
        <h2 id="quick-snapshot-title" className="text-base font-semibold text-ink">{L('Viimeisimmän pikatarkistuksen tilannekuva', 'Latest quick-check snapshot')}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-ink">{L('Viimeisin valmis tai osittainen pikatarkistus, jossa on kelvollisia vastauksia. Erillinen seurannasta: päivämäärät ja seurannan suodattimet eivät vaikuta tähän.', 'The most recent completed or partial quick check with valid answers. Separate from monitoring: date and monitoring filters do not affect this snapshot.')}</p>
      </div>
      {q.latest && (!r || q.latest.id !== r.id) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-xs" data-testid="status-latest-quick-check">
          <span className="font-medium">{L('Uusin tarkistus', 'Latest check')}</span>
          <StatusBadge tone={isQuickCheckPending(q.latest.status) ? 'info' : 'neutral'}>{status(q.latest.status)}</StatusBadge>
          <span className="text-muted-ink">{stamp(q.latest.created_at)}</span>
          <Link href={evidenceLink(q.latest.id)} className="font-semibold text-link hover:underline" data-testid="link-pending-quick-check">{L('Avaa tarkistus', 'Open check')}</Link>
        </div>
      )}
      {q.isError ? <ErrorState title={L('Pikatarkistusta ei voitu ladata', 'Could not load quick check')} body={L('Seurannan tiedot ladataan erikseen.', 'Monitoring data is loaded independently.')} onRetry={q.refetch} /> :
        q.isPending ? <div aria-busy="true" data-testid="state-snapshot-loading"><LoadingBlock rows={2} /></div> :
        r && s ? <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-ink" data-testid="text-snapshot-timestamp">
            <StatusBadge tone={s.state === 'partial' ? 'warning' : 'neutral'}>{status(r.status)} · {status(s.state)}</StatusBadge>
            <span>{stamp(r.created_at)}</span>
            <span className="text-muted-ink">· {r.domain}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-4">
              <p className="text-xs font-semibold text-muted-ink">{L('Näkyvyyspisteet', 'Visibility score')}</p>
              <Gauge value={s.value} label={s.value === null ? L('Pisteitä ei saatavilla', 'Score unavailable') : `${L('Näkyvyyspisteet', 'Visibility score')}: ${num(s.value, { maximumFractionDigits: 1 })} / 10`} />
              <dl className="mt-1 space-y-3 text-xs">
                <div>
                  <div className="flex justify-between"><dt className="text-muted-ink">{L('Näkyvyys · maininnat / kelvolliset', 'Visibility · mentions / valid')}</dt><dd className="tabular font-semibold text-ink" data-testid="value-snapshot-visibility">{vis === null ? '—' : pct(vis, 1)}</dd></div>
                  <Bar value={vis} testId="bar-snapshot-visibility" />
                  <dd className="tabular mt-1 text-muted-ink" data-testid="value-snapshot-mentions">{s.mentions} / {s.valid_answers}</dd>
                </div>
                <div>
                  <div className="flex justify-between"><dt className="text-muted-ink">{L('Otoksen kattavuus · kelvolliset / odotetut', 'Sample coverage · valid / expected')}</dt><dd className="tabular font-semibold text-ink" data-testid="value-snapshot-coverage">{s.valid_answers} / {s.expected_answers}</dd></div>
                  <Bar value={coverage} tone="ink" />
                </div>
              </dl>
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-line p-4" data-testid="chart-snapshot-providers">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-muted-ink">{L('Kelvolliset vastaukset palveluittain', 'Valid answers by provider')}</p>
                <span className="text-[11px] text-muted-ink">{s.providers_measured.length} / {s.providers_requested.length} {L('palvelua mitattu', 'providers measured')}</span>
              </div>
              {providers.length === 0 ? <p className="text-xs text-muted-ink">{L('Palvelukohtaisia vastauksia ei tallennettu.', 'No provider answers were saved.')}</p> :
                <ul className="flex flex-col gap-3">
                  {providers.map((p) => {
                    const unavailable = p.success === 0;
                    return (
                      <li key={p.provider} data-testid={`row-snapshot-provider-${p.provider}`}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-ink"><ProviderMark provider={p.provider} /></span>
                          <span className="flex items-center gap-2">
                            {unavailable ? <StatusBadge tone="neutral">{L('Ei saatavilla', 'Unavailable')}</StatusBadge> : p.failed > 0 ? <StatusBadge tone="warning">{L('Osittainen', 'Partial')}</StatusBadge> : null}
                            <span className="tabular text-muted-ink" data-testid={`value-snapshot-provider-${p.provider}`}>{p.success} / {p.expected}</span>
                          </span>
                        </div>
                        <Bar value={unavailable ? null : p.expected ? p.success / p.expected : null} />
                      </li>
                    );
                  })}
                </ul>}
              <p className="mt-auto border-t border-line pt-3 text-[11px] leading-4 text-muted-ink">{L('Vain onnistuneet vastaukset ovat kelvollisia. Puuttuvia tai epäonnistuneita vastauksia ei lasketa nolliksi. Kaavio näyttää vastauskattavuuden, ei palvelukohtaista näkyvyyttä.', 'Only successful answers are valid. Missing or failed answers are not counted as zero. This chart shows answer coverage, not per-provider visibility.')}{s.state === 'legacy' ? ` ${L('Pistettä ei laskettu nykyisellä menetelmällä.', 'The score was not calculated with the current method.')}` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button aria-expanded={showAnswers} aria-controls="snapshot-answers" onClick={() => setShowAnswers((v) => !v)} data-testid="button-snapshot-answers">{showAnswers ? L('Piilota tallennetut vastaukset', 'Hide saved answers') : L(`Näytä tallennetut vastaukset (${s.valid_answers})`, `Show saved answers (${s.valid_answers})`)} <ChevronDown className={showAnswers ? 'rotate-180' : ''} aria-hidden /></Button>
            <Button asChild variant="secondary" data-testid="link-snapshot-evidence"><Link href={evidenceLink(r.id)}>{L('Avaa koko raportti', 'Open full report')} <ArrowUpRight aria-hidden /></Link></Button>
          </div>
          {showAnswers && <div id="snapshot-answers" className="rounded-xl border border-line bg-canvas p-3" data-testid="section-snapshot-answers"><QuickCheckAnswers report={r} /></div>}
        </> : <EmptyState title={L('Ei vielä kelvollista pikatarkistusta', 'No useful quick-check snapshot yet')} body={L('Tilannekuva näkyy, kun valmis tai osittainen tarkistus sisältää kelvollisia vastauksia. Seurannan mittareita ei käytetä sen korvikkeena.', 'A snapshot appears when a completed or partial check contains valid answers. Monitoring metrics are not substituted.')} compact />}
      <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-ink">{L('Jatkuva seuranta ajaa seuratut kysymykset erikseen. Käynnistys vaatii aina vahvistuksen.', 'Ongoing monitoring runs tracked prompts separately. Starting always requires confirmation.')}</p>
        <MonitoringEntryLink projectId={projectId} testId="link-snapshot-monitoring" />
      </div>
    </Panel>
  );
}
