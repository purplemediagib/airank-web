import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, Globe2 } from 'lucide-react';
import { Link } from 'wouter';
import type { AnalyticsEvidence } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { brandSegments, hostOf } from '@/lib/overview-data';
import { useResult } from '@/lib/use-results';
import { toMs } from '@/lib/use-analytics';
import { AnswerText, QuoteList, SentimentBadge } from '../sentiment';
import { StatusBadge } from '../primitives';
import { exclusionLabel, safeUrl, useL } from '../analytics';
import { ProviderMark } from '../provider-brand';
import { CollectionDetails } from '../collection-details';

function Highlighted({ text, brands, testId }: { text: string; brands: string[]; testId: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[14px] leading-[23px] text-ink" data-testid={testId}>
      {brandSegments(text, brands).map((s, i) => s.brand ? <mark key={i} className="rounded bg-[#fff3b0] px-1 font-semibold text-ink" data-testid="highlight-brand">{s.text}</mark> : <span key={i}>{s.text}</span>)}
    </p>
  );
}

/** Original frozen answer. Text only (no HTML rendering); brand highlights are exact frozen mention names. */
export function AnswerDrawer({ e, index, total, onPrev, onNext, onClose, projectId, context, onCloseFocus }: {
  e: AnalyticsEvidence | null; index: number; total: number; onPrev: () => void; onNext: () => void; onClose: () => void; projectId: string; context: string; onCloseFocus: () => void;
}) {
  const L = useL();
  const { href, date } = useI18n();
  const [mode, setMode] = useState<'brands' | 'quotes'>('brands');
  const result = useResult(projectId, e?.id ?? '');
  const r = result.data && result.data.id === e?.id ? result.data : undefined;
  const quotes = r?.sentiment?.quotes ?? [];
  const brands = e?.brandNames ?? [];
  const pq = `?project=${encodeURIComponent(projectId)}${context}`;
  return (
    <Dialog open={!!e} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex h-[min(88dvh,820px)] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl" data-testid="dialog-answer" onCloseAutoFocus={(ev) => { ev.preventDefault(); onCloseFocus(); }}>
        {e && (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-h-0 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 pr-12">
                <span className="rounded-md border border-line px-2 py-0.5 text-[12px] font-semibold text-ink"><ProviderMark provider={e.provider} /></span>
                <span className="font-mono text-[11px] text-muted-ink">{e.model}</span>
                {e.market && <span className="text-[12px] text-muted-ink">{e.market}{e.language ? ` · ${e.language}` : ''}</span>}
                <DialogTitle className="sr-only">{L('Alkuperäinen vastaus', 'Original answer')}</DialogTitle>
                <DialogDescription className="text-[12px] text-muted-ink">{date(new Date(toMs(e.observedAt)), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</DialogDescription>
                <Link href={`${href(`/dashboard/prompts/${encodeURIComponent(e.promptId)}`)}${pq}`} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-link hover:underline" data-testid="link-answer-prompt">{L('Avaa kysymys', 'View prompt')} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
                <Link href={`${href(`/dashboard/results/${encodeURIComponent(e.id)}`)}${pq}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-link hover:underline" data-testid="link-answer-result">{L('Tuloksissa', 'In Results')} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div className="ml-auto max-w-[85%] rounded-2xl bg-canvas px-4 py-3 ring-1 ring-line">
                  <Highlighted text={e.text} brands={brands} testId="text-answer-prompt" />
                  <p className="mt-1 text-[11px] text-muted-ink">v{e.promptVersion}{e.topic ? ` · ${e.topic}` : ''}</p>
                </div>
                {e.exclusion !== null && <StatusBadge tone="neutral">{L('Ei mittareissa', 'Not in metrics')}: {exclusionLabel(e.exclusion, L)}</StatusBadge>}
                {quotes.length > 0 && (
                  <div className="inline-flex rounded-lg border border-line p-0.5 text-[12px]" role="group" aria-label={L('Korostus', 'Highlighting')}>
                    <button type="button" aria-pressed={mode === 'brands'} onClick={() => setMode('brands')} className={`rounded-md px-2.5 py-1 ${mode === 'brands' ? 'bg-navy text-white' : 'text-muted-ink'}`} data-testid="toggle-highlight-brands">{L('Brändit', 'Brands')}</button>
                    <button type="button" aria-pressed={mode === 'quotes'} onClick={() => setMode('quotes')} className={`rounded-md px-2.5 py-1 ${mode === 'quotes' ? 'bg-navy text-white' : 'text-muted-ink'}`} data-testid="toggle-highlight-quotes">{L('Sävylainaukset', 'Sentiment quotes')}</button>
                  </div>
                )}
                {e.answer
                  ? (mode === 'quotes' && quotes.length ? <AnswerText answer={e.answer} quotes={quotes} mode="exact" language={e.language} /> : <Highlighted text={e.answer} brands={brands} testId="text-evidence-answer" />)
                  : <p className="text-[13px] text-muted-ink" data-testid="text-evidence-answer">{L('Ei vastaustekstiä', 'No answer text')}</p>}
              </div>
              <div className="flex items-center justify-between border-t border-line px-3 py-2">
                <Button variant="ghost" size="sm" disabled={index <= 0} onClick={onPrev} data-testid="button-answer-prev"><ArrowLeft aria-hidden /> {L('Edellinen', 'Previous')}</Button>
                <span className="tabular text-[12px] text-muted-ink" data-testid="text-answer-position">{index + 1} / {total}</span>
                <Button variant="ghost" size="sm" disabled={index >= total - 1} onClick={onNext} data-testid="button-answer-next">{L('Seuraava', 'Next')} <ArrowRight aria-hidden /></Button>
              </div>
            </div>
            <aside className="min-h-0 space-y-5 overflow-y-auto border-t border-line bg-canvas px-4 py-4 md:border-l md:border-t-0" aria-label={L('Tiedot', 'Details')}>
              <CollectionDetails collection={r?.collection || e.collection} meta={r?.meta} surface={r?.measurementSurface || e.measurementSurface} observation={r?.observation || e.observation} collectionMethod={r?.collectionMethod || e.collectionMethod} metricVersion={r?.metricVersion || e.metricVersion} />
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-ink"><Building2 className="size-3.5" aria-hidden />{L('Mainitut brändit', 'Brands mentioned')}</h3>
                {e.brandNames === undefined ? <p className="text-[12px] text-muted-ink">{L('Ei saatavilla tältä palvelimelta', 'Not available from this server')}</p>
                  : brands.length === 0 ? <p className="text-[12px] text-muted-ink">{L('Ei seurattuja brändejä', 'No tracked brands')}</p>
                  : <ul className="flex flex-col gap-1" data-testid="list-answer-brands">{brands.map((b) => <li key={b} className="rounded-md bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line">{b}</li>)}</ul>}
              </section>
              <section>
                <h3 className="mb-2 text-[12px] font-semibold text-muted-ink">{L('Sävy', 'Sentiment')}</h3>
                {result.isPending && e.id ? <span className="ar-skeleton block h-5 w-24" /> : r ? (
                  <div className="space-y-2"><SentimentBadge sentiment={r.sentiment} analysis={r.sentimentAnalysis} state={r.state} testId="status-answer-sentiment" />{quotes.length > 0 && <QuoteList answer={e.answer} quotes={quotes} onFocus={() => setMode('quotes')} />}</div>
                ) : <p className="text-[12px] text-muted-ink" data-testid="text-answer-sentiment-unavailable">{L('Sävytietoja ei voitu hakea.', 'Sentiment details could not be loaded.')}</p>}
              </section>
              <section data-testid="section-answer-brand-order">
                <h3 className="mb-2 text-[12px] font-semibold text-muted-ink">{L('Ensimmäisten mainintojen järjestys', 'First-mention order')}</h3>
                <p className="mb-2 text-[11px] text-muted-ink">{L('Vain ajoon tallennetut seuratut brändit. Listasijoitus on erillinen mittari.', 'Frozen tracked brands only. Explicit list rank is a separate metric.')}</p>
                {!e.brandOrder || e.brandOrder.state === 'unavailable'
                  ? <p className="text-[12px] text-muted-ink">{L('Ei saatavilla tästä havainnosta.', 'Unavailable for this observation.')}</p>
                  : <>
                    {e.brandOrder.state === 'ambiguous' && <p className="mb-2 text-[12px] text-warning">{L('Päällekkäiset nimet: sijoituksia ei lasketa.', 'Overlapping brand aliases: no positions assigned.')}</p>}
                    {e.brandOrder.mentions.length === 0 ? <p className="text-[12px] text-muted-ink">{L('Ei seurattujen brändien mainintoja.', 'No tracked-brand mentions.')}</p>
                      : <ol className="space-y-1.5">{e.brandOrder.mentions.map(mention => <li key={mention.brandName} className="rounded-md bg-white px-2.5 py-1.5 text-[12px] ring-1 ring-line"><b>{mention.position == null ? '–' : `#${mention.position}`} · {mention.brandName}</b><span className="block break-words text-muted-ink">“{mention.quote}” · {mention.start}–{mention.end}</span></li>)}</ol>}
                  </>}
              </section>
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-ink"><Globe2 className="size-3.5" aria-hidden />{L('Lähteet', 'Sources')} {e.ownedCitation && <StatusBadge tone="success">{L('Oma', 'Owned')}</StatusBadge>}</h3>
                {e.citations.length === 0 ? <p className="text-[12px] text-muted-ink">{e.collection?.citationObservation === 'unavailable' ? L('Suorien viitteiden kartoitus ei ole saatavilla. Katso yllä olevat lähdeviitteet.', 'Explicit citation mapping is unavailable. See the source entries above.') : L('Ei tallennettuja viitteitä', 'No explicit citations recorded')}</p> : (
                  <ol className="flex flex-col gap-2" data-testid="list-answer-citations">{e.citations.map((c, i) => { const u = safeUrl(c); return (
                    <li key={i} className="min-w-0 text-[12px]">{u ? <a href={u} target="_blank" rel="noopener noreferrer nofollow" className="block truncate font-medium text-link hover:underline">{hostOf(u)}</a> : <span className="font-medium text-ink">{L('Ei linkitettävä', 'Non-linkable')}</span>}<span className="block break-all text-[11px] text-muted-ink">{c}</span></li>
                  ); })}</ol>
                )}
              </section>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
