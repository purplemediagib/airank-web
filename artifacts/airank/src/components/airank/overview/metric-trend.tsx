import { useLocation } from 'wouter';
import type { ProjectAnalytics } from '@workspace/api-client-react';
import { overviewMetrics, overviewTrend, type OverviewMetric } from '@/lib/overview-trends';
import { useQueryParam } from '@/lib/use-query-param';
import { Panel, ReasonNote } from '../primitives';
import { FilterSelect, TrendChart, type Point } from '../data';
import { useL } from '../analytics';

export function MetricTrend({ a, from, days, brand, runId }: { a: ProjectAnalytics; from: string; days: number; brand: string; runId: string }) {
  const L = useL();
  const [location, navigate] = useLocation();
  const [raw, setMetric] = useQueryParam('metric', 'visibility');
  const metric: OverviewMetric = overviewMetrics.includes(raw as OverviewMetric) ? raw as OverviewMetric : 'visibility';
  const labels: Record<OverviewMetric, string> = {
    visibility: L('Näkyvyys', 'Visibility'), share: L('Osuus maininnoista', 'Share of voice'),
    sentiment: L('Sävy', 'Sentiment'), citations: L('Omat lähteet', 'Owned citations'),
    recommendations: L('Suositukset', 'Recommendations'), winRate: L('Ensimmäisen maininnan osuus', 'Tracked-brand win rate'),
    position: L('Sijoitus seurattujen joukossa', 'Tracked-brand position'), listRank: L('Listasijoitus', 'Explicit list rank'),
  };
  const trend = overviewTrend(a, metric, from, days, brand || L('Oma brändi', 'Your brand'), runId);
  const numeric = ['sentiment', 'position', 'listRank'].includes(metric);
  const open = (point: Point) => {
    if (!point.runId || !point.group) return;
    const p = new URLSearchParams(window.location.search);
    p.delete('runId'); p.set('run', String(point.runId)); p.set('group', String(point.group));
    navigate(`${location}?${p}`);
  };
  return (
    <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="chart-title" data-testid="panel-visibility-trend">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="chart-title" className="text-[15px] font-semibold text-ink">{labels[metric]} · {L('ajan mittaan', 'over time')}</h2>
          <p className="text-[11px] text-muted-ink">{L('Sama mittausryhmä kuin yhteenvedossa. Jokainen viiva kuvaa brändiä; puuttuvia mittauksia ei täytetä.', 'Same measurement group as the summary. Each line is a brand; missing measurements are not filled in.')}</p>
        </div>
        <FilterSelect label={L('Mittari', 'Metric')} value={metric} onChange={setMetric} testId="filter-overview-metric" options={overviewMetrics.map(key => ({ value: key, label: labels[key] }))} />
      </div>
      <TrendChart key={metric} title={labels[metric]} withTime series={trend.series} data={trend.data} onPointSelect={open} valueFormat={numeric ? 'number' : 'percent'} valueDomain={metric === 'sentiment' ? [0, 100] : undefined} emptyText={L('Valitulle mittarille ei ole kelvollisia havaintoja. Katso puuttuvien tietojen syyt alta.', 'No usable observations for this metric. See the missing-data explanations below.')} />
      <p className="text-[11px] text-muted-ink" data-testid="text-trend-coverage">{L(`${trend.measuredRuns} / ${trend.runCount} ajoa sisältää tämän mittarin.`, `${trend.measuredRuns} of ${trend.runCount} runs contain this metric.`)} {metric === 'sentiment' ? L('Sävy: 0–100; vain sama analyysiversio ja malli.', 'Sentiment: 0–100; matching analysis version and model only.') : metric === 'position' || metric === 'listRank' ? L('Pienempi sijoitus on parempi.', 'Lower position is better.') : ''}</p>
      {trend.measuredRuns === 1 && <ReasonNote>{L('Vasta yksi mittaus: näytetään havaintopiste, ei vielä trendiä.', 'Only one measurement: this is a snapshot point, not a trend yet.')}</ReasonNote>}
      {trend.competitorCount === 0 && <p className="text-[11px] text-muted-ink">{L('Näissä mittauksissa ei ole tallennettua kilpailijajoukkoa. Nykyisiä kilpailijoita ei lisätä vanhoihin tuloksiin.', 'No frozen competitor cohort is available for these measurements. Current competitors are not added to historical results.')}</p>}
    </Panel>
  );
}
