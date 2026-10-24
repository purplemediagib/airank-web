import { useMemo, useState } from 'react';
import { Link2, Globe } from 'lucide-react';
import { WebsiteFavicon } from './website-favicon';
import type { AnalyticsEvidence, SourceAnalytics } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useI18n } from '@/i18n';
import { EmptyState, Panel, StatusBadge } from './primitives';
import { FilterSelect, SearchInput } from './data';
import { safeUrl, useL } from './analytics';
import { Pager } from './research-parts';
import { AnswerDrawer } from './overview/answer-drawer';
import { ProviderMark } from './provider-brand';
import { SOURCE_TYPES } from '@/lib/use-intelligence';
import { PAGE, coverageFor, filterRows, matchedEvidence, sourceReferences, type SourceKind, type SourceRow, SOURCE_KINDS } from '@/lib/source-workbench';

export function useKindLabel() {
  const L = useL();
  return (k: string) => ({
    citation: L('Eksplisiittinen viittaus', 'Explicit citation'), source_reference: L('Lähdeviite', 'Source reference'),
    retrieval: L('Hakutulos', 'Search result'), answer_link: L('Vastauksen linkki', 'Answer link'),
  } as Record<string, string>)[k] ?? k;
}

export function KindTabs({ s, kind, onKind }: { s: SourceAnalytics; kind: SourceKind; onKind: (k: SourceKind) => void }) {
  const L = useL();
  const { num } = useI18n();
  const label = useKindLabel();
  return (
    <div role="tablist" aria-label={L('Todisteen tyyppi', 'Evidence kind')} className="flex flex-wrap gap-2" data-testid="tabs-source-kind">
      {SOURCE_KINDS.map((k) => {
        const c = coverageFor(s, k);
        return (
          <button key={k} role="tab" type="button" aria-selected={kind === k} onClick={() => onKind(k)} data-testid={`tab-kind-${k}`}
            className={`rounded-lg border px-3 py-2 text-left text-[13px] ${kind === k ? 'border-navy bg-tint text-navy' : 'border-line bg-card text-muted-ink hover:bg-canvas'}`}>
            <span className="block font-medium">{label(k)}</span>
            <span className="tabular block text-[11px]">{c ? L(`${num(c.answers)} vastausta, ${num(c.urls)} URL`, `${num(c.answers)} answers, ${num(c.urls)} URLs`) : L('Ei tietoa', 'No data')}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CoverageNote({ s, kind }: { s: SourceAnalytics; kind: SourceKind }) {
  const L = useL();
  const { num } = useI18n();
  const c = coverageFor(s, kind);
  const obs = c?.observable;
  return (
    <p className="text-[12px] text-muted-ink" data-testid="text-source-coverage">
      {obs === null || obs === undefined
        ? L('Havaittavuus tuntematon: toimittaja ei kerro, mitkä vastaukset voisivat sisältää tämän tyypin. Tuntematon ei tarkoita nollaa.', 'Observability unknown: the supplier does not report which answers could expose this kind. Unknown is not zero.')
        : L(`${num(c?.answers ?? 0)} / ${num(obs)} havaittavasta vastauksesta sisältää tämän tyypin.`, `${num(c?.answers ?? 0)} of ${num(obs)} observable answers contain this kind.`)}
      {' '}{L(`Kelvollisia vastauksia ${num(s.eligibleAnswers)}. Lähdeviitteet ja hakutulokset eivät ole eksplisiittisiä viittauksia eikä vahvistettuja sivuhakuja.`, `${num(s.eligibleAnswers)} eligible answers. Source references and search results are not explicit citations or verified page fetches.`)}
    </p>
  );
}

const catTone = (c: string) => (c === 'owned' ? 'success' : c === 'competitor' ? 'warning' : 'neutral') as 'success' | 'warning' | 'neutral';

export function SourceTable({ rows, by, kind, q, onQ, cat, onCat, sort, onSort, page, onPage, onOpen, total, type = 'all', onType, typeSupported, onReview, reviewBusy }: {
  type?: string; onType?: (v: string) => void; typeSupported?: boolean; onReview?: (domain: string, t: string | null) => void; reviewBusy?: boolean;
  rows: SourceRow[]; by: 'domain' | 'url'; kind: SourceKind; q: string; onQ: (v: string) => void; cat: string; onCat: (v: string) => void; sort: string; onSort: (v: string) => void;
  page: number; onPage: (p: number) => void; onOpen: (r: SourceRow, el: HTMLElement) => void; total: number;
}) {
  const L = useL();
  const { num } = useI18n();
  const catLabel = (c: string) => ({ owned: L('Oma', 'Owned'), competitor: L('Kilpailija', 'Competitor'), other: L('Muu', 'Other'), mixed: L('Sekalainen', 'Mixed') } as Record<string, string>)[c] ?? c;
  const typeLabel = (t: string) => ({ corporate: L('Yritys', 'Corporate'), ugc: L('Käyttäjäsisältö', 'User-generated'), editorial: L('Toimituksellinen', 'Editorial'), institutional: L('Instituutio', 'Institutional'), unknown: L('Tuntematon', 'Unknown') } as Record<string, string>)[t] ?? t;
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const max = rows.reduce((n,r) => Math.max(n,r.answers),1);
  return (
    <Panel className="overflow-hidden" as="div">
      <div className="flex flex-col gap-2 border-b border-line p-4 md:flex-row md:items-center">
        <SearchInput value={q} onChange={onQ} label={by === 'domain' ? L('Hae verkkotunnusta', 'Search domains') : L('Hae URL-osoitetta', 'Search URLs')} testId="input-search" />
        <div className="flex flex-wrap gap-2">
          <FilterSelect label={L('Omistus', 'Ownership')} value={cat} onChange={onCat} testId="select-owned" options={[{ value: 'all', label: L('Kaikki luokat', 'All categories') }, ...['owned', 'competitor', 'other', 'mixed'].map((v) => ({ value: v, label: catLabel(v) }))]} />
          {typeSupported && onType && <FilterSelect label={L('Julkaisijatyyppi', 'Publisher type')} value={type} onChange={onType} testId="select-source-type" options={[{ value: 'all', label: L('Kaikki tyypit', 'All types') }, ...SOURCE_TYPES.map((v) => ({ value: v, label: typeLabel(v) }))]} />}
          <FilterSelect label={L('Järjestys', 'Sort')} value={sort} onChange={onSort} testId="select-sort" options={[{ value: 'answers', label: L('Eniten vastauksia', 'Most answers') }, { value: 'name', label: L('Aakkosjärjestys', 'Alphabetical') }]} />
        </div>
      </div>
      {!rows.length ? <EmptyState icon={by === 'domain' ? <Globe className="size-[18px]" aria-hidden /> : <Link2 className="size-[18px]" aria-hidden />}
        title={total ? L('Ei osumia', 'No matches') : L('Ei tämän tyypin todisteita', 'No evidence of this kind')}
        body={total ? L('Muuta hakua tai suodatinta.', 'Change the search or filter.') : L('Valituissa vastauksissa ei ole tallennettuja kohteita tästä tyypistä. Puuttuva aineisto ei todista, ettei lähteitä käytetty.', 'No items of this kind were saved for the selected answers. Missing evidence does not prove sources were not used.')} /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid={`table-sources-${by}`}>
              <caption className="sr-only">{by === 'domain' ? L('Verkkotunnukset', 'Domains') : 'URL'}</caption>
              <thead className="hidden md:table-header-group"><tr className="border-b border-line text-[12px] text-muted-ink">
                <th scope="col" className="h-10 px-4 font-medium">{by === 'domain' ? L('Verkkotunnus', 'Domain') : 'URL'}</th>
                <th scope="col" className="px-4 font-medium">{by === 'domain' ? L('Yksilölliset URLit', 'Unique URLs') : L('Ilmoitetut esiintymät', 'Reported occurrences')}</th>
                {typeSupported && <th scope="col" className="px-4 font-medium">{L('Julkaisijatyyppi', 'Publisher type')}</th>}
                <th scope="col" className="w-[200px] px-4 font-medium">{L('Vastaukset', 'Answers')}</th>
                <th scope="col" className="px-4"><span className="sr-only">{L('Todisteet', 'Evidence')}</span></th>
              </tr></thead>
              <tbody>
                {shown.map((r) => {
                  const href = by === 'url' ? safeUrl(r.label) : null;
                  return (
                    <tr key={r.key} className="grid gap-1.5 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas/70 md:table-row md:p-0" data-testid={`row-source-${r.key}`}>
                      <td className="min-w-0 md:max-w-[460px] md:px-4 md:py-3">
                        <span className="flex flex-wrap items-center gap-2">
                          <WebsiteFavicon domain={r.domain} brand={r.domain} className="size-6 text-[11px]" />
                          {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-link hover:underline" data-testid={`link-source-${r.key}`}>{r.label}</a> : <span className="break-all font-medium text-ink">{r.label}</span>}
                          <StatusBadge tone={catTone(r.category)}>{catLabel(r.category)}</StatusBadge>
                        </span>
                        {by === 'url' && <span className="font-mono text-[11px] text-muted-ink">{r.domain}</span>}
                      </td>
                      <td className="tabular text-[13px] text-muted-ink md:px-4">
                        {by === 'domain' ? num(r.urls) : r.reportedOccurrences === null ? L('Ei ilmoitettu', 'Not reported') : L(`${num(r.reportedOccurrences)} (${num(r.occurrenceAnswers)} vastauksessa)`, `${num(r.reportedOccurrences)} (in ${num(r.occurrenceAnswers)} answers)`)}
                      </td>
                      {typeSupported && <td className="md:px-4">
                        <select value={r.sourceType ?? 'unknown'} disabled={!onReview || reviewBusy} aria-label={`${L('Julkaisijatyyppi', 'Publisher type')}: ${r.domain}`} data-testid={`select-review-${r.key}`}
                          onChange={(e) => onReview?.(r.domain, e.target.value === '__reset' ? null : e.target.value)} className="h-8 rounded-md border border-line bg-card px-1.5 text-[12px] text-ink">
                          {SOURCE_TYPES.map((v) => <option key={v} value={v}>{typeLabel(v)}</option>)}
                          <option value="__reset">{L('Palauta (poista ohitus)', 'Reset (clear override)')}</option>
                        </select>
                        <span className="block text-[10px] text-muted-ink" data-testid={`text-type-prov-${r.key}`}>{r.sourceTypeReviewedAt ? L('Käyttäjän vahvistama', 'User-confirmed') : (r.sourceType && r.sourceType !== 'unknown') ? L('Tunnistettu automaattisesti', 'Auto-detected') : L('Tuntematon', 'Unknown')}</span>
                      </td>}
                      <td className="md:px-4"><div className="flex items-center gap-2">
                        <span className="tabular w-8 text-right text-[13px] font-semibold text-ink">{num(r.answers)}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas ring-1 ring-line" aria-hidden><span className="block h-full rounded-full bg-navy" style={{ width: `${(r.answers / max) * 100}%` }} /></span>
                      </div></td>
                      <td className="md:px-4 md:text-right"><Button size="sm" variant="secondary" onClick={(e) => onOpen(r, e.currentTarget)} aria-label={`${L('Näytä vastaukset', 'Show answers')}: ${r.label}`} data-testid={`button-source-evidence-${r.key}`}>{L('Vastaukset', 'Answers')}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={rows.length} onPage={onPage} label={by === 'domain' ? L(`${num(rows.length)} verkkotunnusta`, `${num(rows.length)} domains`) : L(`${num(rows.length)} URL-osoitetta`, `${num(rows.length)} URLs`)} />
        </>
      )}
      <span className="sr-only" data-kind={kind} />
    </Panel>
  );
}

/** Evidence sheet for one source row; opens the immutable original answer with prev/next limited to matched evidence. */
export function SourceEvidence({ row, evidence, projectId, context, onClose, onCloseFocus }: {
  row: SourceRow | null; evidence: Map<string, AnalyticsEvidence>; projectId: string; context: string; onClose: () => void; onCloseFocus: () => void;
}) {
  const L = useL();
  const { num } = useI18n();
  const label = useKindLabel();
  const [sel, setSel] = useState('');
  const m = useMemo(() => (row ? matchedEvidence(row.evidenceIds, evidence) : { found: [], missing: 0 }), [row, evidence]);
  const idx = m.found.findIndex((e) => e.id === sel);
  const current = idx >= 0 ? m.found[idx] : null;
  const close = () => { setSel(''); onClose(); };
  return (
    <>
      <Sheet open={!!row && !current} onOpenChange={(v) => !v && close()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" onCloseAutoFocus={(e) => { e.preventDefault(); onCloseFocus(); }}>
          {row && <div className="flex flex-col gap-4" data-testid="drawer-source">
            <SheetHeader>
              <SheetTitle className="break-all">{row.label}</SheetTitle>
              <SheetDescription>{label(row.kind)}. {L(`${num(row.answers)} yksilöllistä vastausta.`, `${num(row.answers)} unique answers.`)}</SheetDescription>
            </SheetHeader>
            {m.missing > 0 && <p className="text-[12px] text-warning" data-testid="text-evidence-missing">{L(`${num(m.missing)} vastausta ei ole ladatussa aineistossa.`, `${num(m.missing)} answers are not in the loaded evidence.`)}</p>}
            <ul className="flex flex-col gap-2" data-testid="list-source-evidence">
              {m.found.map((e) => {
                const refs = sourceReferences(e, row);
                return (
                  <li key={e.id} className="rounded-lg border border-line p-3 text-[13px]" data-testid={`item-evidence-${e.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-ink">{e.text}</p>
                      <Button size="sm" variant="secondary" onClick={() => setSel(e.id)} data-testid={`button-open-answer-${e.id}`}>{L('Avaa vastaus', 'Open answer')}</Button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-ink">
                      <ProviderMark provider={e.provider} />
                      {e.collection?.surface && <span>{e.collection.surface === 'consumer_web' ? L('Kuluttajapalvelu', 'Consumer interface') : e.collection.surface}</span>}
                    </div>
                    {refs.length > 0 && <details className="mt-2 text-[12px]" data-testid={`details-provenance-${e.id}`}>
                      <summary className="cursor-pointer text-link">{L('Alkuperä', 'Provenance')} ({refs.length})</summary>
                      <ul className="mt-1 flex flex-col gap-1.5">{refs.slice(0, 20).map((s, i) => <li key={i} className="break-words rounded bg-canvas p-2">
                        {s.title && <p className="font-medium text-ink">{s.title}</p>}
                        <p className="font-mono text-[11px] text-muted-ink">{s.provenance}{s.occurrences !== undefined ? ` / ${s.occurrences}x` : ''}</p>
                        {s.snippet && <p className="text-muted-ink">{s.snippet}</p>}
                        {s.passage && <p className="text-muted-ink">{s.passage}</p>}
                      </li>)}</ul>
                      {refs.length > 20 && <p>{L(`Näytetään 20 / ${refs.length} yhteyttä.`, `Showing 20 of ${refs.length} associations.`)}</p>}
                    </details>}
                  </li>
                );
              })}
            </ul>
          </div>}
        </SheetContent>
      </Sheet>
      <AnswerDrawer e={current} index={Math.max(0, idx)} total={m.found.length} projectId={projectId} context={context}
        onPrev={() => idx > 0 && setSel(m.found[idx - 1].id)} onNext={() => idx < m.found.length - 1 && setSel(m.found[idx + 1].id)}
        onClose={() => setSel('')} onCloseFocus={() => undefined} />
    </>
  );
}
