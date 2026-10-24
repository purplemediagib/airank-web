import { Info } from 'lucide-react';
import type { ProjectAnalytics } from '@workspace/api-client-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { ppDelta, sentimentDelta } from '@/lib/overview-data';
import { pctText, useL } from '../analytics';

type Kpi = { id: string; label: string; def: string; value: string | null; denom: string; delta: number | null; deltaUnit: 'pp' | 'pts' | 'rank'; note?: string | null; ev?: string; lowerIsBetter?: boolean };

/** Summary KPIs, each with its own denominator. Deltas only from the same-composition prior period. */
export function KpiStrip({ a, onEvidence }: { a: ProjectAnalytics; onEvidence: (filter: string) => void }) {
  const L = useL();
  const { pct, num, date } = useI18n();
  const m = a.metrics;
  const ov = a.overview;
  const prev = ov?.comparison?.metrics;
  const s = m.sentiment;
  const sd = sentimentDelta(s, prev?.sentiment);
  const order = m.brandOrder, previousOrder = prev?.brandOrder;
  const comparableOrder = !!order && !!previousOrder && order.version === previousOrder.version && order.scope === previousOrder.scope;
  const orderNote = !order ? L('Vaatii taustapalvelun päivityksen', 'Requires a backend update')
    : order.eligibleAnswers < m.eligible ? L(`${order.eligibleAnswers} / ${m.eligible} vastausta vertailukelpoisia; muut suljettiin pois.`, `${order.eligibleAnswers} / ${m.eligible} answers comparable; others excluded.`) : null;
  const kpis: Kpi[] = [
    { id: 'visibility', label: L('Näkyvyys', 'Visibility'), def: L('Osuus kelvollisista vastauksista, joissa brändi mainitaan.', 'Share of eligible answers that mention the brand.'), value: pctText(m.visibility, pct), denom: L(`${m.mentions} / ${m.eligible} kelvollista vastausta`, `${m.mentions} / ${m.eligible} eligible answers`), delta: ppDelta(m.visibility, prev?.visibility), deltaUnit: 'pp', ev: 'mentioned' },
    { id: 'share', label: L('Osuus maininnoista', 'Share of voice'), def: L('Oman brändin osuus mitatun vertailujoukon kaikista brändimaininnoista.', 'Your share of all brand mentions within the measured cohort.'), value: pctText(m.cohortShare, pct), denom: m.cohortShare === null ? L('Vertailujoukkoa ei mitattu', 'No measured cohort') : L(`${m.cohortMentions} brändimainintaa`, `of ${m.cohortMentions} cohort mentions`), delta: ppDelta(m.cohortShare, prev?.cohortShare), deltaUnit: 'pp', ev: 'mentioned' },
    { id: 'sentiment', label: L('Sävy', 'Sentiment'), def: L('Kuvauksen sävy 0–100 mainitsevissa, arvioiduissa vastauksissa. Vertaillaan vain saman analyysiversion ja mallin sisällä.', 'Portrayal tone 0–100 across assessed mentioning answers. Compared only within the same analysis version and model.'), value: s && s.score != null && s.state !== 'incomparable' ? num(s.score, { maximumFractionDigits: 1 }) : null, denom: s ? L(`${s.sampleSize ?? 0} / ${s.mentionedAnswers ?? 0} mainitsevaa arvioitu`, `${s.sampleSize ?? 0} / ${s.mentionedAnswers ?? 0} mentioning assessed`) : L('Ei saatavilla tältä palvelimelta', 'Not available from this server'), delta: sd.delta, deltaUnit: 'pts', note: s?.state === 'incomparable' ? L('Eri analyysiversioita ei yhdistetä', 'Analysis versions not combined') : sd.reason === 'incomparable' && prev ? L('Ei vertailtavissa: analyysiversio tai malli vaihtui', 'Not comparable: analysis version or model changed') : null },
    { id: 'position', label: L('Sijoitus seurattujen joukossa', 'Tracked-brand position'), def: L('Ensimmäisen maininnan keskimääräinen järjestys ajoon tallennettujen seurattujen brändien joukossa. Ei kaikkien mahdollisten brändien sijoitus. Pienempi on parempi. Listasijoitus näytetään erikseen.', 'Average first-mention order among the frozen tracked brands, not every possible brand. Lower is better. Explicit list rank remains separate.'), value: order?.meanPosition == null ? null : num(order.meanPosition, { maximumFractionDigits: 1 }), denom: L(`${order?.mentionedAnswers ?? 0} mainitsevaa vastausta`, `${order?.mentionedAnswers ?? 0} mentioning answers`), delta: comparableOrder && order.meanPosition != null && previousOrder.meanPosition != null ? Math.round((previousOrder.meanPosition - order.meanPosition) * 10) / 10 : null, deltaUnit: 'rank', lowerIsBetter: true, note: orderNote, ev: 'ordered' },
    { id: 'win-rate', label: L('Ensimmäisen maininnan osuus', 'Tracked-brand win rate'), def: L('Osuus vertailukelpoisista kelvollisista vastauksista, joissa oma brändi on ensimmäinen seurattu brändi. Myös vastaukset ilman mainintaa ovat nimittäjässä. Epäselvät ja puuttuvat vertailujoukot suljetaan pois.', 'Share of comparable eligible answers where your brand is the first tracked brand. Answers without a mention stay in the denominator. Ambiguous matches and unavailable cohorts are excluded.'), value: pctText(order?.winRate ?? null, pct), denom: L(`${order?.firsts ?? 0} / ${order?.eligibleAnswers ?? 0} vertailukelpoista vastausta`, `${order?.firsts ?? 0} / ${order?.eligibleAnswers ?? 0} comparable answers`), delta: comparableOrder ? ppDelta(order.winRate, previousOrder.winRate) : null, deltaUnit: 'pp', note: orderNote, ev: 'first' },
    { id: 'owned-citations', label: L('Omat lähteet', 'Owned citations'), def: L('Osuus vastauksista, joiden viitteet voidaan havaita ja jotka viittaavat omaan verkkotunnukseen.', 'Share of answers with observable citations that cite an owned domain.'), value: pctText(m.citationRate, pct), denom: L(`${m.ownedCitations} / ${m.citationAnswers ?? m.eligible} vastausta, joiden viitteet voidaan havaita`, `${m.ownedCitations} / ${m.citationAnswers ?? m.eligible} answers with observable citations`), delta: ppDelta(m.citationRate, prev?.citationRate), deltaUnit: 'pp', ev: 'cited' },
    { id: 'recommendations', label: L('Suositukset', 'Recommendations'), def: L('Osuus luokitelluista vastauksista, joissa brändiä suositellaan. Pelkkä maininta ei riitä.', 'Share of classified answers recommending your brand. A mention alone is not a recommendation.'), value: m.classified > 0 ? pctText(m.recommendationRate, pct) : null, denom: L(`${m.recommended} / ${m.classified} luokiteltua vastausta`, `${m.recommended} / ${m.classified} classified answers`), delta: m.classified > 0 ? ppDelta(m.recommendationRate, prev?.recommendationRate) : null, deltaUnit: 'pp', ev: 'recommended', note: m.classified === 0 ? L('Ei vielä luokiteltuja vastauksia', 'No classified answers yet') : null },
    { id: 'score', label: L('Näkyvyyspisteet', 'Visibility score'), def: L('Näkyvyys normalisoituna asteikolle 0–10. Ei erillinen mittaus tai arvio liiketoiminnasta.', 'Visibility normalised to 0–10. This is not a separate measurement or a business rating.'), value: m.eligible > 0 && m.score !== null ? `${num(m.score, { maximumFractionDigits: 1 })} / 10` : null, denom: L(`${m.mentions} / ${m.eligible} kelvollista vastausta`, `${m.mentions} / ${m.eligible} eligible answers`), delta: null, deltaUnit: 'pts', ev: 'mentioned' },
  ];
  const cmp = ov?.comparison;
  const short = (iso: string) => date(new Date(`${iso}T00:00:00Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <section aria-label={L('Yhteenvetomittarit', 'Summary metrics')} className="overflow-hidden rounded-xl border border-line bg-white" data-testid="section-kpis">
      <div className="grid grid-cols-2 divide-line md:grid-cols-4 [&>*]:border-line [&>*]:border-b [&>*]:border-r">
        {kpis.map((k) => (
          <article key={k.id} className={cn('flex min-w-0 flex-col gap-0.5 px-4 py-3.5', (k.id === 'visibility' || k.id === 'score') && 'max-md:col-span-2 max-md:!border-r-0')} data-testid={`kpi-${k.id}`}>
            <div className="flex items-center gap-1 text-[12px] font-medium text-muted-ink">
              {k.label}
              <Tooltip><TooltipTrigger asChild><button type="button" className="grid size-5 place-items-center rounded text-[#9aa6b8] hover:text-ink" aria-label={`${L('Määritelmä', 'Definition')}: ${k.label}`} data-testid={`button-definition-${k.id}`}><Info className="size-3" aria-hidden /></button></TooltipTrigger><TooltipContent className="max-w-[260px] text-[12px]">{k.def}</TooltipContent></Tooltip>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn('tabular text-[22px] font-semibold leading-8', k.value === null ? 'text-[#b4bdcb]' : 'text-ink')} data-testid={`value-${k.id}`}>{k.value ?? '–'}</span>
              {k.delta !== null && k.value !== null && (
                <span className={cn('tabular text-[11px] font-semibold', k.delta > 0 ? 'text-success' : k.delta < 0 ? 'text-danger' : 'text-muted-ink')} data-testid={`delta-${k.id}`}>
                  {k.delta > 0 ? '+' : ''}{num(k.delta, { maximumFractionDigits: 1 })} {k.deltaUnit === 'pp' ? 'pp' : k.deltaUnit === 'rank' ? L('paikkaa', 'places') : L('pist.', 'pts')}
                </span>
              )}
            </div>
            <p className="text-[11px] leading-4 text-muted-ink" data-testid={`denom-${k.id}`}>{k.denom}</p>
            {k.note && <p className="text-[11px] text-[#8a6d1d]" data-testid={`note-${k.id}`}>{k.note}</p>}
            {k.ev && <button type="button" onClick={() => onEvidence(k.ev!)} className="mt-0.5 self-start text-[11px] font-semibold text-link hover:underline" data-testid={`button-drill-${k.id}`}>{L('Näytä vastaukset', 'View answers')}</button>}
          </article>
        ))}
      </div>
      <p className="border-t border-line bg-canvas px-4 py-1.5 text-[11px] text-muted-ink" data-testid="text-comparison-basis">
        {ov === undefined ? L('Muutokset vaativat taustapalvelun päivityksen.', 'Period changes require a backend upgrade.')
          : cmp ? L(`Muutos verrattuna jaksoon ${short(cmp.from)}–${short(cmp.to)} samalla koostumuksella. Yksikkö näytetään mittarin vieressä.`, `Change vs ${short(cmp.from)}–${short(cmp.to)}, same composition. Units are shown beside each metric.`)
          : L('Ei vertailukelpoista edellistä jaksoa samalla koostumuksella; muutoksia ei näytetä.', 'No comparable prior period with the same composition; changes are not shown.')}
      </p>
    </section>
  );
}
