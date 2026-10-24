import type { AnalyticsProvider, AnalyticsEvidence } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { EmptyState, Panel, StatusBadge } from '../primitives';
import { exclusionLabel, metricStateLabel, pctText, useL } from '../analytics';
import { ProviderMark } from '../provider-brand';

/** Per-provider coverage: visibility over eligible answers plus collection coverage eligible/expected. */
export function ProviderCoverage({ providers, evidence = [] }: { providers: AnalyticsProvider[]; evidence?: AnalyticsEvidence[] }) {
  const L = useL();
  const { pct } = useI18n();
  return (
    <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="prov-title" data-testid="panel-provider-coverage">
      <div>
        <h2 id="prov-title" className="text-[15px] font-semibold text-ink">{L('Palvelut', 'Provider coverage')}</h2>
        <p className="text-[11px] text-muted-ink">{L('Näkyvyys kelvollisista; palkki = kelvolliset / odotetut. Puuttuvia ei lasketa nolliksi.', 'Visibility over eligible; bar = eligible / expected. Missing answers are not zero.')}</p>
      </div>
      {providers.length === 0 ? <EmptyState compact title={L('Ei palvelukohtaisia tuloksia', 'No provider results')} body={L('Valitulla suodatuksella ei ole tuloksia.', 'No results for the selected filters.')} /> : (
        <ul className="flex flex-col gap-2.5" data-testid="list-providers">
          {providers.map((p) => {
            const m = p.metrics;
            const cov = m.expected ? m.eligible / m.expected : 0;
            const reasons = new Map<string, number>();
            for (const e of evidence) if (e.provider === p.provider && e.exclusion) reasons.set(e.exclusion, (reasons.get(e.exclusion) ?? 0) + 1);
            return (
              <li key={p.provider} data-testid={`row-provider-${p.provider}`}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-ink"><ProviderMark provider={p.provider} />{m.state !== 'complete' && <StatusBadge tone={m.state === 'unavailable' ? 'neutral' : 'warning'}>{metricStateLabel(m.state, L).split(';')[0]}</StatusBadge>}</span>
                  <span className="flex items-baseline gap-2"><span className="tabular text-[11px] text-muted-ink">{m.eligible}/{m.expected}</span><span className="tabular w-14 text-right font-semibold text-ink">{pctText(m.visibility, pct) ?? '–'}</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden><div className="h-full origin-left rounded-full bg-cyan" style={{ transform: `scaleX(${cov})` }} /></div>
                {reasons.size > 0 && <p className="mt-1 text-[11px] text-muted-ink" data-testid={`provider-reasons-${p.provider}`}>{[...reasons].map(([reason, count]) => `${exclusionLabel(reason, L)}: ${count}`).join(' · ')}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
