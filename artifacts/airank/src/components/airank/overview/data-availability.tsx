import type { ProjectAnalytics } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useI18n } from '@/i18n';
import { selectedGroupRuns } from '@/lib/overview-data';
import { exclusionLabel, useL } from '../analytics';
import { Panel, StatusBadge } from '../primitives';

/** Explain stored data, never imply that viewing this panel queues collection/analysis. */
export function DataAvailability({ a, projectId, onExcluded, runId }: { a: ProjectAnalytics; projectId: string; onExcluded: () => void; runId: string }) {
  const L = useL();
  const { href } = useI18n();
  const m = a.metrics;
  const missing = Math.max(0, m.expected - m.eligible);
  const runs = selectedGroupRuns(a).filter(r => !runId || r.id === runId);
  const reasons = new Map<string, number>();
  for (const e of a.evidence) if (e.exclusion) reasons.set(e.exclusion, (reasons.get(e.exclusion) ?? 0) + 1);
  const states = m.sentiment?.states ?? {};
  const failedAnalysis = (states.failed ?? 0) + (states.analysis_failed ?? 0);
  const pendingAnalysis = (states.queued ?? 0) + (states.analysing ?? 0);
  const topicMetadata = a.overview?.matrix.some(c => c.topic || c.tag);
  return (
    <Panel className="flex flex-col gap-3 p-4" data-testid="panel-data-availability">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{L('Mittausten kattavuus', 'Measurement coverage')}</h2>
        <StatusBadge tone={missing || !m.eligible ? 'warning' : 'success'}>{L(`${m.eligible} / ${m.expected} kelvollista vastausta`, `${m.eligible} / ${m.expected} usable answers`)}</StatusBadge>
      </div>
      <p className="text-[12px] text-muted-ink">{L(`${runs.length} ajoa valitussa ryhmässä. Puuttuvat vastaukset eivät ole nollanäkyvyyttä.`, `${runs.length} runs in the selected group. Missing answers are not zero visibility.`)}</p>
      {missing > 0 && <div className="rounded-lg bg-canvas p-3 text-[12px]" data-testid="coverage-missing">
        <p>{L(`${missing} odotettua vastausta ei ole kelvollisissa mittareissa.`, `${missing} expected answers are not included in valid metrics.`)} <button type="button" className="font-semibold text-link hover:underline" onClick={onExcluded}>{L('Tarkastele vastauksia', 'Inspect answers')}</button></p>
        {reasons.size > 0 && <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{[...reasons].map(([reason, count]) => <li key={reason}>{exclusionLabel(reason, L)}: {count}</li>)}</ul>}
      </div>}
      <ul className="grid gap-2 text-[12px] text-muted-ink md:grid-cols-2">
        {runs.filter(r => r.metrics.eligible > 0).length < 2 && <li data-testid="gap-history">{L('Historia: vähintään kaksi vertailukelpoista havaintoa tarvitaan trendiin. Vanhat päivät jäävät tyhjiksi.', 'History: a trend needs at least two comparable observations. Earlier days stay blank.')}</li>}
        {!a.competitors?.some(b => !b.isOwned) && <li data-testid="gap-competitors">{L('Kilpailijat: näistä ajoista puuttuu tallennettu vertailujoukko.', 'Competitors: these runs have no frozen competitor comparison.')} <Link href={`${href('/dashboard/competitors')}?project=${encodeURIComponent(projectId)}`} className="font-semibold text-link hover:underline">{L('Tarkista kilpailijat', 'Review competitors')}</Link></li>}
        {!topicMetadata && <li data-testid="gap-topics">{L('Aiheet: mitatuissa kysymyksissä ei ole aiheita tai tunnisteita.', 'Topics: measured prompts have no topics or tags.')} <Link href={`${href('/dashboard/prompts')}?project=${encodeURIComponent(projectId)}`} className="font-semibold text-link hover:underline">{L('Hallitse kysymyksiä', 'Manage prompts')}</Link></li>}
        {(!m.sentiment || m.sentiment.state !== 'complete') && <li data-testid="gap-sentiment">
          {L(`Sävy: ${m.sentiment?.sampleSize ?? 0} / ${m.sentiment?.mentionedAnswers ?? 0} mainitsevaa vastausta arvioitu.`, `Sentiment: ${m.sentiment?.sampleSize ?? 0} of ${m.sentiment?.mentionedAnswers ?? 0} mentioning answers assessed.`)}{' '}
          {m.sentiment?.state === 'incomparable' ? L('Eri analyysiversioita tai malleja ei yhdistetä.', 'Different analysis versions or models are not combined.')
            : failedAnalysis ? L(`${failedAnalysis} analyysiä epäonnistui; niitä ei lasketa neutraaleiksi.`, `${failedAnalysis} analyses failed; they are not treated as neutral.`)
            : pendingAnalysis ? L(`${pendingAnalysis} analyysiä odottaa valmistumista.`, `${pendingAnalysis} analyses are queued or running.`)
            : L('Arvioimattomista vastauksista ei päätellä sävyä.', 'Unassessed answers do not imply neutral sentiment.')}
        </li>}
        {m.classified === 0 && <li data-testid="gap-recommendations">{L('Suositukset: yhtään vastausta ei ole luokiteltu. Maininta ei yksin ole suositus.', 'Recommendations: no answers have been classified. A mention alone is not a recommendation.')}</li>}
        {m.citationAnswers === 0 && <li data-testid="gap-citations">{L('Lähteet: viitteitä ei voitu havaita. Tämä ei tarkoita, ettei lähteitä käytetty.', 'Citations: no answers have observable citations. This does not mean no sources were used.')}</li>}
      </ul>
      <p className="text-[11px] text-muted-ink">{L('Tietojen katselu ei käynnistä maksettuja keräyksiä tai analyysejä. Asetusmuutokset koskevat tulevia mittauksia.', 'Viewing this data does not start paid collection or analysis. Settings changes apply to future measurements.')}</p>
    </Panel>
  );
}
