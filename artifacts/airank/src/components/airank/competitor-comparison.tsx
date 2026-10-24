import type { CompetitorMeasurement } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { toMs } from '@/lib/use-analytics';
import { Panel, StatusBadge } from './primitives';
import { pctText, useL } from './analytics';

export function CompetitorComparison({ cohort }: { cohort: CompetitorMeasurement[] }) {
  const { pct, num, date } = useI18n();
  const L = useL();
  const value = (n: number | null) => pctText(n, pct) ?? '—';
  return (
    <Panel className="min-w-0 space-y-4 p-5" aria-labelledby="comparison-title" data-testid="panel-competitor-comparison">
      <div>
        <h2 id="comparison-title" className="text-base font-semibold text-ink">{L('Kilpailijavertailu', 'Competitor comparison')}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-ink">{L('Seuranta-ajojen tallennettu, mitattu vertailujoukko sisältää myös oman brändin. Vain valittujen seurannan suodattimien mittaukset; ei pikatarkistuksia.', 'The frozen measured cohort from monitoring runs includes your own brand. Measurements use the selected monitoring filters; no quick checks.')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[660px] text-xs" data-testid="table-competitor-comparison">
          <caption className="sr-only">{L('Vertailujoukon mitatut tulokset', 'Measured cohort results')}</caption>
          <thead><tr className="border-b border-line text-left text-muted-ink">
            <th scope="col" className="py-2 pr-3">{L('Brändi', 'Brand')}</th>
            <th scope="col" className="px-2 text-right">{L('Näkyvyys', 'Visibility')}</th>
            <th scope="col" className="px-2 text-right">{L('Suositusaste', 'Recommendation rate')}</th>
            <th scope="col" className="px-2 text-right">{L('Viittausaste', 'Citation rate')}</th>
            <th scope="col" className="px-2 text-right">{L('Kelvolliset / odotetut', 'Eligible / expected')}</th>
            <th scope="col" className="pl-2 text-right">{L('Muutos (pp)', 'Change (pp)')}</th>
          </tr></thead>
          <tbody className="divide-y divide-line">{cohort.map((brand, i) => (
            <tr key={`${brand.brandName}:${i}`} className={brand.isOwned ? 'bg-tint' : ''} data-testid={`row-competitor-${i}`}>
              <th scope="row" className="py-3 pr-3 text-left font-semibold text-ink">{brand.brandName}{brand.isOwned && <StatusBadge tone="info" className="ml-2">{L('Oma brändi', 'Your brand')}</StatusBadge>}</th>
              <td className="tabular px-2 text-right">{value(brand.metrics.visibility)}</td>
              <td className="tabular px-2 text-right">{value(brand.metrics.recommendationRate)}</td>
              <td className="tabular px-2 text-right">{value(brand.metrics.citationRate)}</td>
              <td className="tabular px-2 text-right">{brand.metrics.eligible} / {brand.metrics.expected}</td>
              <td className="tabular pl-2 text-right">{brand.change === null ? '—' : `${brand.change > 0 ? '+' : ''}${num(brand.change, { maximumFractionDigits: 1 })} pp`}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-[11px] leading-5 text-muted-ink" data-testid="text-competitor-change-meaning">{L('Muutos tarkoittaa näkyvyyden prosenttiyksikköeroa valitun aikavälin kahden viimeisimmän kelvollisen ja vertailukelpoisen ajon välillä, ei suhteellista prosenttimuutosta. Viiva tarkoittaa, ettei arvoa ole saatavilla. Puuttuvia vastauksia ei lasketa nolliksi.', 'Change is the percentage-point difference in visibility between the latest two eligible comparable runs in the selected period, not a relative percent change. A dash means unavailable. Missing answers are not counted as zero.')}</p>
      <div className="border-t border-line pt-3">
        <h3 className="text-sm font-semibold text-ink">{L('Näkyvyys ajoittain', 'Visibility by run')}</h3>
        <p className="mt-1 text-xs text-muted-ink">{L('Todelliset mittaukset; saman päivän ajot säilyvät erillisinä.', 'Real measurements; runs on the same day remain separate.')}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[540px] text-xs" data-testid="table-competitor-history">
            <caption className="sr-only">{L('Brändikohtainen näkyvyyshistoria seuranta-ajoista', 'Per-brand visibility history from monitoring runs')}</caption>
            <thead><tr className="border-b border-line text-left text-muted-ink">
              <th scope="col" className="py-2 pr-3">{L('Brändi', 'Brand')}</th><th scope="col" className="px-2">{L('Aika / ajon tunnus', 'Time / run ID')}</th><th scope="col" className="px-2 text-right">{L('Näkyvyys', 'Visibility')}</th><th scope="col" className="pl-2 text-right">{L('Kelvolliset / odotetut', 'Eligible / expected')}</th>
            </tr></thead>
            <tbody className="divide-y divide-line">{cohort.flatMap((brand, i) => brand.runs.length ? [...brand.runs].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).map((run) => (
              <tr key={`${i}:${run.id}`} className={brand.isOwned ? 'bg-tint' : ''} data-testid={`row-competitor-history-${i}-${run.id}`}>
                <th scope="row" className="py-3 pr-3 text-left font-medium">{brand.brandName}{brand.isOwned ? ` · ${L('Oma brändi', 'Your brand')}` : ''}</th>
                <td className="px-2"><time dateTime={new Date(toMs(run.createdAt)).toISOString()}>{date(new Date(toMs(run.createdAt)), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><span className="mt-1 block break-all font-mono text-[10px] text-muted-ink">{run.id}</span></td>
                <td className="tabular px-2 text-right">{value(run.metrics.visibility)}</td>
                <td className="tabular pl-2 text-right">{run.metrics.eligible} / {run.metrics.expected}</td>
              </tr>
            )) : [<tr key={`empty:${i}`}><th scope="row" className="py-3 text-left">{brand.brandName}</th><td colSpan={3} className="px-2 text-muted-ink">{L('Ei ajokohtaisia mittauksia', 'No per-run measurements')}</td></tr>])}</tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
