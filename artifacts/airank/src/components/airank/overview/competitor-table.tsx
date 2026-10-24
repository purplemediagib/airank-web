import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { CompetitorMeasurement } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { EmptyState, Panel } from '../primitives';
import { pctText, useL } from '../analytics';

type Key = 'brand' | 'visibility' | 'cohortShare' | 'sentiment' | 'mentionPosition' | 'winRate' | 'change';

/** Sortable frozen measured cohort (including own brand). Nulls always sort last. */
export function CompetitorTable({ cohort, onBrand }: { cohort: CompetitorMeasurement[] | undefined; onBrand?: (brand: string) => void }) {
  const L = useL();
  const { pct, num } = useI18n();
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'visibility', dir: -1 });
  const val = (b: CompetitorMeasurement, k: Key): number | string | null => {
    if (k === 'brand') return b.brandName;
    if (k === 'change') return b.change;
    if (k === 'sentiment') return b.metrics.sentiment?.state === 'incomparable' ? null : b.metrics.sentiment?.score ?? null;
    if (k === 'mentionPosition') return b.metrics.brandOrder?.meanPosition ?? null;
    if (k === 'winRate') return b.metrics.brandOrder?.winRate ?? null;
    return b.metrics[k] ?? null;
  };
  const rows = [...(cohort ?? [])].sort((x, y) => {
    const a = val(x, sort.key); const b = val(y, sort.key);
    if (a === null && b === null) return 0;
    if (a === null) return 1; if (b === null) return -1;
    return (typeof a === 'string' ? a.localeCompare(String(b)) : a - (b as number)) * sort.dir;
  });
  const th = (k: Key, label: string, right = true) => {
    const active = sort.key === k;
    return (
      <th scope="col" className={right ? 'px-2 text-right' : 'py-2 pr-2 text-left'} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : k === 'brand' ? 1 : -1 })} data-testid={`sort-competitor-${k}`}>
          {label}{active ? (sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : <ChevronsUpDown className="size-3 opacity-50" aria-hidden />}
        </button>
      </th>
    );
  };
  return (
    <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="cmp-title" data-testid="panel-competitor-comparison">
      <div>
        <h2 id="cmp-title" className="text-[15px] font-semibold text-ink">{L('Vertailujoukko', 'Brand comparison')}</h2>
        <p className="text-[11px] text-muted-ink">{L('Sijoitus ja voitot koskevat vain ajoihin tallennettuja seurattuja brändejä. Muutos = kahden viimeisimmän vertailukelpoisen ajon näkyvyysero.', 'Position and wins cover only frozen tracked brands. Change = visibility difference between the latest two comparable runs.')}</p>
      </div>
      {cohort === undefined ? <EmptyState compact title={L('Vaatii taustapalvelun päivityksen', 'Backend upgrade needed')} body={L('Tämä palvelin ei palauta mitattua vertailujoukkoa.', 'This server does not return the measured cohort.')} />
        : rows.length === 0 ? <EmptyState compact title={L('Vertailujoukkoa ei tallennettu', 'No cohort recorded')} body={L('Valituissa ajoissa ei ollut seurattuja kilpailijoita. Lukuja ei päätellä.', 'Selected runs recorded no tracked competitors. No figures are inferred.')} />
        : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12px]" data-testid="table-competitor-comparison">
              <caption className="sr-only">{L('Vertailujoukon mitatut tulokset', 'Measured cohort results')}</caption>
              <thead><tr className="border-b border-line text-[11px] text-muted-ink"><th scope="col" className="w-6 py-2 text-left">#</th>{th('brand', L('Brändi', 'Brand'), false)}{th('visibility', L('Näkyvyys', 'Visibility'))}{th('cohortShare', L('Osuus', 'SoV'))}{th('sentiment', L('Sävy', 'Sentiment'))}{th('mentionPosition', L('Sijoitus', 'Position'))}{th('winRate', L('Voitot', 'Win rate'))}{th('change', L('Muutos', 'Change'))}</tr></thead>
              <tbody className="divide-y divide-line">{rows.map((b, i) => (
                <tr key={`${b.brandName}:${i}`} className={b.isOwned ? 'bg-tint' : ''} data-testid={`row-competitor-${i}`}>
                  <td className="tabular py-2 text-muted-ink">{i + 1}</td>
                  <th scope="row" className="py-2 pr-2 text-left font-semibold text-ink">{onBrand ? <button type="button" onClick={() => onBrand(b.brandName)} className="text-link hover:underline" aria-label={L(`Näytä brändin ${b.brandName} vastaukset`, `View answers mentioning ${b.brandName}`)}>{b.brandName}</button> : b.brandName}{b.isOwned && <span className="ml-1.5 rounded bg-navy px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white">{L('Oma', 'You')}</span>}</th>
                  <td className="tabular px-2 text-right">{pctText(b.metrics.visibility, pct) ?? '–'}</td>
                  <td className="tabular px-2 text-right">{pctText(b.metrics.cohortShare, pct) ?? '–'}</td>
                  <td className="tabular px-2 text-right">{val(b, 'sentiment') === null ? '–' : num(val(b, 'sentiment') as number, { maximumFractionDigits: 1 })}</td>
                  <td className="tabular px-2 text-right">{b.metrics.brandOrder?.meanPosition == null ? '–' : num(b.metrics.brandOrder.meanPosition, { maximumFractionDigits: 1 })}</td>
                  <td className="tabular px-2 text-right">{pctText(b.metrics.brandOrder?.winRate ?? null, pct) ?? '–'}</td>
                  <td className={`tabular px-2 text-right ${b.change === null ? 'text-muted-ink' : b.change > 0 ? 'text-success' : b.change < 0 ? 'text-danger' : ''}`}>{b.change === null ? '–' : `${b.change > 0 ? '+' : ''}${num(b.change, { maximumFractionDigits: 1 })} pp`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
    </Panel>
  );
}
