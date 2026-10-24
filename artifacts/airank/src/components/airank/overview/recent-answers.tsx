import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnalyticsEvidence } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { ANSWERS_PAGE_SIZE, matchEvidence } from '@/lib/overview-data';
import { toMs } from '@/lib/use-analytics';
import { FilterSelect, SearchInput } from '../data';
import { EmptyState, Panel, StatusBadge } from '../primitives';
import { exclusionLabel, useL } from '../analytics';
import { AnswerDrawer } from './answer-drawer';
import { ProviderMark } from '../provider-brand';

/** Client search + pagination over the complete, already-scoped selected-group evidence. */
export function RecentAnswers({ rows, filter, onFilter, answerId, onAnswer, projectId, context }: {
  rows: AnalyticsEvidence[]; filter: string; onFilter: (v: string) => void; answerId: string; onAnswer: (id: string) => void; projectId: string; context: string;
}) {
  const L = useL();
  const { date } = useI18n();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const shown = useMemo(() => rows.filter((e) => matchEvidence(e, filter, query)), [rows, filter, query]);
  const pages = Math.max(1, Math.ceil(shown.length / ANSWERS_PAGE_SIZE));
  const index = answerId ? shown.findIndex((e) => e.id === answerId) : -1;
  const current = index >= 0 ? shown[index] : null;
  const lastOpened = useRef('');
  if (current) lastOpened.current = current.id;

  useEffect(() => { setPage(1); }, [filter, query, rows]);
  // Keep the page in step with the open answer (deep links, prev/next across page boundaries).
  useEffect(() => { if (index >= 0) setPage(Math.floor(index / ANSWERS_PAGE_SIZE) + 1); }, [index]);
  const safePage = Math.min(page, pages);
  const slice = shown.slice((safePage - 1) * ANSWERS_PAGE_SIZE, safePage * ANSWERS_PAGE_SIZE);

  const focusRow = () => requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="button-answer-${CSS.escape(lastOpened.current)}"]`)?.focus());

  return (
    <Panel className="min-w-0 overflow-hidden" aria-labelledby="answers-title" data-testid="panel-recent-answers">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
        <div>
          <h2 id="answers-title" className="text-[15px] font-semibold text-ink">{L('Viimeisimmät vastaukset', 'Recent answers')}</h2>
          <p className="text-[11px] text-muted-ink">{L('Valitun ryhmän, aikavälin, palvelun ja aiheen alkuperäiset vastaukset.', 'Original answers for the selected group, range, provider and topic.')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SearchInput value={query} onChange={setQuery} label={L('Hae vastauksista', 'Search answers')} testId="input-search-answers" />
          <FilterSelect label={L('Näytä', 'Show')} value={filter} onChange={onFilter} testId="filter-evidence" options={[
            { value: 'all', label: L('Kaikki vastaukset', 'All answers') },
            { value: 'mentioned', label: L('Brändi mainittu', 'Brand mentioned') },
            { value: 'recommended', label: L('Suositeltu', 'Recommended') },
            { value: 'cited', label: L('Oma lähde viitattu', 'Owned source cited') },
            { value: 'ordered', label: L('Sijoitus seurattujen brändien joukossa', 'Position among tracked brands') },
            { value: 'first', label: L('Ensimmäinen seurattu brändi', 'First tracked brand') },
            { value: 'excluded', label: L('Poissuljettu', 'Excluded') },
          ]} />
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="p-4"><EmptyState compact title={rows.length === 0 ? L('Valinnalla ei ole vastauksia', 'No answers for this selection') : L('Ei hakua vastaavia vastauksia', 'No answers match')} body={rows.length === 0 ? L('Vastaukset näkyvät keruun valmistuttua. Tarkista keruun tila Kysymykset-sivulta.', 'Answers appear when collection completes. Check collection status on the Prompts page.') : L('Muuta hakua tai suodatinta.', 'Change the search or filter.')} /></div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line border-t border-line" data-testid="list-recent-answers">
            {slice.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onAnswer(e.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas focus-visible:bg-tint focus-visible:outline-none" data-testid={`button-answer-${e.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{e.text}</span>
                    <span className="block truncate text-[12px] text-muted-ink">{e.answer || L('Ei vastaustekstiä', 'No answer text')}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-ink"><ProviderMark provider={e.provider} />{date(new Date(toMs(e.observedAt)), { day: 'numeric', month: 'short' })}</span>
                    <span className="flex gap-1">
                      {e.exclusion !== null ? <StatusBadge tone="neutral">{exclusionLabel(e.exclusion, L)}</StatusBadge> : <>
                        {e.mentioned ? <StatusBadge tone="success">{L('Mainittu', 'Mentioned')}{e.position !== null ? ` · ${L('lista', 'list')} #${e.position}` : ''}</StatusBadge> : <StatusBadge tone="neutral" dot={false}>{L('Ei mainintaa', 'No mention')}</StatusBadge>}
                        {e.recommendation === 'recommended' && <StatusBadge tone="info" dot={false}>{L('Suositeltu', 'Recommended')}</StatusBadge>}
                        {e.ownedCitation && <StatusBadge tone="info" dot={false}>{L('Oma lähde', 'Owned')}</StatusBadge>}
                      </>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-[12px] text-muted-ink">
            <span data-testid="text-answers-total">{L(`${(safePage - 1) * ANSWERS_PAGE_SIZE + 1}–${(safePage - 1) * ANSWERS_PAGE_SIZE + slice.length} / ${shown.length}`, `${(safePage - 1) * ANSWERS_PAGE_SIZE + 1}–${(safePage - 1) * ANSWERS_PAGE_SIZE + slice.length} of ${shown.length}`)}</span>
            <div className="flex items-center gap-1">
              <span aria-live="polite" data-testid="text-answers-page">{L(`Sivu ${safePage} / ${pages}`, `Page ${safePage} of ${pages}`)}</span>
              <Button variant="ghost" size="icon" className="size-8" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label={L('Edellinen sivu', 'Previous page')} data-testid="button-answers-prev-page"><ChevronLeft aria-hidden /></Button>
              <Button variant="ghost" size="icon" className="size-8" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} aria-label={L('Seuraava sivu', 'Next page')} data-testid="button-answers-next-page"><ChevronRight aria-hidden /></Button>
            </div>
          </div>
        </>
      )}
      <AnswerDrawer e={current} index={index} total={shown.length} projectId={projectId} context={context}
        onPrev={() => index > 0 && onAnswer(shown[index - 1].id)} onNext={() => index < shown.length - 1 && onAnswer(shown[index + 1].id)}
        onClose={() => onAnswer('')} onCloseFocus={focusRow} />
    </Panel>
  );
}
