import { Link } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import type { SentimentAttribute } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle, useI18n } from '@/i18n';
import { useProjects } from '@/lib/project-context';
import { useAnalytics, useAnalyticsFilters } from '@/lib/use-analytics';
import { ProviderMark } from '@/components/airank/provider-brand';
import { EmptyState, LoadingBlock, PageHeader, Panel, ReasonNote } from '@/components/airank/primitives';
import { AnalyticsFilterBar } from '@/components/airank/analytics-filters';
import { AnalyticsFailure, useL } from '@/components/airank/analytics';
import { LabelDistribution, SentimentGroups, SentimentScoreCard, sentimentWaiting } from '@/components/airank/sentiment';

function attrLabel(a: SentimentAttribute) {
  const r = a as SentimentAttribute & { attribute?: string; name?: string };
  return r.label ?? r.attribute ?? r.name ?? '–';
}

export default function PerceptionPage() {
  const L = useL();
  const { num, pct } = useI18n();
  const { project, projectHref } = useProjects();
  const projectId = project?.id ?? '';
  const f = useAnalyticsFilters();
  const q = useAnalytics(projectId, f.params);
  useDocumentTitle(L('Mielikuva', 'Perception'));
  const resultsHref = projectHref('/dashboard/results');
  const evidenceHref = (id: string) => projectHref(`/dashboard/results/${encodeURIComponent(id)}`);
  const header = <PageHeader title={L('Mielikuva', 'Perception')} subtitle={L('Miten tekoälypalvelut kuvaavat brändiä tallennetuissa vastauksissa. Jokainen arvio palaa alkuperäiseen lainaukseen.', 'How AI providers portray the brand in saved answers. Every assessment traces back to an exact quote.')} actions={<Button asChild variant="secondary"><Link href={resultsHref} data-testid="link-view-answers">{L('Näytä vastaukset', 'View answers')} <ArrowUpRight aria-hidden /></Link></Button>} />;
  if (q.isPending) return <div className="flex flex-col gap-5">{header}<Panel className="p-6"><LoadingBlock rows={6} /></Panel></div>;
  if (q.accessDenied || !q.data) return <div className="flex flex-col gap-5">{header}<Panel><AnalyticsFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel></div>;
  const a = q.data;
  const s = a.metrics.sentiment;
  const w = sentimentWaiting(s);
  const competitors = (a.competitors ?? []).filter((c) => c.metrics.sentiment);
  return (
    <div className="flex flex-col gap-5" data-testid="page-perception">
      {header}
      {q.isError && <ReasonNote tone="warning">{L('Päivitys epäonnistui. Näytetään viimeksi haetut mittarit.', 'Refresh failed. Showing the last loaded metrics.')}</ReasonNote>}
      <AnalyticsFilterBar f={f} a={a} />
      {a.totalRuns === 0 ? <ReasonNote>{L('Seuranta-ajoja ei ole vielä tehty, joten sävymittauksia ei ole. Tämä ei ole asetusongelma.', 'No monitoring runs yet, so there are no sentiment measurements. This is not a configuration problem.')}</ReasonNote>
      : !s && <ReasonNote tone="warning">{L('Taustapalvelu ei palauttanut sävytietoja. Sävyanalyysi edellyttää versiota 0.11.0 ja käyttöönottoa molemmissa palvelimissa.', 'The backend returned no sentiment data. Sentiment requires 0.11.0 and enablement on both API and worker.')}</ReasonNote>}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label={L('Sävyn yhteenveto', 'Sentiment summary')}>
        <SentimentScoreCard s={s} testId="perception-score" />
        <Panel as="article" className="flex flex-col gap-1 p-5">
          <p className="text-[13px] font-medium text-muted-ink">{L('Analyysin kattavuus', 'Analysis coverage')}</p>
          <p className="tabular text-[32px] font-semibold leading-[46px] text-ink" data-testid="value-coverage">{s?.coverage === null || s?.coverage === undefined ? '–' : pct(s.coverage / 100, 1)}</p>
          <p className="text-[12px] text-muted-ink">{s?.mentionedAnswers ? L(`${s.sampleSize ?? 0} / ${s.mentionedAnswers} mainitsevaa vastausta`, `${s.sampleSize ?? 0} of ${s.mentionedAnswers} mentioned answers`) : L('Ei mainitsevia vastauksia', 'No mentioning answers')}</p>
        </Panel>
        <Panel as="article" className="flex flex-col gap-1 p-5">
          <p className="text-[13px] font-medium text-muted-ink">{L('Odottaa analyysiä', 'Waiting for analysis')}</p>
          <p className="tabular text-[32px] font-semibold leading-[46px] text-ink" data-testid="value-waiting">{s?.states ? num(w.pending + w.waiting) : '–'}</p>
          <p className="text-[12px] text-muted-ink">{s?.states ? <>{L(`${w.waiting} odottaa budjettia tai asetuksia · ${w.unavailable} ei arvioitavissa`, `${w.waiting} waiting on budget or configuration · ${w.unavailable} not assessable`)}</> : L('Tilamäärät eivät ole saatavilla', 'State counts unavailable')}</p>
          <p className="text-[11px] text-muted-ink">{L('Alkuperäiset vastaukset ovat luettavissa analyysin tilasta riippumatta.', 'Original answers remain readable regardless of analysis state.')}</p>
        </Panel>
      </section>
      <SentimentGroups s={s} />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="flex flex-col gap-3 p-5" aria-labelledby="dist-h">
          <h2 id="dist-h" className="text-base font-semibold text-ink">{L('Sävyjakauma', 'Sentiment breakdown')}</h2>
          <LabelDistribution s={s} />
          <p className="text-[11px] text-muted-ink">{L('Ristiriitainen tarkoittaa, että vastauksessa on sekä myönteistä että kielteistä kuvausta, vaikka pisteet olisivat 50.', 'Mixed means the answer contains both positive and negative portrayal, even when the score is 50.')}</p>
        </Panel>
        <Panel className="flex min-w-0 flex-col gap-3 p-5" aria-labelledby="comp-h">
          <h2 id="comp-h" className="text-base font-semibold text-ink">{L('Kilpailijoiden sävyvertailu', 'Competitor sentiment comparison')}</h2>
          {!competitors.length ? <EmptyState compact title={L('Ei vertailutietoja', 'No comparison data')} body={L('Kilpailijoiden sävy näkyy, kun ajoihin on tallennettu vertailujoukko ja analyysi on valmis.', 'Competitor sentiment appears once runs record a cohort and analysis completes.')} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm" data-testid="table-competitor-sentiment">
                <caption className="sr-only">{L('Kilpailijoiden sävy', 'Competitor sentiment')}</caption>
                <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted-ink"><th scope="col" className="py-2">{L('Brändi', 'Brand')}</th><th scope="col" className="text-right">{L('Sävy', 'Sentiment')}</th><th scope="col" className="text-right">{L('Arvioitu', 'Assessed')}</th><th scope="col" className="text-right">{L('Kattavuus', 'Coverage')}</th></tr></thead>
                <tbody className="divide-y divide-line">{competitors.map((c) => {
                  const cs = c.metrics.sentiment!;
                  return (
                    <tr key={c.brandName} data-testid={`row-competitor-sentiment-${c.brandName}`}>
                      <th scope="row" className="py-2.5 text-left font-semibold text-ink">{c.brandName}{c.isOwned && <span className="ml-2 rounded bg-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase text-link">{L('Oma', 'Yours')}</span>}</th>
                      <td className="tabular text-right">{cs.score === null || cs.score === undefined || cs.state === 'incomparable' ? <span className="text-muted-ink">{cs.state === 'incomparable' ? L('Ei vertailukelpoinen', 'Incomparable') : '–'}</span> : `${num(cs.score, { maximumFractionDigits: 1 })} / 100`}</td>
                      <td className="tabular text-right">{cs.sampleSize ?? 0}</td>
                      <td className="tabular text-right">{cs.coverage === null || cs.coverage === undefined ? '–' : pct(cs.coverage / 100, 1)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
          {a.providers.some((p) => p.metrics.sentiment) && (
            <div className="border-t border-line pt-3">
              <h3 className="text-[13px] font-semibold text-ink">{L('Palveluittain', 'By provider')}</h3>
              <ul className="mt-2 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">{a.providers.map((p) => (
                <li key={p.provider} className="rounded-lg border border-line px-3 py-2" data-testid={`card-provider-sentiment-${p.provider}`}><p className="font-semibold text-ink"><ProviderMark provider={p.provider} /></p><p className="tabular text-muted-ink">{p.metrics.sentiment?.state === 'incomparable' ? L('Ei vertailukelpoinen', 'Incomparable') : p.metrics.sentiment?.score === null || p.metrics.sentiment?.score === undefined ? '–' : `${num(p.metrics.sentiment.score, { maximumFractionDigits: 1 })} / 100`} · n={p.metrics.sentiment?.sampleSize ?? 0}</p></li>
              ))}</ul>
            </div>
          )}
        </Panel>
      </section>
      <Panel className="overflow-hidden" aria-labelledby="attr-h">
        <div className="px-5 pt-5">
          <h2 id="attr-h" className="text-base font-semibold text-ink">{L('Brändin ominaisuudet', 'Brand attributes')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-ink">{L('Täsmälliset normalisoidut nimikkeet; synonyymejä ei yhdistetä. Laskettu kerran vastausta kohden, ja sama vastaus voi olla sekä myönteinen että kielteinen. Automaattisia poimintoja, ei varmennettuja tosiasioita.', 'Exact normalised labels; synonyms are not merged. Counted once per answer, and one answer can count as both positive and negative. Automated extractions, not verified facts.')}</p>
        </div>
        {!s?.attributes?.length ? <EmptyState compact title={L('Ei ominaisuuksia', 'No attributes yet')} body={L('Ominaisuudet näkyvät arvioitujen lainausten perusteella.', 'Attributes appear from assessed quotes.')} /> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="table-attributes">
              <caption className="sr-only">{L('Brändin ominaisuudet', 'Brand attributes')}</caption>
              <thead><tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-muted-ink"><th scope="col" className="px-5 py-2">{L('Ominaisuus', 'Attribute')}</th><th scope="col" className="px-2 text-right">{L('Vastaukset', 'Answers')}</th><th scope="col" className="px-2 text-right">{L('Myönteinen', 'Positive')}</th><th scope="col" className="px-2 text-right">{L('Neutraali', 'Neutral')}</th><th scope="col" className="px-2 text-right">{L('Kielteinen', 'Negative')}</th><th scope="col" className="px-5 text-right">{L('Esimerkit', 'Examples')}</th></tr></thead>
              <tbody className="divide-y divide-line">{s.attributes.map((at, i) => (
                <tr key={`${attrLabel(at)}-${i}`} data-testid={`row-attribute-${i}`}>
                  <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">{attrLabel(at)}</th>
                  <td className="tabular px-2 text-right">{at.answers}</td>
                  <td className="tabular px-2 text-right text-[#0b7d8d]">{at.positiveAnswers}</td>
                  <td className="tabular px-2 text-right text-muted-ink">{at.neutralAnswers}</td>
                  <td className="tabular px-2 text-right text-[#b33a2e]">{at.negativeAnswers}</td>
                  <td className="px-5 text-right">{at.exampleEvidenceIds.length ? (
                    <span className="inline-flex flex-wrap justify-end gap-1.5">{at.exampleEvidenceIds.slice(0, 3).map((id, k) => <Link key={id} href={evidenceHref(id)} className="text-[12px] font-semibold text-link hover:underline" data-testid={`link-attribute-example-${i}-${k}`}>{k === 0 ? L('Näytä esimerkit', 'View examples') : `${k + 1}`}</Link>)}</span>
                  ) : <span className="text-[12px] text-muted-ink">–</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="px-5 py-3 text-[11px] text-muted-ink">{L('Esimerkit ovat tukevia näytteitä, eivät kaikki vastaavat vastaukset.', 'Examples are supporting samples, not every matching answer.')}</p>
      </Panel>
    </div>
  );
}
