import type { ProjectAnalytics } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { metricStateLabel, pctText, useL } from './analytics';

export function CompetitorMetrics({ analytics }: { analytics?: ProjectAnalytics }) {
  const { pct, date } = useI18n();
  const L = useL();
  const brands = analytics?.competitors;
  if (!brands?.length) return (
    <p className="text-xs leading-5 text-muted-ink" data-testid="state-brand-metrics-unavailable">
      {L('Valituissa ajoissa ei ole tallennettua vertailujoukkoa. Brändikohtaiset mittarit eivät ole saatavilla.', 'The selected runs have no recorded comparison cohort. Per-brand metrics are unavailable.')}
    </p>
  );
  const rate = (value: number | null) => pctText(value, pct) ?? L('Ei saatavilla', 'Unavailable');
  return <section className="space-y-3" data-testid="measured-brand-metrics">
    <p className="text-xs leading-5 text-muted-ink">
      {L('Mitattu vertailujoukko', 'Measured cohort')} · {analytics?.market} / {analytics?.language}.
      {' '}{L('Ajankohta, palvelu, aihe ja vertailuryhmä vastaavat yllä valittuja suodattimia. Historialliset brändit voivat poiketa nykyisistä.', 'Uses the date, provider, topic and comparison group filters above. Historical brands may differ from current tracked brands.')}
    </p>
    {brands.map((brand, index) => {
      const m = brand.metrics;
      return <div key={`${brand.brandName}-${index}`} className="rounded-lg border border-line p-3" data-testid={`measured-brand-${index}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{brand.brandName}{brand.isOwned ? ` · ${L('Oma brändi', 'Your brand')}` : ''}</h3>
          <span className="text-xs text-muted-ink">{metricStateLabel(m.state, L)}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div><dt className="text-muted-ink">{L('Näkyvyys', 'Visibility')}</dt><dd className="mt-1 font-semibold">{rate(m.visibility)} <span className="font-normal">({m.mentions}/{m.eligible})</span></dd></div>
          <div><dt className="text-muted-ink">{L('Muutos', 'Change')}</dt><dd className="mt-1 font-semibold">{brand.change === null ? L('Ei saatavilla', 'Unavailable') : `${brand.change > 0 ? '+' : ''}${brand.change} ${L('prosenttiyks.', 'pp')}`}</dd></div>
          <div><dt className="text-muted-ink">{L('Suositukset / luokitellut', 'Recommendations / classified')}</dt><dd className="mt-1">{rate(m.recommendationRate)} ({m.recommended}/{m.classified})</dd></div>
          <div><dt className="text-muted-ink">{L('Brändin lähdeviitteet', 'Brand citations')}</dt><dd className="mt-1">{brand.ownedDomains.length ? <>{rate(m.citationRate)} ({m.ownedCitations}/{m.eligible})</> : L('Ei tallennettuja verkkotunnuksia', 'No recorded domains')}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-ink">{L('Kelvolliset / odotetut vastaukset', 'Eligible / expected answers')}: {m.eligible}/{m.expected} · {L('Kelvolliset / valitut ajot', 'Eligible / selected runs')}: {brand.eligibleRunCount}/{brand.runCount}</p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-link">{L('Ajokohtainen näkyvyys', 'Visibility by run')}</summary>
          <ul className="mt-2 space-y-2">
            {brand.runs.map(run => <li key={run.id} className="flex flex-wrap justify-between gap-2">
              <span>{date(new Date(run.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span>{rate(run.metrics.visibility)} · {run.metrics.mentions}/{run.metrics.eligible} · {L('kattavuus', 'coverage')} {run.metrics.eligible}/{run.metrics.expected}</span>
            </li>)}
          </ul>
        </details>
      </div>;
    })}
    <p className="text-[11px] leading-4 text-muted-ink">{L('Muutos vertaa kahta viimeisintä kelvollista, vertailukelpoista ajoa. Suositusaste lasketaan vain luokitelluista vastauksista; suositusten tunnistus tukee suomea ja englantia. Lähdeviitteet koskevat tallennettuja brändin verkkotunnuksia.', 'Change compares the latest two eligible, comparable runs. Recommendation rates use only classified answers; recommendation extraction supports Finnish and English. Citations refer to the brand domains recorded in the run.')}</p>
  </section>;
}
