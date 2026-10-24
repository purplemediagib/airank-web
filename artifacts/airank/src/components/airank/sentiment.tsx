import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, ExternalLink, Info } from 'lucide-react';
import type { BrandSentiment, ResultCitation, ResultItem, SentimentAnalysis, SentimentMetrics, SentimentQuote } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { ProviderMark } from './provider-brand';
import { toMs } from '@/lib/use-analytics';
import {
  LABEL_COLOR, SENTIMENT_LABELS, WAITING_ANALYSIS, citationParts, collectionInfo, highlightSegments, plainPreview,
  safeHttpUrl, sentimentLabelText, sentimentStatusInfo, verifyQuote,
} from '@/lib/sentiment';
import { EmptyState, Panel, StatusBadge } from './primitives';
import { useL } from './analytics';

/* ---------- Badges ---------- */
export function CollectionBadge({ state, testId }: { state: string | null | undefined; testId?: string }) {
  const L = useL();
  const c = collectionInfo(state, L);
  return <StatusBadge tone={c.tone} data-testid={testId}>{c.label}</StatusBadge>;
}

/** Sentiment cell: score + label only when assessed; never null-as-zero. */
export function SentimentBadge({ sentiment, analysis, state, testId }: { sentiment?: BrandSentiment | null; analysis?: SentimentAnalysis | null; state?: string; testId?: string }) {
  const L = useL();
  const { num } = useI18n();
  if (state && state !== 'success') return <span className="text-[12px] text-muted-ink" data-testid={testId}>{L('Ei sovellu', 'Not applicable')}</span>;
  const job = analysis?.state;
  if (sentiment?.status === 'assessed' && sentiment.score !== null && sentiment.score !== undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink" data-testid={testId}>
        <span className="size-2 rounded-full" style={{ background: LABEL_COLOR[sentiment.label ?? ''] ?? '#9aa6b8' }} aria-hidden />
        {sentimentLabelText(sentiment.label, L)} · <span className="tabular">{num(sentiment.score, { maximumFractionDigits: 1 })}</span>
      </span>
    );
  }
  // The analysis job decides whether work is still outstanding, not only the tracked brand's status.
  const status = sentiment?.status && sentiment.status !== 'not_analysed' ? sentiment.status : job && job !== 'done' ? (job === 'running' ? 'analysing' : job) : sentiment?.status ?? 'not_analysed';
  const info = sentimentStatusInfo(status, L);
  return <StatusBadge tone={info.tone} dot={false} data-testid={testId}>{info.label}</StatusBadge>;
}

/* ---------- Pagination ---------- */
export function Pager({ page, pageSize, total, hasMore, onPage, testId = 'pager' }: { page: number; pageSize: number; total: number; hasMore: boolean; onPage: (p: number) => void; testId?: string }) {
  const L = useL();
  const { num } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12px] text-muted-ink" data-testid={testId}>
      <span className="tabular">{num(first)}–{num(last)} / {num(total)}</span>
      <div className="flex items-center gap-1">
        <span className="mr-2 tabular" aria-live="polite">{L('Sivu', 'Page')} {num(page)} / {num(pages)}</span>
        <Button variant="ghost" size="icon" className="size-9 md:size-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={L('Edellinen sivu', 'Previous page')} data-testid={`${testId}-prev`}><ChevronLeft aria-hidden /></Button>
        <Button variant="ghost" size="icon" className="size-9 md:size-8" disabled={!hasMore && page >= pages} onClick={() => onPage(page + 1)} aria-label={L('Seuraava sivu', 'Next page')} data-testid={`${testId}-next`}><ChevronRight aria-hidden /></Button>
      </div>
    </div>
  );
}

/* ---------- Results table (Results explorer + Prompt detail) ---------- */
export function ResultsTable({ items, openHref, showQuestion = true, testId = 'table-results' }: { items: ResultItem[]; openHref: (id: string) => string; showQuestion?: boolean; testId?: string }) {
  const L = useL();
  const { date } = useI18n();
  const when = (i: ResultItem) => {
    const t = i.observedAt ?? i.runCreatedAt;
    return t ? date(new Date(toMs(t)), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–';
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" data-testid={testId}>
        <caption className="sr-only">{L('Tallennetut vastaukset ja keskeneräiset tehtävät', 'Saved answers and unfinished tasks')}</caption>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-line text-[12px] text-muted-ink">
            <th scope="col" className="h-10 px-4 font-medium">{L('Palvelu', 'Provider')}</th>
            <th scope="col" className="px-4 font-medium">{showQuestion ? L('Kysymys / vastaus', 'Prompt / answer') : L('Vastaus', 'Answer')}</th>
            <th scope="col" className="px-4 font-medium">{L('Keruu', 'Collection')}</th>
            <th scope="col" className="px-4 font-medium">{L('Sävy', 'Sentiment')}</th>
            <th scope="col" className="px-4 font-medium">{L('Lähteet', 'Sources')}</th>
            <th scope="col" className="px-4 font-medium">{L('Havaittu', 'Observed')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const preview = plainPreview(i.answer, 180);
            return (
              <tr key={i.id} className="grid gap-1.5 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas/70 md:table-row md:p-0" data-testid={`row-result-${i.id}`}>
                <td className="md:px-4 md:py-3 md:align-top">
                  <ProviderMark provider={i.provider} className="font-semibold text-ink" />
                  {i.model && <p className="max-w-[160px] truncate font-mono text-[11px] text-muted-ink" title={i.model}>{i.model}</p>}
                  {i.promptVersion !== null && i.promptVersion !== undefined && <p className="tabular text-[11px] text-muted-ink">v{i.promptVersion}</p>}
                </td>
                <td className="min-w-0 md:max-w-[460px] md:px-4 md:py-3">
                  <Link href={openHref(i.id)} className="group block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan" data-testid={`link-result-${i.id}`}>
                    {showQuestion && <span lang={i.language ?? undefined} className="line-clamp-2 font-medium text-ink group-hover:text-link group-hover:underline">{i.text}</span>}
                    <span lang={i.language ?? undefined} className={cn('mt-0.5 line-clamp-2 break-words text-[12px] leading-[17px]', preview ? 'text-muted-ink' : 'italic text-[#8a94a6]', !showQuestion && 'group-hover:text-link')}>
                      {preview || (i.state === 'queued' || i.state === 'running' ? L('Vastausta haetaan…', 'Answer being collected…') : L('Ei tallennettua vastausta', 'No saved answer'))}
                    </span>
                  </Link>
                  {i.metricsEligible === false && i.state === 'success' && <span className="mt-1 inline-block rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-ink ring-1 ring-line">{L('Ei pääluvuissa', 'Not in headline metrics')}</span>}
                </td>
                <td className="md:px-4 md:align-top md:py-3"><CollectionBadge state={i.state} testId={`status-collection-${i.id}`} /></td>
                <td className="md:px-4 md:align-top md:py-3"><SentimentBadge sentiment={i.sentiment} analysis={i.sentimentAnalysis} state={i.state} testId={`status-sentiment-${i.id}`} /></td>
                <td className="tabular text-[13px] text-ink md:px-4 md:align-top md:py-3">{i.collection ? new Set(i.collection.sourceReferences.filter(s => s.kind !== 'retrieval').map(s => s.url)).size : i.citations.length} <span className="text-muted-ink md:hidden">{L('lähdettä', 'sources')}</span></td>
                <td className="tabular whitespace-nowrap text-[12px] text-muted-ink md:px-4 md:align-top md:py-3">{when(i)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Answer text with exact highlights ---------- */
export function AnswerText({ answer, quotes, language, activeQuote, mode }: { answer: string; quotes: SentimentQuote[]; language?: string | null; activeQuote?: number | null; mode: 'exact' | 'readable' }) {
  const L = useL();
  if (mode === 'readable') {
    // Readable view drops Markdown syntax per line; highlights are only shown in the exact view.
    return (
      <div lang={language ?? undefined} className="space-y-2 break-words text-[15px] leading-[24px] text-ink" data-testid="text-answer-readable">
        {answer.split(/\n{2,}/).map((para, k) => <p key={k} className="whitespace-pre-line">{para.split('\n').map((ln) => plainPreview(ln, 10_000)).join('\n')}</p>)}
      </div>
    );
  }
  const segs = highlightSegments(answer, quotes);
  return (
    <div lang={language ?? undefined} className="whitespace-pre-wrap break-words font-[inherit] text-[15px] leading-[24px] text-ink" data-testid="text-answer-exact">
      {segs.map((s, k) => s.quote ? (
        <mark key={k} id={`quote-${s.index}`} className={cn('rounded-sm px-0.5 text-ink transition-colors', activeQuote === s.index ? 'ring-2 ring-cyan' : '')}
          style={{ background: `${LABEL_COLOR[s.quote.polarity] ?? '#9aa6b8'}2e`, boxShadow: `inset 0 -2px 0 ${LABEL_COLOR[s.quote.polarity] ?? '#9aa6b8'}` }}
          title={`${sentimentLabelText(s.quote.polarity, L)}${s.quote.attribute ? ` · ${s.quote.attribute}` : ''}`} data-testid={`highlight-quote-${s.index}`}>{s.text}</mark>
      ) : <span key={k}>{s.text}</span>)}
    </div>
  );
}

export function QuoteList({ answer, quotes, onFocus }: { answer: string; quotes: SentimentQuote[]; onFocus?: (i: number) => void }) {
  const L = useL();
  const { num } = useI18n();
  if (!quotes.length) return <p className="text-[13px] text-muted-ink">{L('Ei tukilainauksia.', 'No supporting quotes.')}</p>;
  return (
    <ul className="flex flex-col gap-2" data-testid="list-quotes">
      {quotes.map((q, i) => {
        const ok = verifyQuote(answer, q);
        return (
          <li key={i} className="rounded-lg border border-line bg-[#fbfcfd] p-3" data-testid={`quote-${i}`}>
            <button type="button" disabled={!ok} onClick={() => onFocus?.(i)} className="w-full text-left disabled:cursor-default">
              <span className="block border-l-2 pl-2.5 text-[13px] leading-[19px] text-ink" style={{ borderColor: LABEL_COLOR[q.polarity] ?? '#9aa6b8' }}>"{q.text}"</span>
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-ink">
              <span className="font-semibold text-ink">{sentimentLabelText(q.polarity, L)}</span>
              {q.score !== null && q.score !== undefined && <span className="tabular">· {num(q.score)}</span>}
              {q.attribute && <span>· {q.attribute}</span>}
              <span className={cn('ml-auto rounded px-1.5 py-0.5 font-semibold', ok ? 'bg-tint text-link' : 'bg-[#fbeee8] text-[#9a3d22]')} data-testid={`status-quote-${i}`}>
                {ok ? L('Täsmää tallennettuun vastaukseen', 'Matches saved answer') : L('Sijaintia ei voitu varmistaa', 'Offsets could not be verified')}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Sources ---------- */
export function SourceList({ citations }: { citations: ResultCitation[] }) {
  const L = useL();
  if (!citations.length) return <p className="text-[13px] text-muted-ink">{L('Vastauksessa ei ollut lähdeviittauksia.', 'The answer contained no citations.')}</p>;
  return (
    <ol className="flex flex-col gap-2 text-[13px]" data-testid="list-sources">
      {citations.map((c, i) => {
        const { url, title } = citationParts(c);
        const safe = safeHttpUrl(url);
        let host = '';
        try { host = safe ? new URL(safe).hostname : ''; } catch { host = ''; }
        return (
          <li key={i} className="flex min-w-0 gap-2">
            <span className="tabular w-5 shrink-0 text-muted-ink">{i + 1}.</span>
            <div className="min-w-0">
              {safe ? <a href={safe} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 font-medium text-link hover:underline" data-testid={`link-source-${i}`}><span className="truncate">{title || host}</span><ExternalLink className="size-3 shrink-0" aria-hidden /><span className="sr-only">{L('(avautuu uuteen välilehteen)', '(opens in a new tab)')}</span></a> : <span className="font-medium text-ink">{title || L('Ei linkitettävä lähde', 'Non-linkable source')}</span>}
              <p className="break-all text-[11px] text-muted-ink">{url}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Aggregate sentiment ---------- */
export function sentimentWaiting(s: SentimentMetrics | undefined): { pending: number; waiting: number; unavailable: number } {
  const st = s?.states ?? {};
  const sum = (keys: string[]) => keys.reduce((n, k) => n + (st[k] ?? 0), 0);
  return {
    pending: sum(['queued', 'analysing', 'not_analysed']),
    waiting: sum([...WAITING_ANALYSIS]),
    unavailable: sum(['failed', 'interrupted_unknown', 'unsupported_language', 'answer_too_long', 'too_many_brands', 'unclassified', 'evidence_changed', 'disabled', 'not_configured']),
  };
}

export function SentimentScoreCard({ s, testId = 'sentiment', footer }: { s: SentimentMetrics | undefined; testId?: string; footer?: ReactNode }) {
  const L = useL();
  const { num, pct } = useI18n();
  const has = !!s && s.score !== null && s.score !== undefined && s.state !== 'incomparable';
  const stateNote = !s || s.state === 'unavailable'
    ? L('Sävyanalyysi ei ole saatavilla tälle valinnalle.', 'Sentiment analysis is not available for this selection.')
    : s.state === 'incomparable' ? L('Eri analyysiversioiden tuloksia ei yhdistetä. Katso ryhmät alta.', 'Results from different analysis versions are not combined. See groups below.')
    : s.state === 'partial' ? L('Osa mainitsevista vastauksista odottaa analyysiä.', 'Some mentioning answers are still awaiting analysis.') : null;
  return (
    <Panel as="article" className="flex min-w-0 flex-col gap-1 p-5" data-testid={`card-${testId}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-ink">{L('Brändin sävy', 'Brand sentiment')}</p>
        <span title={L('Kuvauksen sävy tallennetuissa API-vastauksissa, ei asiakastyytyväisyys.', 'Tone of portrayal in saved API answers, not customer satisfaction.')}><Info className="size-3.5 text-muted-ink" aria-label={L('Määritelmä', 'Definition')} /></span>
      </div>
      <p className={cn('tabular text-[32px] font-semibold leading-[46px]', has ? 'text-ink' : 'text-[#b4bdcb]')} data-testid={`value-${testId}`}>
        {has ? <>{num(s!.score as number, { maximumFractionDigits: 1 })}<span className="text-base font-medium text-muted-ink"> / 100</span></> : '–'}
      </p>
      {s && (s.sampleSize ?? 0) > 0 && <p className="text-[12px] text-muted-ink" data-testid={`text-${testId}-sample`}>{L(`Perustuu ${s.sampleSize} arvioituun vastaukseen`, `Based on ${s.sampleSize} assessed answers`)}</p>}
      {s && s.coverage !== null && s.coverage !== undefined && <p className="text-[12px] text-muted-ink" data-testid={`text-${testId}-coverage`}>{L(`${pct(s.coverage / 100, 1)} mainitsevista vastauksista arvioitu`, `${pct(s.coverage / 100, 1)} of mentioned answers assessed`)}</p>}
      {stateNote && <p className="text-[12px] leading-[17px] text-muted-ink" data-testid={`text-${testId}-state`}>{stateNote}</p>}
      {has && (s!.sampleSize ?? 0) < 10 && <p className="text-[11px] text-[#8a6d1d]">{L('Pieni otos ei ole vakaa brändiarvio.', 'A low sample is not a stable brand rating.')}</p>}
      {footer}
    </Panel>
  );
}

export function SentimentGroups({ s }: { s: SentimentMetrics | undefined }) {
  const L = useL();
  const { num } = useI18n();
  if (!s?.groups?.length || s.state !== 'incomparable') return null;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line" data-testid="list-sentiment-groups">
      {s.groups.map((g, i) => (
        <li key={g.id ?? i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px]">
          <span className="min-w-0 break-all font-mono text-muted-ink">{g.model ?? L('Malli ei tiedossa', 'Model unknown')} · {(g.analysisVersion ?? '').slice(0, 10)}</span>
          <span className="tabular font-semibold text-ink">{g.score === null || g.score === undefined ? '–' : `${num(g.score, { maximumFractionDigits: 1 })} / 100`} <span className="font-normal text-muted-ink">({g.sampleSize})</span></span>
        </li>
      ))}
    </ul>
  );
}

/** Stacked bar plus table alternative; mixed stays a distinct category. */
export function LabelDistribution({ s }: { s: SentimentMetrics | undefined }) {
  const L = useL();
  const { num, pct } = useI18n();
  const counts = s?.labelCounts ?? {};
  const total = SENTIMENT_LABELS.reduce((n, k) => n + (counts[k] ?? 0), 0);
  if (!total) return <EmptyState compact title={L('Ei arvioituja vastauksia', 'No assessed answers')} body={L('Jakauma näkyy, kun mainitsevia vastauksia on arvioitu.', 'The breakdown appears once mentioning answers have been assessed.')} />;
  return (
    <div className="flex flex-col gap-3" data-testid="chart-sentiment-distribution">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-canvas" role="img" aria-label={SENTIMENT_LABELS.map((k) => `${sentimentLabelText(k, L)} ${counts[k] ?? 0}`).join(', ')}>
        {SENTIMENT_LABELS.map((k) => (counts[k] ?? 0) > 0 && <span key={k} style={{ width: `${((counts[k] ?? 0) / total) * 100}%`, background: LABEL_COLOR[k] }} title={`${sentimentLabelText(k, L)}: ${counts[k]}`} />)}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{L('Sävyjakauma', 'Sentiment breakdown')}</caption>
        <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted-ink"><th scope="col" className="py-2">{L('Arvio', 'Assessment')}</th><th scope="col" className="text-right">{L('Vastaukset', 'Answers')}</th><th scope="col" className="text-right">{L('Osuus', 'Share')}</th></tr></thead>
        <tbody className="divide-y divide-line">
          {SENTIMENT_LABELS.map((k) => (
            <tr key={k} data-testid={`row-label-${k}`}>
              <th scope="row" className="py-2 text-left font-medium text-ink"><span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: LABEL_COLOR[k] }} aria-hidden />{sentimentLabelText(k, L)}</th>
              <td className="tabular text-right">{num(counts[k] ?? 0)}</td>
              <td className="tabular text-right text-muted-ink">{pct((counts[k] ?? 0) / total, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
