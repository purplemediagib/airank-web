import type { EvidenceMetric, ProjectAnalytics } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { useAnalytics, useAnalyticsFilters } from '@/lib/use-analytics';
import { checkPromptScope, findPromptSummary, hasMeasurements } from '@/lib/prompt-metrics';
import { FilterSelect, KpiCard } from './data';
import { EmptyState, LoadingBlock, ReasonNote } from './primitives';
import { GroupTrend, groupLabel, metricStateLabel, pctText, useL, AnalyticsFailure } from './analytics';

type Lf = (fi: string, en: string) => string;

function sentimentValue(m: EvidenceMetric, num: (n: number, o?: Intl.NumberFormatOptions) => string) {
  const s = m.sentiment;
  if (!s || s.state === 'incomparable' || s.score === null || s.score === undefined) return null;
  return `${num(s.score, { maximumFractionDigits: 1 })} / 100`;
}

/** Visibility / recommendation / sentiment cells for one prompt row, from the shared project analytics response (no per-row fetch). */
export function PromptMetricCells({ a, promptId, version, loading }: { a: ProjectAnalytics | undefined; promptId: string; version: number; loading: boolean }) {
  const L = useL();
  const { pct, num } = useI18n();
  const cell = 'flex items-baseline gap-2 text-[13px] md:table-cell md:px-3 md:text-right';
  const labels = { visibility: L('Näkyvyys', 'Visibility'), recommendations: L('Suositusosuus', 'Recommendation rate'), sentiment: L('Sävy', 'Sentiment') };
  const mLabel = (k: keyof typeof labels) => <span className="min-w-[130px] text-[12px] text-muted-ink md:hidden">{labels[k]}</span>;
  const summary = findPromptSummary(a, promptId, version);
  const keys = ['visibility', 'recommendations', 'sentiment'] as const;
  if (loading || !a || summary === null || summary === undefined) {
    const note = loading ? L('Ladataan', 'Loading') : !a ? L('Analytiikka ei saatavilla', 'Analytics unavailable') : summary === null ? L('Taustapalvelun päivitys vaaditaan kysymyskohtaisiin mittareihin', 'Backend update required for prompt metrics') : L(`Ei mittauksia versiolle v${version}`, `No measurements for v${version}`);
    return <>{keys.map((k) => <td key={k} className={`${cell} text-[#b4bdcb]`} title={note} data-testid={`value-perf-${k}-${promptId}`}>{mLabel(k)}<span aria-hidden>–</span><span className="sr-only">{note}</span></td>)}</>;
  }
  const m = summary.metrics;
  const scope = L(`v${version} · ${summary.runCount} ajoa${summary.groupCount > 1 ? ` · uusin ${summary.groupCount} kokoonpanosta` : ''}`, `v${version} · ${summary.runCount} runs${summary.groupCount > 1 ? ` · latest of ${summary.groupCount} compositions` : ''}`);
  const vals: Record<(typeof keys)[number], [string | null, string]> = {
    visibility: [pctText(m.visibility, pct), `${m.mentions} / ${m.eligible}`],
    recommendations: [pctText(m.recommendationRate, pct), `${m.recommended} / ${m.classified}`],
    sentiment: [sentimentValue(m, num), m.sentiment?.state === 'incomparable' ? L('ei vertailukelp.', 'incomparable') : `n=${m.sentiment?.sampleSize ?? 0}`],
  };
  return <>{keys.map((k) => (
    <td key={k} className={cell} title={scope} data-testid={`value-perf-${k}-${promptId}`}>
      {mLabel(k)}
      <span className="tabular text-ink md:block">{vals[k][0] ?? '–'}</span>
      <span className="tabular text-[11px] text-muted-ink md:block md:text-[10px]">{vals[k][1]}</span>
    </td>
  ))}</>;
}

export function scopedCards(m: EvidenceMetric, L: Lf, pct: (n: number, d?: number) => string, num: (n: number, o?: Intl.NumberFormatOptions) => string) {
  const s = m.sentiment;
  return [
    { id: 'visibility', label: L('Näkyvyys', 'Visibility'), value: pctText(m.visibility, pct), definition: L('Brändin maininneet kelvolliset vastaukset.', 'Eligible answers that mention the brand.'), sample: L(`${m.mentions} / ${m.eligible} kelvollista vastausta`, `${m.mentions} of ${m.eligible} eligible answers`) },
    { id: 'recommendations', label: L('Suositusosuus', 'Recommendation rate'), value: pctText(m.recommendationRate, pct), definition: L('Suositellut vastaukset luokitelluista.', 'Recommended answers among classified ones.'), sample: L(`${m.recommended} / ${m.classified} luokiteltua`, `${m.recommended} of ${m.classified} classified`) },
    { id: 'owned-citations', label: L('Omat lähdeviittaukset', 'Owned-site citations'), value: pctText(m.citationRate, pct), definition: L('Kelvolliset vastaukset, joissa viitataan omaan sivustoon.', 'Eligible answers citing an owned domain.'), sample: L(`${m.ownedCitations} / ${m.eligible} kelvollista vastausta`, `${m.ownedCitations} of ${m.eligible} eligible answers`) },
    { id: 'sentiment', label: L('Brändin sävy', 'Brand sentiment'), value: sentimentValue(m, num), definition: s?.state === 'incomparable' ? L('Analyysiversiot eivät ole vertailukelpoisia; lukua ei näytetä.', 'Analysis versions are incomparable; no number shown.') : L('Arvioitujen mainintojen keskimääräinen sävy.', 'Average tone of assessed mentions.'), sample: s ? L(`n=${s.sampleSize ?? 0} · kattavuus ${s.coverage == null ? '–' : pct(s.coverage / 100, 1)}`, `n=${s.sampleSize ?? 0} · coverage ${s.coverage == null ? '–' : pct(s.coverage / 100, 1)}`) : L('Sävytietoja ei toimitettu', 'No sentiment data supplied') },
  ];
}

/** Current-version prompt metrics, verified against the response's promptScope before any number is displayed. */
export function PromptScopedMetrics({ projectId, promptId, version }: { projectId: string; promptId: string; version: number }) {
  const L = useL();
  const { pct, num } = useI18n();
  const f = useAnalyticsFilters();
  const params = { ...f.params, promptId, promptVersion: version };
  const q = useAnalytics(projectId, params);
  const head = (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
      <div>
        <h3 className="text-[14px] font-semibold text-ink">{L(`Nykyisen version v${version} mittarit`, `Current version v${version} metrics`)}</h3>
        <p className="mt-0.5 text-[11px] text-muted-ink">{L(`Vain v${version}, viimeiset ${f.days} päivää. Alla olevat vastaukset sisältävät kaikki versiot.`, `v${version} only, last ${f.days} days. Answers below include all versions.`)}</p>
      </div>
      {!q.accessDenied && q.data && q.data.groups.length > 1 && checkPromptScope(q.data, promptId, version) === 'match' && (
        <FilterSelect label={L('Kokoonpano', 'Composition')} value={q.data.selectedGroup ?? f.group} onChange={f.setGroup} testId="select-prompt-group" options={q.data.groups.map((g) => ({ value: g.id, label: groupLabel(q.data, g.id, L) }))} />
      )}
    </div>
  );
  if (q.isPending) return <section data-testid="section-prompt-metrics">{head}<div className="p-5"><LoadingBlock rows={2} /></div></section>;
  if (q.accessDenied || !q.data) return <section data-testid="section-prompt-metrics">{head}<AnalyticsFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></section>;
  const a = q.data;
  const scope = checkPromptScope(a, promptId, version);
  if (scope !== 'match') return (
    <section data-testid="section-prompt-metrics">{head}
      <div className="px-5 py-3" data-testid="text-prompt-scope-mismatch"><ReasonNote tone="warning">{L('Taustapalvelu ei rajannut analytiikkaa tähän kysymysversioon. Kysymyskohtaiset mittarit vaativat taustapalvelun päivityksen; projektin lukuja ei näytetä kysymyksen lukuina.', 'The backend did not scope analytics to this prompt version. Prompt metrics require a backend update; project numbers are never shown as prompt numbers.')}</ReasonNote></div>
    </section>
  );
  if (!hasMeasurements(a.metrics)) return <section data-testid="section-prompt-metrics">{head}<EmptyState compact title={L('Ei mittauksia tälle versiolle', 'No measurements for this version')} body={L('Mittarit näkyvät valmiin seuranta-ajon jälkeen.', 'Metrics appear after a completed monitoring run.')} /></section>;
  return (
    <section data-testid="section-prompt-metrics" aria-label={L('Kysymyksen mittarit', 'Prompt metrics')}>
      {head}
      {q.isError && <div className="px-5 pt-2"><ReasonNote tone="warning">{L('Päivitys epäonnistui. Näytetään viimeksi haetut mittarit.', 'Refresh failed. Showing the last loaded metrics.')}</ReasonNote></div>}
      <div className="grid grid-cols-2 gap-3 px-5 pt-3 xl:grid-cols-4">
        {scopedCards(a.metrics, L, pct, num).map((c) => <KpiCard key={c.id} testId={`prompt-${c.id}`} label={c.label} value={c.value} definition={c.definition} sample={c.sample} />)}
      </div>
      <p className="px-5 pt-2 text-[11px] text-muted-ink" data-testid="text-prompt-metric-scope">{L(`Kokoonpano: ${a.selectedGroup ? groupLabel(a, a.selectedGroup, L) : '–'} · ${metricStateLabel(a.metrics.state, L)}`, `Composition: ${a.selectedGroup ? groupLabel(a, a.selectedGroup, L) : '–'} · ${metricStateLabel(a.metrics.state, L)}`)}</p>
      <div className="px-5 pt-3"><GroupTrend a={a} from={f.from} days={f.days} /></div>
    </section>
  );
}
