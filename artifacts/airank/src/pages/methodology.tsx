import { useDocumentTitle, useI18n } from '@/i18n';
import { PageHeader, Panel, ReasonNote } from '@/components/airank/primitives';
import { useProjects } from '@/lib/project-context';
import { useAnalytics, useAnalyticsFilters } from '@/lib/use-analytics';
import { useL } from '@/components/airank/analytics';

/** Figma 5:96 structure: score definition, metric table (metric / meaning / live example), comparability, limits. */
export default function MethodologyPage() {
  const { d, pct, num } = useI18n();
  const L = useL();
  useDocumentTitle(d.features.methodology.title);
  const { project } = useProjects();
  const f = useAnalyticsFilters();
  const q = useAnalytics(project?.id ?? '', f.params);
  const m = q.data?.metrics;
  const ratio = (n: number | undefined, den: number | undefined, v: number | null | undefined) =>
    m && den ? `${n} / ${den} = ${v === null || v === undefined ? '–' : pct(v / 100, 1)}` : '–';
  const rows: [string, string, string][] = [
    [L('Näkyvyys', 'Visibility'), L('Brändin mainitsevat kelvolliset vastaukset / kaikki kelvolliset vastaukset.', 'Valid responses mentioning the brand / all valid responses.'), ratio(m?.mentions, m?.eligible, m?.visibility)],
    [L('Suositusaste', 'Recommendation rate'), L('Brändiä suosittelevat vastaukset / vastaukset, joiden suositusluokitus tunnetaan. Epäselvä ei tarkoita kielteistä. Luokituskattavuus näytetään erikseen.', 'Responses recommending the brand / answers with an available recommendation classification. Unknown is not negative. Classification coverage is shown separately.'), `${ratio(m?.recommended, m?.classified, m?.recommendationRate)} · ${m?.classified ?? 0}/${m?.eligible ?? 0} ${L('kelvollisesta vastauksesta luokiteltu', 'eligible answers classified')}`],
    [L('Lähdeviittausten kattavuus', 'Owned citation coverage'), L('Omaan sivustoon viittaavat vastaukset / kaikki kelvolliset vastaukset.', 'Responses citing your own site / all valid responses.'), ratio(m?.ownedCitations, m?.eligible, m?.citationRate)],
    [L('Mainintaosuus', 'Share of mentions'), L('Brändin vastauskohtaiset maininnat / vertailuryhmän kaikkien brändien maininnat. Tyhjä, kun vertailuryhmää ei ole määritetty.', 'Brand mentions per response / all cohort brand mentions. Empty when no cohort is configured.'), m && m.cohortShare !== null ? ratio(m.mentions, m.cohortMentions, m.cohortShare) : '–'],
    [L('Suositusjärjestys', 'Recommendation position'), L('Keskimääräinen järjestysnumero vain selkeästi järjestetyissä vastauksissa.', 'Mean rank only in clearly ordered responses.'), m && m.meanPosition !== null ? `${num(m.meanPosition, { maximumFractionDigits: 1 })} · n = ${m.positions}` : '–'],
  ];
  return (
    <>
      <PageHeader title={L('Miten mittaamme', 'How we measure')} subtitle={L('Läpinäkyvä otos tekoälyn vastauksista. Jokainen luku on tarkistettavissa.', 'A transparent sample of AI answers. Every number can be checked.')} />
      <Panel className="flex flex-col gap-2 p-5" aria-labelledby="score-def">
        <h2 id="score-def" className="text-[18px] font-semibold text-ink">{L('Pisteet ovat näkyvyysaste asteikolla 0–10', 'The score is the visibility rate on a 0–10 scale')}</h2>
        <p className="tabular text-sm text-ink" data-testid="text-score-example">{m && m.eligible && m.score !== null ? L(`${m.mentions} maininnan sisältävää vastausta / ${m.eligible} kelvollista vastausta × 10 = ${num(m.score, { maximumFractionDigits: 1 })} / 10`, `${m.mentions} responses with a mention / ${m.eligible} valid responses × 10 = ${num(m.score, { maximumFractionDigits: 1 })} / 10`) : L('Ei pisteitä ilman kelvollisia vastauksia – ei koskaan nollaa puuttuvan tiedon tilalla.', 'No score without valid responses – never zero in place of missing data.')}</p>
        <p className="text-[12px] text-muted-ink">{L('Pyöristys yhteen desimaaliin. Ei erillistä, salaista yhdistelmäpisteytystä.', 'Rounded to one decimal. No separate, secret composite scoring.')}</p>
        <p className="text-[12px] text-muted-ink" data-testid="text-methodology-version">{L('Menetelmä', 'Methodology')}: {q.data?.methodology ?? '–'} · {L('Poiminta', 'Extraction')}: {q.data?.extractionVersion ?? '–'}{q.isError ? ` · ${L('projektin versiotiedot eivät ole saatavilla', 'project version details unavailable')}` : ''}</p>
      </Panel>
      <Panel className="min-w-0 p-5">
        <table className="block w-full text-left text-sm md:table" data-testid="table-metric-definitions">
          <caption className="sr-only">{L('Mittarit', 'Metrics')}</caption>
          <thead className="hidden text-[12px] text-muted-ink md:table-header-group"><tr><th className="py-2 pr-4 font-medium">{L('Mittari', 'Metric')}</th><th className="py-2 pr-4 font-medium">{L('Mitä se tarkoittaa', 'What it means')}</th><th className="py-2 font-medium">{L('Projektisi luku', 'Your project')}</th></tr></thead>
          <tbody className="block divide-y divide-line md:table-row-group">{rows.map(([k, v, ex]) => <tr key={k} className="block py-3 md:table-row md:py-0"><th scope="row" className="block py-2 pr-4 font-semibold text-ink md:table-cell">{k}</th><td className="block py-2 pr-4 text-muted-ink md:table-cell">{v}</td><td className="tabular block break-words py-2 text-ink md:table-cell"><span className="mr-2 font-medium md:hidden">{L('Projektisi luku:', 'Your project:')}</span>{ex}</td></tr>)}</tbody>
        </table>
      </Panel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="flex flex-col gap-2 p-5">
          <h2 className="text-[16px] font-semibold text-ink">{L('Vertailukelpoinen mittaus', 'Comparable measurement')}</h2>
          <ul className="list-disc pl-5 text-sm text-muted-ink">
            <li>{L('Samat brändineutraalit kysymykset, kieli ja markkina.', 'The same brand-neutral prompts, language and market.')}</li>
            <li>{L('Kysymykset, mallit ja vertailuryhmät versioidaan. Eri koostumuksia ei yhdistetä.', 'Prompts, models and cohorts are versioned. Different compositions are never combined.')}</li>
            <li>{L('Alustat näytetään erikseen. Kokonaisluku on vastauksilla painotettu.', 'Platforms are shown separately. The total is weighted by responses.')}</li>
            <li>{L('Epäonnistunut tai poistettu alusta ei ole nollatulos.', 'A failed or removed platform is not a zero result.')}</li>
            <li>{L('Diagnostiset ajot ja pikatarkistukset näkyvät erikseen, eivät mittareissa.', 'Diagnostic runs and quick checks are shown separately, not in metrics.')}</li>
          </ul>
        </Panel>
        <Panel className="flex flex-col gap-2 p-5">
          <h2 className="text-[16px] font-semibold text-ink">{L('Mitä luvut eivät kerro', 'What the numbers do not tell')}</h2>
          <ul className="list-disc pl-5 text-sm text-muted-ink">
            <li>{L('Otos ei kuvaa kaikkia käyttäjiä tai tekoälyhakuja.', 'The sample does not represent all users or AI searches.')}</li>
            <li>{L('API-vastaus voi erota kuluttajapalvelun vastauksesta.', 'An API answer may differ from the consumer product.')}</li>
            <li>{L('Pieni otos vaihtelee. Toimenpiteet eivät takaa kasvua.', 'Small samples vary. Actions do not guarantee growth.')}</li>
          </ul>
        </Panel>
      </div>
      <ReasonNote>{L('Projektin markkina ja kysymyskieli valitaan erikseen.', 'Each project has a separately selected market and question language.')}</ReasonNote>
    </>
  );
}
