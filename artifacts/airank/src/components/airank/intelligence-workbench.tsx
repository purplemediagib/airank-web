import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyticsEvidence, DiscoveredBrand, ProjectAnalytics } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'wouter';
import { useI18n } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { MAX_ANALYSE, analyseCandidates, canAnalyse, fanoutPage, jobsActive, jobsBlocked, splitBrands, useIntelligenceAction } from '@/lib/use-intelligence';
import { EmptyState, Panel, StatusBadge } from './primitives';
import { SearchInput } from './data';
import { pctText, useL } from './analytics';
import { Pager } from './research-parts';
import { ProviderMark } from './provider-brand';
import { AnswerDrawer } from './overview/answer-drawer';

const POLL_MAX = 12;

/** Finite refresh while jobs are queued/running; stops on budget/credential waits and after POLL_MAX tries. */
function useBoundedPoll(a: ProjectAnalytics | undefined, refetch: () => void) {
  const tries = useRef(0);
  const ref = useRef(refetch);
  ref.current = refetch;
  const i = a?.intelligence;
  const active = jobsActive(i) && !jobsBlocked(i);
  useEffect(() => {
    if (!active) { tries.current = 0; return; }
    if (tries.current >= POLL_MAX) return;
    const t = setTimeout(() => { tries.current += 1; ref.current(); }, Math.min(30_000, 3000 * 2 ** Math.min(tries.current, 3)));
    return () => clearTimeout(t);
  }, [active, a]);
}

function useScopedAnswer(scope: string, evidence: Map<string, AnalyticsEvidence>) {
  const [open, setOpen] = useState<{ ids: string[]; id: string } | null>(null);
  useEffect(() => { setOpen(null); }, [scope]);
  const found = open ? open.ids.map((id) => evidence.get(id)).filter((e): e is AnalyticsEvidence => !!e) : [];
  const idx = open ? found.findIndex((e) => e.id === open.id) : -1;
  return { found, idx, current: idx >= 0 ? found[idx] : null, openIds: (ids: string[], id: string) => setOpen({ ids, id }), close: () => setOpen(null), go: (n: number) => found[n] && open && setOpen({ ids: open.ids, id: found[n].id }) };
}

function BrandRow({ b, rank, busy, disabled, onAct, onOpen }: { b: DiscoveredBrand; rank?: number; busy: boolean; disabled: boolean; onAct: (r: 'confirmed' | 'rejected' | null) => void; onOpen: () => void }) {
  const L = useL();
  const { num, pct } = useI18n();
  return (
    <li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center" data-testid={`row-discovered-${b.key}`}>
      {rank !== undefined && <span className="tabular w-6 text-[13px] font-semibold text-muted-ink">{rank}</span>}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-ink">{b.name}
          {b.review === 'confirmed' && <StatusBadge tone="success">{L('Vahvistettu', 'Confirmed')}</StatusBadge>}
          {b.review === 'rejected' && <StatusBadge tone="neutral">{L('Hylätty', 'Rejected')}</StatusBadge>}
          {b.review === 'unreviewed' && <StatusBadge tone="warning">{L('Alustava', 'Provisional')}</StatusBadge>}
          {b.ambiguous && <StatusBadge tone="warning">{L('Epäselvä', 'Ambiguous')}</StatusBadge>}
        </p>
        <button type="button" className="text-[12px] text-link hover:underline" onClick={onOpen} data-testid={`button-discovered-answers-${b.key}`}>{L(`${num(b.answers)} vastausta, ${num(b.mentions.length)} mainintaa`, `${num(b.answers)} answers, ${num(b.mentions.length)} mentions`)}</button>
      </div>
      <dl className="tabular grid grid-cols-4 gap-4 text-[12px] text-muted-ink md:w-[320px]">
        <div><dt>{L('Näkyvyys', 'Visibility')}</dt><dd className="text-ink">{pctText(b.visibility, pct) ?? '-'}</dd></div>
        <div><dt>{L('Ka. sija', 'Avg pos.')}</dt><dd className="text-ink">{b.averagePosition === null ? '-' : b.averagePosition.toFixed(1)}</dd></div>
        <div><dt>{L('Ensin', 'First')}</dt><dd className="text-ink">{num(b.firstAnswers)}</dd></div>
        <div><dt>{L('Voitto', 'Win')}</dt><dd className="text-ink">{pctText(b.winRate, pct) ?? '-'}</dd></div>
      </dl>
      <div className="flex gap-1">
        {b.review !== 'confirmed' && <Button size="sm" variant="secondary" disabled={disabled || busy} onClick={() => onAct('confirmed')} data-testid={`button-brand-confirm-${b.key}`}>{L('Vahvista', 'Confirm')}</Button>}
        {b.review !== 'rejected' && <Button size="sm" variant="secondary" disabled={disabled || busy} onClick={() => onAct('rejected')} data-testid={`button-brand-reject-${b.key}`}>{L('Hylkää', 'Reject')}</Button>}
        {b.review !== 'unreviewed' && <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={() => onAct(null)} data-testid={`button-brand-reset-${b.key}`}>{L('Palauta', 'Reset')}</Button>}
      </div>
    </li>
  );
}

/** True extraction results. Review actions never touch the tracked competitor list. */
export function DiscoveryPanel({ a, projectId, context, refetch, readOnly }: { a: ProjectAnalytics; projectId: string; context: string; refetch: () => void; readOnly?: boolean }) {
  const L = useL();
  const { num } = useI18n();
  const { toast } = useToast();
  const act = useIntelligenceAction(projectId);
  const [confirm, setConfirm] = useState(false);
  const i = a.intelligence;
  const evidence = useMemo(() => new Map((a.evidence ?? []).map((e) => [e.id, e])), [a.evidence]);
  const scope = `${projectId}|${context}`;
  const ans = useScopedAnswer(scope, evidence);
  useBoundedPoll(a, refetch);
  const { ranked, review } = useMemo(() => splitBrands(i?.rankings ?? []), [i]);
  const candidates = useMemo(() => (i ? analyseCandidates((a.evidence ?? []).map((e) => e.id), i) : []), [a.evidence, i]);
  if (!i) return <Panel className="p-4" data-testid="panel-discovery"><EmptyState compact title={L('Vaatii taustapalvelun päivityksen', 'Backend upgrade needed')} body={L('Tämä palvelin ei palauta brändiuutiota.', 'This server does not return brand extraction.')} /></Panel>;
  const fail = (m: string) => toast({ variant: 'destructive', title: L(`Toiminto epäonnistui (${m})`, `Action failed (${m})`) });
  const doReview = (key: string, r: 'confirmed' | 'rejected' | null) => act.run({ action: 'brand_review', key, review: r }, { onSuccess: () => toast({ title: L('Tarkistus tallennettu', 'Review saved') }), onError: fail });
  const active = jobsActive(i);
  const failed = i.jobs.filter((j) => j.error && !['queued', 'running', 'analysing'].includes(j.state)).length;
  const reviewsOff = readOnly || !i.available;
  return (
    <Panel className="overflow-hidden" as="div" data-testid="panel-discovery">
      <div className="flex flex-col gap-2 border-b border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{L('Vastauksista havaitut brändit', 'Brands detected in answers')}</h2>
            <p className="text-[12px] text-muted-ink" data-testid="text-discovery-scope">{L('Järjestys on kirjaimellinen ensimmäinen maininta kaikkien havaittujen aktiivisten brändien joukossa, ei suositus- tai listasijaa. Ei seurantarajausta. Tunnistus ei ole täydellinen.', 'Order is literal first mention among all detected active brands, not an explicit recommendation or list position, and not limited to tracked brands. Detection is not perfect.')}</p>
          </div>
          <Button size="sm" disabled={readOnly || !canAnalyse(i) || !candidates.length || act.pending || active} onClick={() => setConfirm(true)} data-testid="button-analyse">{L('Analysoi vastauksia', 'Analyse answers')}</Button>
        </div>
        <p className="tabular text-[12px] text-ink" data-testid="text-extraction-coverage">{L(`Analysoitu ${num(i.analysedAnswers)} / ${num(i.eligibleAnswers)} kelvollisesta vastauksesta (mallinimi ${i.model}). Nimittäjä sisältää vastaukset ilman brändejä. Luvut ovat alustavia kunnes tarkistettu.`, `Analysed ${num(i.analysedAnswers)} of ${num(i.eligibleAnswers)} eligible answers (model ${i.model}). Denominator includes answers with no brands. Figures are provisional until reviewed.`)}</p>
        {!i.available && <p className="text-[12px] text-warning" data-testid="text-intel-unavailable">{L('Tietokantamigraatio puuttuu: analyysi ja tarkistukset eivät ole käytettävissä.', 'Database migration pending: analysis and reviews are unavailable.')}</p>}
        {i.available && !i.enabled && <p className="text-[12px] text-muted-ink" data-testid="text-intel-disabled">{L('Analyysityöntekijä ei ole käytössä. Tarkistukset toimivat, analyysin käynnistys ei.', 'The analysis worker is not enabled. Reviews work; starting analysis does not.')}</p>}
        {active && <p className="text-[12px] text-link" role="status" data-testid="text-intel-running">{L('Analyysi käynnissä, päivitetään rajatusti.', 'Analysis in progress, refreshing a limited number of times.')}</p>}
        {jobsBlocked(i) && <p className="text-[12px] text-warning" data-testid="text-intel-blocked">{L('Analyysi odottaa budjettia tai tunnuksia. Automaattista päivitystä ei jatketa.', 'Analysis is waiting on budget or credentials. Automatic refresh stopped.')}</p>}
        {failed > 0 && <div className="flex items-center gap-2 text-[12px] text-danger" data-testid="text-intel-failed">{L(`${num(failed)} analyysiä epäonnistui.`, `${num(failed)} analyses failed.`)}<Button size="sm" variant="ghost" onClick={refetch} data-testid="button-intel-retry">{L('Päivitä', 'Refresh')}</Button></div>}
      </div>
      {!ranked.length ? <EmptyState compact title={i.analysedAnswers ? L('Ei järjestettäviä brändejä', 'No rankable brands') : L('Ei vielä analysoituja vastauksia', 'No analysed answers yet')} body={i.analysedAnswers ? L('Tarkista alla olevat hylätyt tai epäselvät.', 'Check rejected or ambiguous brands below.') : L('Analyysiä ei käynnistetä automaattisesti.', 'Analysis is never started automatically.')} />
        : <ul className="divide-y divide-line" data-testid="list-discovered-ranked">{ranked.map((b, n) => <BrandRow key={b.key} b={b} rank={n + 1} busy={act.pending} disabled={reviewsOff} onAct={(r) => doReview(b.key, r)} onOpen={() => ans.openIds(b.evidenceIds, b.mentions[0]?.evidenceId ?? b.evidenceIds[0])} />)}</ul>}
      {review.length > 0 && <div className="border-t border-line bg-canvas/60" data-testid="section-brand-review">
        <p className="px-4 pt-3 text-[12px] font-medium text-ink">{L(`Tarkistettavat, ei järjestetty (${num(review.length)})`, `For review, not ranked (${num(review.length)})`)}</p>
        <ul className="divide-y divide-line">{review.map((b) => <BrandRow key={b.key} b={b} busy={act.pending} disabled={reviewsOff} onAct={(r) => doReview(b.key, r)} onOpen={() => ans.openIds(b.evidenceIds, b.mentions[0]?.evidenceId ?? b.evidenceIds[0])} />)}</ul>
      </div>}
      <Dialog open={confirm} onOpenChange={(v) => !act.pending && setConfirm(v)}>
        <DialogContent data-testid="dialog-analyse">
          <DialogHeader>
            <DialogTitle>{L('Käynnistetäänkö maksullinen analyysi?', 'Start paid analysis?')}</DialogTitle>
            <DialogDescription>{L(`Analysoi enintään ${MAX_ANALYSE} tallennettua vastausta. Tämä aiheuttaa kustannuksia ja päivittäinen yläraja on erillinen. Alkuperäisiä vastauksia ei muuteta.`, `Analyses up to ${MAX_ANALYSE} saved eligible answers. This costs money and has its own daily cap. Original answers are never changed.`)}</DialogDescription>
          </DialogHeader>
          <p className="tabular text-[13px] text-ink" data-testid="text-analyse-count">{L(`${num(candidates.length)} vastausta jonoon.`, `${num(candidates.length)} answers will be queued.`)}</p>
          <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-[12px] text-muted-ink">{candidates.slice(0, MAX_ANALYSE).map((id) => <li key={id} className="truncate">{evidence.get(id)?.text ?? id}</li>)}</ul>
          <DialogFooter>
            <Button variant="secondary" disabled={act.pending} onClick={() => setConfirm(false)} data-testid="button-analyse-cancel">{L('Peruuta', 'Cancel')}</Button>
            <Button disabled={act.pending || !candidates.length} onClick={() => act.run({ action: 'analyse', evidenceIds: candidates }, { onSuccess: () => { setConfirm(false); toast({ title: L('Analyysi jonossa', 'Analysis queued') }); }, onError: fail })} data-testid="button-analyse-confirm">{act.pending ? L('Jonotetaan...', 'Queuing...') : L('Vahvista ja jonota', 'Confirm and queue')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AnswerDrawer e={ans.current} index={Math.max(0, ans.idx)} total={ans.found.length} projectId={projectId} context={context} onPrev={() => ans.go(ans.idx - 1)} onNext={() => ans.go(ans.idx + 1)} onClose={ans.close} onCloseFocus={() => undefined} />
    </Panel>
  );
}

/** Captured search queries only. Suggested follow-ups are never shown here and queries are never ranked as brands. */
export function FanoutPanel({ a, projectId, context }: { a: ProjectAnalytics; projectId: string; context: string }) {
  const L = useL();
  const { num } = useI18n();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const f = a.intelligence?.fanout;
  const evidence = useMemo(() => new Map((a.evidence ?? []).map((e) => [e.id, e])), [a.evidence]);
  const ans = useScopedAnswer(`${projectId}|${context}`, evidence);
  if (!f) return <Panel className="p-4" data-testid="panel-fanout"><EmptyState compact title={L('Vaatii taustapalvelun päivityksen', 'Backend upgrade needed')} body={L('Tämä palvelin ei palauta hakukyselyitä.', 'This server does not return search queries.')} /></Panel>;
  const p = fanoutPage(f.queries, q, page);
  return (
    <Panel className="overflow-hidden" as="div" data-testid="panel-fanout">
      <div className="flex flex-col gap-2 border-b border-line p-4">
        <h2 className="text-[15px] font-semibold text-ink">{L('Tallennetut hakukyselyt', 'Captured search queries')}</h2>
        <p className="tabular text-[12px] text-muted-ink" data-testid="text-fanout-coverage">
          {f.observableAnswers === 0 ? L('Toimittaja ei kerro hakukyselyitä näille vastauksille: tuntematon, ei nolla.', 'The supplier does not report queries for these answers: unknown, not zero.')
            : L(`${num(f.withQueries)} / ${num(f.observableAnswers)} havaittavasta vastauksesta sisältää kyselyitä (${num(f.eligibleAnswers)} kelvollista).`, `${num(f.withQueries)} of ${num(f.observableAnswers)} observable answers have queries (${num(f.eligibleAnswers)} eligible).`)}
          {f.observableAnswers > 0 && f.withQueries === 0 && ' ' + L('Kyselyitä ei tehty.', 'Explicitly no queries were run.')}
        </p>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} label={L('Hae kyselyitä', 'Search queries')} testId="input-fanout-search" />
      </div>
      {!p.rows.length ? <EmptyState compact title={f.queries.length ? L('Ei osumia', 'No matches') : L('Ei tallennettuja kyselyitä', 'No captured queries')} />
        : <ul className="divide-y divide-line" data-testid="list-fanout">{p.rows.map((r) => (
          <li key={r.query} className="flex flex-col gap-1 px-4 py-3" data-testid={`row-fanout-${r.query}`}>
            <p className="break-words text-[13px] font-medium text-ink">{r.query}</p>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-ink">
              {r.providers.map((pv) => <ProviderMark key={pv} provider={pv} />)}
              <button type="button" className="text-link hover:underline" onClick={() => ans.openIds(r.evidenceIds, r.evidenceIds[0])} data-testid={`button-fanout-answers-${r.query}`}>{L(`${num(r.answers)} vastausta`, `${num(r.answers)} answers`)}</button>
              {r.variants.length > 1 && <span>{L(`${num(r.variants.length)} kirjoitusasua`, `${num(r.variants.length)} variants`)}: {r.variants.slice(0, 3).join(' | ')}</span>}
              {r.provenances.length > 0 && <span className="font-mono text-[11px]">{r.provenances.join(', ')}</span>}
            </div>
          </li>))}</ul>}
      {p.total > 0 && <Pager page={p.page} total={p.total} onPage={setPage} label={L(`${num(p.total)} kyselyä`, `${num(p.total)} queries`)} />}
      <AnswerDrawer e={ans.current} index={Math.max(0, ans.idx)} total={ans.found.length} projectId={projectId} context={context} onPrev={() => ans.go(ans.idx - 1)} onNext={() => ans.go(ans.idx + 1)} onClose={ans.close} onCloseFocus={() => undefined} />
    </Panel>
  );
}

/** Compact Overview summary. */
export function DiscoverySummary({ a, to }: { a: ProjectAnalytics; to: string }) {
  const L = useL();
  const { num } = useI18n();
  const i = a.intelligence;
  if (!i) return null;
  const { ranked, review } = splitBrands(i.rankings);
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3 p-4" as="div" data-testid="panel-discovery-summary">
      <p className="tabular text-[13px] text-ink">{L(`Havaitut brändit: ${num(ranked.length)} järjestetty, ${num(review.length)} tarkistettavana. Analysoitu ${num(i.analysedAnswers)} / ${num(i.eligibleAnswers)} vastausta.`, `Detected brands: ${num(ranked.length)} ranked, ${num(review.length)} to review. Analysed ${num(i.analysedAnswers)} of ${num(i.eligibleAnswers)} answers.`)}</p>
      <Link href={to} className="text-[12px] text-link hover:underline" data-testid="link-discovery">{L('Avaa havaitut brändit', 'Open discovered brands')}</Link>
    </Panel>
  );
}
