import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { StatusBadge, type Tone } from '@/components/airank/primitives';
import type { ContentJob } from '@/lib/content-api';
import { useStudio, useRecords } from './studio';
import { Banner, Card, Dash, ExtLink, MarkdownPreview, useErr, useFmt, useTx, type Tx } from './ui';

const asArr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function SourceChips({ ids }: { ids?: string[] }) {
  const tx = useTx();
  const { ph } = useStudio();
  const q = useRecords('sources');
  if (!ids?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={tx('Sources', 'Lähteet')}>
      {ids.map((id) => {
        const s = q.data?.find((x) => x.id === id);
        return <li key={id}><Link href={ph('/dashboard/content/sources') + `#${id}`} className="inline-flex max-w-[260px] items-center truncate rounded-md border border-line bg-canvas px-2 py-0.5 text-[12px] text-link hover:bg-tint">{s?.title || s?.url || id}</Link></li>;
      })}
    </ul>
  );
}

function List({ items, title }: { items: unknown[]; title: string }) {
  if (!items.length) return null;
  return <div><h3 className="text-[13px] font-semibold text-ink">{title}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">{items.map((x, i) => <li key={i}>{str(x)}</li>)}</ul></div>;
}
export function MissingInfo({ items }: { items: unknown }) {
  const tx = useTx();
  return <List items={asArr(items)} title={tx('Missing information to supply', 'Puuttuva tieto, joka pitää antaa')} />;
}
export function SourceErrors({ errors }: { errors: unknown }) {
  const tx = useTx(); const err = useErr();
  const list = asArr(errors);
  if (!list.length) return null;
  return (
    <Banner tone="warning">
      <p className="font-semibold">{tx('Some sources could not be read', 'Joitakin lähteitä ei voitu lukea')}</p>
      <ul className="mt-1 space-y-0.5">{list.map((e, i) => <li key={i}><ExtLink href={e.url} /> — {err(e.error, str(e.error ?? e.status))}</li>)}</ul>
    </Banner>
  );
}

const CHECK_LABEL = (tx: Tx): Record<string, string> => ({
  missing_title: tx('Page title is missing', 'Sivun otsikko puuttuu'),
  missing_description: tx('Search description is missing', 'Hakukuvaus puuttuu'),
  heading_structure: tx('Heading structure needs review', 'Otsikkorakenne vaatii tarkistuksen'),
  noindex: tx('Page declares noindex', 'Sivu estää indeksoinnin (noindex)'),
  little_server_content: tx('Very little text in server HTML (rendered content not checked)', 'Palvelimen HTML:ssä hyvin vähän tekstiä (renderöityä sisältöä ei tarkistettu)'),
  structured_data_review: tx('Consider structured data matching visible content', 'Harkitse näkyvää sisältöä vastaavaa rakenteista dataa'),
  links_review: tx('Review internal and supporting links', 'Tarkista sisäiset ja tukevat linkit'),
  extraction_truncated: tx('Page exceeded the extraction limit', 'Sivu ylitti poimintarajan'),
});
const sevTone: Record<string, Tone> = { high: 'error', medium: 'warning', low: 'neutral' };

export function Deterministic({ data }: { data: any }) {
  const tx = useTx(); const f = useFmt();
  if (!data) return null;
  const labels = CHECK_LABEL(tx);
  return (
    <Card title={tx('Deterministic checks', 'Sääntöpohjaiset tarkistukset')}>
      <p className="text-sm text-ink">{tx('Editorial checklist', 'Toimituksellinen tarkistuslista')}: <strong>{f.n(data.checksPassed)}/{f.n(data.checksTotal)}</strong> · {tx('words', 'sanaa')}: {f.n(data.wordCount)}</p>
      <p className="mt-1 text-[12px] text-muted-ink">{tx('This checklist is not an AI visibility score.', 'Tämä tarkistuslista ei ole tekoälynäkyvyyden pistemäärä.')}</p>
      {data.scope === 'pasted_content_only' && <div className="mt-3"><Banner tone="info">{tx('Pasted content only: indexing, server HTML and robots checks need a published URL.', 'Vain liitetty sisältö: indeksointi-, palvelin-HTML- ja robots-tarkistukset vaativat julkaistun osoitteen.')}</Banner></div>}
      <ul className="mt-3 divide-y divide-line">
        {asArr(data.issues).length === 0 && <li className="py-2 text-sm text-muted-ink">{tx('No checklist issues found.', 'Tarkistuslistan ongelmia ei löytynyt.')}</li>}
        {asArr(data.issues).map((i, k) => <li key={k} className="flex flex-wrap items-center gap-2 py-2 text-sm"><StatusBadge tone={sevTone[i.severity] ?? 'neutral'} dot={false}>{i.severity === 'high' ? tx('High', 'Korkea') : i.severity === 'medium' ? tx('Medium', 'Keskitaso') : tx('Low', 'Matala')}</StatusBadge><span className="min-w-0 flex-1">{labels[i.code] ?? i.detail ?? i.code}</span></li>)}
      </ul>
      <p className="mt-3 text-[12px] text-muted-ink">{tx('Limits: no JavaScript rendering, embedded components are not read, and fetch failures are listed separately.', 'Rajaukset: JavaScriptiä ei renderöidä, upotettuja komponentteja ei lueta ja hakuvirheet listataan erikseen.')}</p>
    </Card>
  );
}

export function AuditResult({ r }: { r: any }) {
  const tx = useTx();
  const o = r?.output ?? {};
  return (
    <div className="flex flex-col gap-4">
      <Deterministic data={r?.deterministic} />
      <SourceErrors errors={r?.sourceErrors} />
      <Card title={tx('AI editorial findings', 'Tekoälyn toimitukselliset havainnot')}>
        <p className="mb-3 text-[12px] text-muted-ink">{tx('Model suggestions. Review before acting.', 'Mallin ehdotuksia. Tarkista ennen toimia.')}</p>
        {o.summary && <p className="mb-3 text-sm text-ink">{str(o.summary)}</p>}
        <ul className="space-y-3">
          {asArr(o.findings).length === 0 && <li className="text-sm text-muted-ink">{tx('No findings reported.', 'Havaintoja ei raportoitu.')}</li>}
          {asArr(o.findings).map((f, i) => <li key={i} className="rounded-lg border border-line p-3"><p className="text-sm font-semibold text-ink">{str(f.issue)}</p><p className="mt-1 text-sm text-ink">{str(f.recommendation)}</p><SourceChips ids={f.sourceIds} /></li>)}
        </ul>
        <div className="mt-3"><MissingInfo items={o.missingInformation} /></div>
      </Card>
    </div>
  );
}

export function ResearchResult({ r }: { r: any }) {
  const tx = useTx(); const sources = useRecords('sources');
  const o = r?.output ?? {}; const b = o.brief ?? {};
  const name = (id: string) => sources.data?.find((s) => s.id === id)?.title || sources.data?.find((s) => s.id === id)?.url || id;
  return (
    <div className="flex flex-col gap-4">
      <SourceErrors errors={r?.sourceErrors} />
      <Card title={tx('Brief', 'Brief')}>
        <h3 className="text-[17px] font-semibold text-ink">{str(b.title)}</h3>
        {b.intent && <p className="mt-1 text-sm text-ink"><span className="font-semibold">{tx('Search intent', 'Hakutarkoitus')}: </span>{str(b.intent)}</p>}
        <div className="mt-3 grid gap-4 md:grid-cols-2"><List items={asArr(b.outline)} title={tx('Outline', 'Rakenne')} /><List items={asArr(b.questions)} title={tx('Questions to answer', 'Vastattavat kysymykset')} /></div>
      </Card>
      {asArr(o.sourceComparisons).length > 0 && (
        <Card title={tx('Source comparison', 'Lähdevertailu')}>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[12px] uppercase text-muted-ink"><tr><th className="py-2 pr-3">{tx('Source', 'Lähde')}</th><th className="pr-3">{tx('Strength', 'Vahvuus')}</th><th>{tx('Gap', 'Aukko')}</th></tr></thead>
            <tbody className="divide-y divide-line align-top">{asArr(o.sourceComparisons).map((c, i) => <tr key={i}><td className="py-2 pr-3"><SourceChips ids={[c.sourceId]} /><span className="sr-only">{name(c.sourceId)}</span></td><td className="py-2 pr-3">{str(c.strength)}</td><td className="py-2">{str(c.gap)}</td></tr>)}</tbody></table></div>
        </Card>
      )}
      {asArr(o.externalActions).length > 0 && (
        <Card title={tx('External-source actions (guidance only)', 'Ulkoisten lähteiden toimet (vain ohjeita)')}>
          <ul className="space-y-2 text-sm">{asArr(o.externalActions).map((a, i) => <li key={i}>{str(a.action)}<SourceChips ids={[a.sourceId]} /></li>)}</ul>
          <p className="mt-2 text-[12px] text-muted-ink">{tx('AI Rank does not contact external sites for you.', 'AI Rank ei ota yhteyttä ulkoisiin sivustoihin puolestasi.')}</p>
        </Card>
      )}
      <MissingInfo items={o.missingInformation} />
    </div>
  );
}

export function CreateResult({ r }: { r: any }) {
  const tx = useTx(); const o = r?.output ?? {};
  return (
    <div className="flex flex-col gap-4">
      <SourceErrors errors={r?.sourceErrors} />
      <Card title={str(o.title) || tx('Generated draft', 'Luotu luonnos')}>
        <p className="mb-3 text-sm text-muted-ink">{str(o.description)}</p>
        <MarkdownPreview markdown={str(o.markdown)} />
      </Card>
      {asArr(o.claims).length > 0 && (
        <Card title={tx('Claims to verify', 'Varmennettavat väitteet')}>
          <ul className="space-y-2 text-sm">{asArr(o.claims).map((c, i) => <li key={i}>{str(c.claim)}<SourceChips ids={c.sourceIds} /></li>)}</ul>
        </Card>
      )}
      <MissingInfo items={o.missingInformation} />
    </div>
  );
}

export const assessmentTone: Record<string, Tone> = { inaccurate: 'error', unsupported: 'warning', missing_strength: 'info', aligned: 'success' };
export function useAssessmentLabel() {
  const tx = useTx();
  return (a: string) => ({ inaccurate: tx('Inaccurate', 'Virheellinen'), unsupported: tx('Unsupported', 'Tukematon'), missing_strength: tx('Missing strength', 'Puuttuva vahvuus'), aligned: tx('Aligned', 'Linjassa') }[a] ?? a);
}
export function PerceptionResult({ r }: { r: any }) {
  const tx = useTx(); const { overview, role, ph } = useStudio(); const label = useAssessmentLabel(); const err = useErr();
  if (r?.state === 'unavailable') return <Banner tone="warning">{err(r.reason, tx('Perception is unavailable.', 'Brändikuva ei ole saatavilla.'))}</Banner>;
  const facts: any[] = overview.brand?.facts ?? [];
  return (
    <div className="flex flex-col gap-4">
      <SourceErrors errors={r?.sourceErrors} />
      <Banner>{tx('Assessments are model suggestions linked to evidence. Only findings tied to a verified brand fact are shown as inaccurate. Factual accuracy is separate from sentiment.', 'Arviot ovat mallin ehdotuksia, jotka linkittyvät näyttöön. Virheelliseksi merkitään vain varmennettuun faktaan sidotut havainnot. Faktojen oikeellisuus on eri asia kuin sävy.')}</Banner>
      <ul className="space-y-3">
        {asArr(r?.output?.findings).length === 0 && <li className="text-sm text-muted-ink">{tx('No findings reported.', 'Havaintoja ei raportoitu.')}</li>}
        {asArr(r?.output?.findings).map((f, i) => {
          const fact = facts.find((x) => x.id === f.verifiedFactId);
          return (
            <li key={i} className="rounded-[12px] border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={assessmentTone[f.assessment] ?? 'neutral'}>{label(f.assessment)}</StatusBadge><span className="text-[12px] text-muted-ink">{tx('Model suggestion', 'Mallin ehdotus')}</span></div>
              <blockquote className="mt-3 border-l-4 border-cyan pl-3 text-sm italic text-ink">“{str(f.observedQuote)}”</blockquote>
              {fact && <p className="mt-2 rounded-lg bg-canvas p-2 text-[13px]"><span className="font-semibold">{tx('Verified fact', 'Varmennettu fakta')}: </span>{fact.statement}</p>}
              <p className="mt-2 text-sm text-ink">{str(f.explanation)}</p>
              {f.action && <p className="mt-1 text-sm text-ink"><span className="font-semibold">{tx('Suggested action', 'Ehdotettu toimi')}: </span>{str(f.action)}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                {role === 'owner' ? <Link href={ph(`/dashboard/evidence/${encodeURIComponent(f.evidenceId)}`)} className="text-link underline-offset-4 hover:underline">{tx('Open evidence record', 'Avaa näyttötietue')}</Link> : <span className="text-muted-ink">{tx('Evidence', 'Näyttö')}: {str(f.evidenceId)}</span>}
              </div>
              <SourceChips ids={f.sourceIds} />
            </li>
          );
        })}
      </ul>
      <MissingInfo items={r?.output?.missingInformation} />
    </div>
  );
}

const kindLabel = (tx: Tx, k: string) => ({
  search_quick_win: tx('Search quick win', 'Hakupikavoitto'), low_ctr_review: tx('Low click-through review', 'Matalan klikkausprosentin tarkistus'), content_decay: tx('Content decay', 'Sisällön hiipuminen'),
  query_overlap: tx('Query overlap', 'Hakukyselyiden päällekkäisyys'), ai_visibility_gap: tx('AI visibility gap', 'Tekoälynäkyvyyden aukko'), external_source_opportunity: tx('External source opportunity', 'Ulkoisen lähteen mahdollisuus'),
} as Record<string, string>)[k] ?? k;
export const oppKindLabel = kindLabel;

function GoogleBox({ title, rep }: { title: string; rep: any }) {
  const tx = useTx(); const f = useFmt();
  if (!rep) return <div className="rounded-lg border border-line p-3"><p className="text-[12px] font-semibold text-muted-ink">{title}</p><p>{Dash}</p></div>;
  const ok = ['available', 'partial'].includes(rep.state);
  let sum = rep.summary;
  if (Array.isArray(sum)) sum = sum.length ? { clicks: sum.reduce((n: number, x: any) => n + Number(x.clicks || 0), 0), impressions: sum.reduce((n: number, x: any) => n + Number(x.impressions || 0), 0) } : null;
  const stateLabel = { available: tx('Available', 'Saatavilla'), partial: tx('Partial data', 'Osittainen data'), collecting: tx('Collecting data', 'Dataa kerätään'), unavailable: tx('Unavailable', 'Ei saatavilla') }[rep.state as string] ?? String(rep.state);
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <p className="text-[12px] font-semibold text-muted-ink">{title}</p>
      <p className="text-[12px]">{stateLabel}{rep.currency ? ` · ${rep.currency}` : ''}{rep.timeZone ? ` · ${rep.timeZone}` : ''}</p>
      {ok && sum ? <dl className="mt-1 grid grid-cols-2 gap-x-3">{Object.entries(sum).filter(([, v]) => typeof v === 'number').map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-ink">{k}</dt><dd className="text-right font-medium">{f.n(v as number, { maximumFractionDigits: 2 })}</dd></div>)}</dl> : <p className="mt-1 text-muted-ink">{Dash}</p>}
      {asArr(rep.missingDates).length > 0 && <p className="mt-1 text-[12px] text-warning">{tx('Missing dates', 'Puuttuvat päivät')}: {asArr(rep.missingDates).length}</p>}
    </div>
  );
}
export function ImpactResult({ r }: { r: any }) {
  const tx = useTx(); const f = useFmt(); const err = useErr();
  if (r?.state === 'unavailable') return <Banner tone="warning">{err(r.reason, tx('Impact is unavailable.', 'Vaikutus ei ole saatavilla.'))}</Banner>;
  const pct = (v: number | null) => (v == null ? Dash : `${f.n(v, { maximumFractionDigits: 1 })} %`);
  return (
    <div className="flex flex-col gap-4">
      {r.state === 'collecting' && <Banner tone="info">{tx('Collecting data: the 28-day after window is not complete yet.', 'Dataa kerätään: 28 päivän jälkeinen jakso ei ole vielä täynnä.')}</Banner>}
      <Card title={tx('AI visibility and citations (project-level)', 'Tekoälynäkyvyys ja viittaukset (projektitaso)')}>
        {asArr(r.comparisons).length === 0 ? <p className="text-sm text-muted-ink">{tx('No comparable before/after monitoring groups yet.', 'Vertailukelpoisia ennen/jälkeen-seurantaryhmiä ei vielä ole.')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[12px] uppercase text-muted-ink"><tr><th className="py-2 pr-3">{tx('Comparison group', 'Vertailuryhmä')}</th><th className="pr-3">{tx('Period', 'Jakso')}</th><th className="pr-3">{tx('Runs / answers', 'Ajot / vastaukset')}</th><th className="pr-3">{tx('Visibility', 'Näkyvyys')}</th><th>{tx('Owned citations', 'Omat viittaukset')}</th></tr></thead>
            <tbody className="divide-y divide-line">{asArr(r.comparisons).flatMap((c) => (['before', 'after'] as const).map((p) => <tr key={c.group + p}><td className="py-2 pr-3 font-mono text-[12px]">{p === 'before' ? str(c.group) : ''}</td><td className="pr-3">{p === 'before' ? tx('Before', 'Ennen') : tx('After', 'Jälkeen')}</td><td className="pr-3">{f.n(c[p].runs)} / {f.n(c[p].eligible)}</td><td className="pr-3">{pct(c[p].visibility)}</td><td>{pct(c[p].citationRate)}</td></tr>))}</tbody></table></div>
        )}
        {asArr(r.comparisons).some((c) => asArr(c.before.sentimentGroups).length || asArr(c.after.sentimentGroups).length) && (
          <p className="mt-2 text-[12px] text-muted-ink">{tx('Sentiment is reported separately in the monitoring views, with its own sample sizes.', 'Sävy raportoidaan erikseen seurantanäkymissä omilla otoskoillaan.')}</p>
        )}
      </Card>
      <Card title={tx('Google Search and identified AI traffic', 'Google-haku ja tunnistettu tekoälyliikenne')}>
        <div className="grid gap-3 md:grid-cols-2">
          <GoogleBox title={`${tx('Search', 'Haku')} · ${tx('before', 'ennen')}`} rep={r.google?.gsc_before} /><GoogleBox title={`${tx('Search', 'Haku')} · ${tx('after', 'jälkeen')}`} rep={r.google?.gsc_after} />
          <GoogleBox title={`${tx('AI traffic (identified referrers)', 'Tekoälyliikenne (tunnistetut lähteet)')} · ${tx('before', 'ennen')}`} rep={r.google?.ga4_before} /><GoogleBox title={`${tx('AI traffic', 'Tekoälyliikenne')} · ${tx('after', 'jälkeen')}`} rep={r.google?.ga4_after} />
        </div>
      </Card>
      <Banner>{tx('Observed association, not causal proof. Other site changes, seasonality and model updates can affect results. AI comparisons cover comparable prompt and model groups, not exact article-to-prompt attribution.', 'Havaittu yhteys, ei todiste syy-yhteydestä. Muut sivumuutokset, kausivaihtelu ja mallipäivitykset voivat vaikuttaa. Tekoälyvertailut kattavat vertailukelpoiset kehote- ja malliryhmät, eivät tarkkaa artikkeli–kehote-kohdistusta.')}</Banner>
      <p className="text-[12px] text-muted-ink">{tx('Window', 'Jakso')}: {f.n(r.windowDays)} {tx('days', 'pv')} · {tx('Evaluated', 'Arvioitu')} {f.dt(r.evaluatedAt)}</p>
    </div>
  );
}

export function OpportunitiesResult({ r }: { r: any }) {
  const tx = useTx(); const { ph } = useStudio();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink">{tx('Opportunities found', 'Löydettyjä mahdollisuuksia')}: <strong>{asArr(r?.opportunities).length}</strong></p>
      {['current', 'previous', 'queryPages'].map((k) => r?.googleCoverage?.[k] && <p key={k} className="text-[12px] text-muted-ink">Google · {k}: {str(r.googleCoverage[k].state)}</p>)}
      <Link href={ph('/dashboard/content/opportunities')} className="text-sm font-semibold text-link underline-offset-4 hover:underline">{tx('Open opportunities', 'Avaa mahdollisuudet')}</Link>
    </div>
  );
}

export function GenericJobSummary({ job }: { job: ContentJob }) {
  const tx = useTx(); const { ph } = useStudio(); const f = useFmt(); const r = job.result ?? {};
  const rows: [string, ReactNode][] = [];
  if (job.kind === 'import') {
    if (r.documentId) rows.push([tx('Document', 'Asiakirja'), <Link key="d" href={ph(`/dashboard/content/documents/${r.documentId}`)} className="text-link underline-offset-4 hover:underline">{tx('Open imported article', 'Avaa tuotu artikkeli')}</Link>]);
    if (r.existing) rows.push([tx('Note', 'Huomio'), tx('Existing edits were preserved; nothing was overwritten.', 'Olemassa olevat muokkaukset säilytettiin; mitään ei ylikirjoitettu.')]);
  }
  if (job.kind === 'sitemap') {
    rows.push([tx('Pages discovered', 'Löydetyt sivut'), f.n(asArr(r.urls).length)], [tx('Import jobs queued', 'Jonotetut tuontityöt'), f.n(asArr(r.jobs).length)]);
  }
  if (job.kind === 'publish') {
    rows.push([tx('Status', 'Tila'), str(r.status)], [tx('Target', 'Kohde'), str(r.targetStatus)], [tx('Remote ID', 'Etätunnus'), str(r.remoteId) || Dash]);
    rows.push([tx('Published URL', 'Julkaistu osoite'), <ExtLink key="u" href={r.url} />], [tx('CMS channel', 'CMS-kanava'), str(r.channel)]);
  }
  return (
    <div className="space-y-3">
      {rows.length > 0 && <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[180px_1fr]">{rows.map(([k, v], i) => <div key={i} className="contents"><dt className="text-muted-ink">{k}</dt><dd>{v}</dd></div>)}</dl>}
      {job.kind === 'sitemap' && asArr(r.errors).length > 0 && <SourceErrors errors={asArr(r.errors)} />}
    </div>
  );
}

export function JobResult({ job }: { job: ContentJob }) {
  const r = job.result;
  if (!r) return null;
  if (job.kind === 'audit') return <AuditResult r={r} />;
  if (job.kind === 'research') return <ResearchResult r={r} />;
  if (job.kind === 'create') return <CreateResult r={r} />;
  if (job.kind === 'perception') return <PerceptionResult r={r} />;
  if (job.kind === 'impact') return <ImpactResult r={r} />;
  if (job.kind === 'opportunities') return <OpportunitiesResult r={r} />;
  if (job.kind === 'rewrite') return <RewriteList r={r} />;
  return <GenericJobSummary job={job} />;
}
export function RewriteList({ r }: { r: any }) {
  const tx = useTx();
  return <ul className="space-y-3">{asArr(r?.output?.changes).map((c, i) => <li key={i} className="rounded-lg border border-line p-3 text-sm"><p className="text-muted-ink line-through">{str(c.original)}</p><p className="mt-1 text-ink">{str(c.replacement)}</p><p className="mt-1 text-[12px] text-muted-ink">{tx('Reason', 'Peruste')}: {str(c.reason)}</p></li>)}</ul>;
}
