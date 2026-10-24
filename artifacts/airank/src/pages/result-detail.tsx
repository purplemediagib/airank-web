import { useMemo, useState } from 'react';
import { Link, useParams, useSearch } from 'wouter';
import { ArrowLeft, ArrowRight, FileJson } from 'lucide-react';
import type { ResultItem } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle, useI18n } from '@/i18n';
import { useProjects } from '@/lib/project-context';
import { useResult, useResults } from '@/lib/use-results';
import { toMs } from '@/lib/use-analytics';
import { ProviderMark } from '@/components/airank/provider-brand';
import { CollectionDetails } from '@/components/airank/collection-details';
import { brandAssessments, resultParamsFromSearch, resultsContextQuery, sentimentLabelText, sentimentStatusInfo, verifyQuote } from '@/lib/sentiment';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { useL } from '@/components/airank/analytics';
import { AnswerText, CollectionBadge, QuoteList, SentimentBadge, SourceList } from '@/components/airank/sentiment';

/** Previous/next within the current filtered context; crosses page boundaries by loading only the adjacent page. */
function useNeighbours(projectId: string, id: string, search: string) {
  const params = useMemo(() => resultParamsFromSearch(search), [search]);
  const cur = useResults(projectId, params);
  const items = cur.data?.items ?? [];
  const idx = items.findIndex((i) => i.id === id);
  const needPrev = idx === 0 && params.page > 1;
  const needNext = idx >= 0 && idx === items.length - 1 && !!cur.data?.hasMore;
  const prevPage = useResults(projectId, { ...params, page: params.page - 1 }, { enabled: needPrev });
  const nextPage = useResults(projectId, { ...params, page: params.page + 1 }, { enabled: needNext });
  if (idx < 0) return { prev: null, next: null, position: null as null | { n: number; total: number } };
  const prev = idx > 0 ? { id: items[idx - 1].id, page: params.page } : needPrev && prevPage.data?.items.length ? { id: prevPage.data.items[prevPage.data.items.length - 1].id, page: params.page - 1 } : null;
  const next = idx < items.length - 1 ? { id: items[idx + 1].id, page: params.page } : needNext && nextPage.data?.items.length ? { id: nextPage.data.items[0].id, page: params.page + 1 } : null;
  return { prev, next, position: { n: (params.page - 1) * params.pageSize + idx + 1, total: cur.data?.total ?? 0 } };
}

function Meta({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5 border-b border-line py-2 last:border-0"><dt className="text-[11px] text-muted-ink">{k}</dt><dd className="break-words text-[13px] text-ink">{children}</dd></div>;
}

function Detail({ r }: { r: ResultItem }) {
  const L = useL();
  const { date, num, href } = useI18n();
  const { projectHref } = useProjects();
  const brands = brandAssessments(r);
  const [brandKey, setBrandKey] = useState<string | null>(null);
  const selected = brands.find((b) => b.key === brandKey) ?? brands[0];
  const s = selected?.s;
  const quotes = s?.status === 'assessed' ? s.quotes ?? [] : [];
  const answer = r.answer ?? '';
  const allVerified = quotes.every((q) => verifyQuote(answer, q));
  const [mode, setMode] = useState<'exact' | 'readable'>('exact');
  const [active, setActive] = useState<number | null>(null);
  const info = sentimentStatusInfo(s?.status, L);
  const attributes = Array.from(new Set(quotes.map((q) => q.attribute).filter((a): a is string => !!a)));
  const when = r.observedAt ?? r.runCreatedAt;
  const focus = (i: number) => { setMode('exact'); setActive(i); requestAnimationFrame(() => document.getElementById(`quote-${i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })); };
  const job = r.sentimentAnalysis?.state;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel className="p-5" aria-labelledby="answer-h">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-ink" data-testid="text-provider"><ProviderMark provider={r.provider} /></span>
            {r.model && <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-muted-ink ring-1 ring-line" data-testid="text-model">{r.model}</span>}
            <CollectionBadge state={r.state} testId="status-collection" />
            {r.metricsEligible === false && <StatusBadge tone="neutral" dot={false}>{L('Ei pääluvuissa', 'Excluded from headline metrics')}</StatusBadge>}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-ink" data-testid="text-context">
            {[r.market && `${L('Markkina', 'Market')} ${r.market}`, r.language && `${L('Kieli', 'Language')} ${r.language}`, when && date(new Date(toMs(when)), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-4 rounded-lg bg-canvas p-3 ring-1 ring-line">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-ink">{L('Tallennettu kysymys', 'Saved question')}{r.promptVersion ? ` · v${r.promptVersion}` : ''}{r.topic ? ` · ${r.topic}` : ''}</p>
            <p lang={r.language ?? undefined} className="mt-1 text-[15px] font-medium text-ink" data-testid="text-question">{r.text}</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <h2 id="answer-h" className="text-[16px] font-semibold text-ink">{L('Alkuperäinen vastaus', 'Original answer')}</h2>
            {answer && (
              <div className="inline-flex rounded-lg bg-canvas p-0.5 ring-1 ring-line" role="group" aria-label={L('Vastauksen näkymä', 'Answer view')}>
                {(['exact', 'readable'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-muted-ink'}`} data-testid={`button-mode-${m}`}>
                    {m === 'exact' ? L('Alkuperäinen teksti + korostukset', 'Raw text + highlights') : L('Luettava', 'Readable')}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3"><CollectionDetails collection={r.collection} meta={r.meta} surface={r.measurementSurface} observation={r.observation} collectionMethod={r.collectionMethod} metricVersion={r.metricVersion} /></div>
          {answer ? (
            <div className="mt-3 max-h-[70vh] overflow-y-auto pr-1">
              <AnswerText answer={answer} quotes={quotes} language={r.language} activeQuote={active} mode={mode} />
            </div>
          ) : <p className="mt-3 text-sm text-muted-ink">{r.state === 'queued' || r.state === 'running' ? L('Vastausta haetaan vielä. Sivu päivittyy automaattisesti.', 'The answer is still being collected. This page refreshes automatically.') : L('Tähän tehtävään ei tallentunut vastausta.', 'No answer was saved for this task.')}</p>}
          <p className="mt-3 text-[11px] leading-4 text-muted-ink">{mode === 'exact' ? L('Korostukset näytetään vain, kun lainaus täsmää täsmälleen tallennettuun vastaukseen. Vastausta ei käännetä eikä muokata.', 'Highlights are shown only where a quote exactly matches the saved answer. The answer is never translated or rewritten.') : L('Luettava näkymä poistaa Markdown-merkinnät. Tarkat korostukset näkyvät alkuperäisessä tekstissä.', 'The readable view removes Markdown syntax. Exact highlights are shown in the raw text view.')}</p>
        </Panel>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <Panel className="p-5" aria-labelledby="sent-h">
          <h2 id="sent-h" className="text-[16px] font-semibold text-ink">{L('Brändin sävy', 'Brand sentiment')}</h2>
          {brands.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={L('Valitse brändi', 'Select brand')}>
              {brands.map((b) => (
                <button key={b.key} type="button" role="radio" aria-checked={selected?.key === b.key} onClick={() => { setBrandKey(b.key); setActive(null); }}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ${selected?.key === b.key ? 'bg-tint text-ink ring-cyan' : 'bg-white text-muted-ink ring-line hover:text-ink'}`} data-testid={`button-brand-${b.key}`}>
                  {b.s.brandName ?? L('Nimetön brändi', 'Unnamed brand')}
                </button>
              ))}
            </div>
          )}
          {!s ? (
            <div className="mt-3"><SentimentBadge analysis={r.sentimentAnalysis} state={r.state} testId="status-sentiment" /></div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-[12px] text-muted-ink">{L('Brändi', 'Brand')}: <b className="text-ink" data-testid="text-brand">{s.brandName ?? '–'}</b></p>
              {info.scored && s.score !== null && s.score !== undefined ? (
                <p className="text-[22px] font-semibold text-ink" data-testid="value-brand-score">{sentimentLabelText(s.label, L)} · <span className="tabular">{num(s.score, { maximumFractionDigits: 1 })}</span><span className="text-sm font-medium text-muted-ink"> / 100</span></p>
              ) : (
                <div><StatusBadge tone={info.tone} dot={false} data-testid="status-brand-sentiment">{info.label}</StatusBadge>{info.explain && <p className="mt-1.5 text-[12px] leading-[17px] text-muted-ink">{info.explain}</p>}</div>
              )}
              {job && job !== 'done' && s.status !== 'assessed' && <p className="text-[11px] text-muted-ink">{L('Analyysityön tila', 'Analysis job state')}: <span className="font-mono">{job}</span></p>}
              {info.scored && <>
                <p className="text-[12px] text-muted-ink">{L(`Perustuu ${quotes.length} täsmälliseen lainaukseen`, `Based on ${quotes.length} exact supporting quote${quotes.length === 1 ? '' : 's'}`)}</p>
                {!allVerified && <ReasonNote tone="warning">{L('Kaikkia lainauksia ei voitu paikantaa tallennettuun vastaukseen. Niitä ei korosteta.', 'Some quotes could not be located in the saved answer. They are not highlighted.')}</ReasonNote>}
                <QuoteList answer={answer} quotes={quotes} onFocus={focus} />
              </>}
            </div>
          )}
        </Panel>
        {attributes.length > 0 && (
          <Panel className="p-5" aria-labelledby="attr-h">
            <h2 id="attr-h" className="text-[15px] font-semibold text-ink">{L('Poimitut ominaisuudet', 'Extracted attributes')}</h2>
            <ul className="mt-2 flex flex-wrap gap-1.5">{attributes.map((a) => <li key={a} className="rounded-md bg-canvas px-2 py-1 text-[12px] text-ink ring-1 ring-line">{a}</li>)}</ul>
            <p className="mt-2 text-[11px] text-muted-ink">{L('Automaattisesti poimittuja kuvauksia vastauksesta, ei varmennettuja tosiasioita.', 'Automatically extracted descriptions from the answer, not verified facts.')}</p>
          </Panel>
        )}
        <Panel className="p-5" aria-labelledby="src-h">
          <h2 id="src-h" className="text-[15px] font-semibold text-ink">{L('Viitatut lähteet', 'Cited sources')} <span className="tabular text-muted-ink">({r.citations.length})</span></h2>
          <div className="mt-3"><SourceList citations={r.citations} /></div>
          <p className="mt-3 text-[11px] text-muted-ink">{L('Palvelun ilmoittamia lähteitä. Niiden sisältöä ei ole varmennettu.', 'Sources reported by the provider. Their content has not been independently verified.')}</p>
        </Panel>
        <Panel className="p-5" aria-labelledby="meth-h">
          <h2 id="meth-h" className="text-[15px] font-semibold text-ink">{L('Analyysin menetelmä', 'Analysis methodology')}</h2>
          <dl className="mt-2">
            <Meta k={L('Vastauksen tuottanut malli', 'Model that produced the answer')}><span className="font-mono text-[12px]">{r.model ?? '–'}</span></Meta>
            <Meta k={L('Sävyn analysoinut malli', 'Model that analysed sentiment')}><span className="font-mono text-[12px]">{s?.model ?? '–'}</span>{s?.requestedModel && s.requestedModel !== s.model && <span className="block text-[11px] text-muted-ink">{L('Pyydetty', 'Requested')}: {s.requestedModel}</span>}</Meta>
            <Meta k={L('Arviointiohje', 'Rubric')}><span className="font-mono text-[12px]">{s?.rubricVersion ?? '–'}</span></Meta>
            <Meta k={L('Analyysiversio', 'Analysis version')}><span className="break-all font-mono text-[11px]">{s?.analysisVersion ?? r.sentimentAnalysis?.analysisVersion ?? '–'}</span></Meta>
            {s?.assessedAt && <Meta k={L('Arvioitu', 'Assessed')}>{date(new Date(toMs(s.assessedAt)), { dateStyle: 'medium', timeStyle: 'short' })}</Meta>}
            <Meta k={L('Sijoitus', 'Recommendation rank')}>{r.position ?? L('Ei eksplisiittistä sijoitusta', 'No explicit rank')}</Meta>
          </dl>
          <p className="mt-3 text-[11px] leading-4 text-muted-ink">{L('Sävy kuvaa tallennetun API-vastauksen kuvausta brändistä, ei asiakastyytyväisyyttä eikä tosiasioiden oikeellisuutta. Automaattinen arvio, joka kannattaa tarkistaa.', 'Sentiment describes the portrayal in the saved API answer, not customer sentiment or factual accuracy. It is a reviewable automated assessment.')}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
            <Link href={projectHref('/dashboard/methodology')} className="font-semibold text-link hover:underline" data-testid="link-methodology">{L('Menetelmä', 'Methodology')}</Link>
            {r.state === 'success' && <Link href={projectHref(`/dashboard/evidence/${encodeURIComponent(r.id)}`)} className="inline-flex items-center gap-1 font-semibold text-link hover:underline" data-testid="link-envelope"><FileJson className="size-3.5" aria-hidden />{L('Tallennettu todistekirje', 'Stored evidence envelope')}</Link>}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

export default function ResultDetailPage() {
  const L = useL();
  const { href } = useI18n();
  const { id = '' } = useParams<{ id: string }>();
  const search = useSearch();
  const { project } = useProjects();
  const projectId = project?.id ?? '';
  const q = useResult(projectId, id);
  const nb = useNeighbours(projectId, id, search);
  useDocumentTitle(L('Vastauksen todisteet', 'Answer evidence'));
  if (!project) return null;
  const ctx = resultsContextQuery(search);
  const linkTo = (target: { id: string; page: number }) => {
    const p = new URLSearchParams(ctx);
    if (target.page > 1) p.set('page', String(target.page)); else p.delete('page');
    return `${href(`/dashboard/results/${encodeURIComponent(target.id)}`)}?${p}`;
  };
  const back = <Link href={`${href('/dashboard/results')}?${ctx}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-ink hover:text-ink" data-testid="link-back"><ArrowLeft className="size-4" aria-hidden />{L('Takaisin tuloksiin', 'Back to results')}</Link>;
  const nav = (
    <div className="flex items-center gap-2">
      {nb.position && <span className="tabular text-[12px] text-muted-ink" data-testid="text-position">{nb.position.n} / {nb.position.total}</span>}
      {nb.prev ? <Button asChild variant="secondary" size="sm"><Link href={linkTo(nb.prev)} data-testid="link-prev-result"><ArrowLeft aria-hidden />{L('Edellinen', 'Previous')}</Link></Button> : <Button variant="secondary" size="sm" disabled data-testid="link-prev-result"><ArrowLeft aria-hidden />{L('Edellinen', 'Previous')}</Button>}
      {nb.next ? <Button asChild variant="secondary" size="sm"><Link href={linkTo(nb.next)} data-testid="link-next-result">{L('Seuraava', 'Next')}<ArrowRight aria-hidden /></Link></Button> : <Button variant="secondary" size="sm" disabled data-testid="link-next-result">{L('Seuraava', 'Next')}<ArrowRight aria-hidden /></Button>}
    </div>
  );
  return (
    <div className="flex flex-col gap-5" data-testid="page-result-detail">
      <PageHeader back={back} title={L('Vastauksen todisteet', 'Answer evidence')} subtitle={L('Tallennettu kysymys, alkuperäinen vastaus, lähteet ja täsmälliset sävylainaukset.', 'Saved question, original answer, sources and exact sentiment excerpts.')} actions={nav} />
      {q.isPending ? <Panel className="p-5"><LoadingBlock rows={8} /></Panel>
        : q.forbidden ? <Panel><EmptyState title={L('Ei käyttöoikeutta', 'Access denied')} body={L('Tämä vastaus kuuluu toiselle tilille.', 'This answer belongs to another account.')} /></Panel>
        : q.isError && !q.data ? (q.httpStatus === 404 ? <Panel><EmptyState title={L('Vastausta ei löytynyt', 'Answer not found')} body={L('Se voi kuulua toiseen projektiin, tai tulosrajapinta ei ole käytössä tällä palvelimella.', 'It may belong to another project, or the results API is not enabled on this server.')} /></Panel> : <Panel><ErrorState onRetry={() => void q.refetch()} /></Panel>)
        : q.data ? <>{q.isError && <ReasonNote tone="warning">{L('Päivitys epäonnistui. Näytetään viimeksi haettu vastaus.', 'Refresh failed. Showing the last loaded answer.')}</ReasonNote>}<Detail key={q.data.id} r={q.data} /></> : null}
    </div>
  );
}
