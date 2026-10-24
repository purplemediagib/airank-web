import { useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import type { AnalyticsEvidence, AnalyticsRun, EvidenceMetric, ProjectAnalytics } from '@workspace/api-client-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { ProviderMark } from './provider-brand';
import { FilterSelect, TrendChart, DataTable, type Point, type Series } from './data';
import { StatusBadge, ErrorState, EmptyState, type Tone } from './primitives';
import { utcDay, toMs } from '@/lib/use-analytics';

type Lf = (fi: string, en: string) => string;

export function useL(): Lf {
  const { locale } = useI18n();
  return (fi, en) => (locale === 'fi' ? fi : en);
}

export function pctText(v: number | null, pct: (n: number, d?: number) => string) {
  return v === null ? null : pct(v / 100, 1);
}

/** Diagnostic is determined by run kind only. */
export function isDiagnostic(run: AnalyticsRun) {
  return run.kind === 'diagnostic';
}

/** Localized group label; backend English prose labels are never shown. Group id stays as identifier. */
export function groupLabel(a: ProjectAnalytics | undefined, id: string, L: Lf) {
  const groups = a?.groups ?? [];
  const idx = groups.findIndex((g) => g.id === id);
  const g = groups[idx];
  const diag = (a?.runs ?? []).some((r) => r.group === id && isDiagnostic(r));
  const base = idx >= 0 ? `${L('Ryhmä', 'Group')} ${groups.length - idx}` : L('Ryhmä', 'Group');
  const count = g ? ` · ${g.runCount} ${L(g.runCount === 1 ? 'ajo' : 'ajoa', g.runCount === 1 ? 'run' : 'runs')}` : '';
  return `${base}${count}${diag ? ` · ${L('diagnostinen, ei mittareissa', 'diagnostic, excluded from metrics')}` : ''}`;
}

export function runStatus(s: string, L: Lf): { tone: Tone; label: string } {
  switch (s) {
    case 'queued': return { tone: 'info', label: L('Jonossa', 'Queued') };
    case 'running': return { tone: 'info', label: L('Käynnissä', 'Running') };
    case 'completed': return { tone: 'success', label: L('Valmis', 'Completed') };
    case 'partial': return { tone: 'warning', label: L('Osittainen', 'Partial') };
    case 'failed': return { tone: 'error', label: L('Epäonnistui', 'Failed') };
    case 'capacity_blocked': return { tone: 'warning', label: L('Kapasiteetti täynnä', 'Capacity blocked') };
    default: return { tone: 'neutral', label: s };
  }
}

export function metricStateLabel(s: string, L: Lf) {
  return s === 'complete' ? L('Täysi kattavuus', 'Complete coverage') : s === 'partial' ? L('Osittainen kattavuus; puuttuvia ei lasketa nolliksi', 'Partial coverage; missing answers are not counted as zero') : s === 'unavailable' ? L('Ei saatavilla', 'Unavailable') : s;
}

export function changeLabel(t: string, L: Lf) {
  const m: Record<string, [string, string]> = {
    'project.created': ['Projekti luotiin', 'Project created'],
    'prompt.created': ['Kysymys lisättiin', 'Prompt added'],
    'providers.updated': ['Palveluvalinta päivitettiin', 'Provider selection updated'],
    'identity.updated': ['Brändin tunnisteet päivitettiin', 'Brand identity updated'],
    'project.archived': ['Projekti arkistoitiin', 'Project archived'],
    'preferences.updated': ['Asetukset päivitettiin', 'Preferences updated'],
    'prompt.updated': ['Kysymyksen versio päivitettiin', 'Prompt version updated'],
    'prompt.archived': ['Kysymys arkistoitiin', 'Prompt archived'],
  };
  return m[t] ? L(m[t][0], m[t][1]) : t;
}

export function changeImpact(t: string, L: Lf) {
  if (t === 'identity.updated') return L('Uusi koostumusryhmä; aiemmat havainnot säilyvät alkuperäisessä ryhmässä.', 'New composition group; earlier observations stay in their original group.');
  if (t === 'prompt.created' || t === 'prompt.updated' || t === 'prompt.archived') return L('Kysymysjoukko muuttui; vertailu katkeaa.', 'Prompt set changed; comparison breaks.');
  if (t === 'project.created') return L('Uusi projekti; aiempaa projektihistoriaa ei ole.', 'New project; no earlier project history.');
  return L('Ei vaikutusta vertailuun.', 'No effect on comparison.');
}

function recLabel(r: string, L: Lf) {
  return r === 'recommended' ? L('Suositeltu', 'Recommended') : r === 'not_recommended' ? L('Ei suositeltu', 'Not recommended') : r === 'unknown' ? L('Suositus epäselvä', 'Recommendation unclear') : r;
}

export function exclusionLabel(x: string, L: Lf) {
  const m: Record<string, [string, string]> = {
    failed: ['Palvelun vastaus epäonnistui', 'Provider answer failed'],
    timeout: ['Aikakatkaisu', 'Timed out'],
    empty: ['Tyhjä vastaus', 'Empty answer'],
    empty_answer: ['Tyhjä vastaus', 'Empty answer'],
    no_grounding: ['Lähdetuki puuttuu', 'Missing grounding'],
    no_valid_response: ['Ei kelvollista vastausta', 'No valid answer'],
    provider_failed: ['Palvelun vastaus epäonnistui', 'Provider answer failed'],
    unconfigured: ['Palvelua ei ole määritetty', 'Provider not configured'],
    not_configured: ['Palvelua ei ole määritetty', 'Provider not configured'],
    disabled: ['Palvelu ei ole käytössä', 'Provider disabled'],
    budget_blocked: ['Kutsuraja saavutettu', 'Call budget reached'],
    interrupted_unknown: ['Keskeytynyt, tulos tuntematon', 'Interrupted; outcome unknown'],
    timeout_unknown: ['Aikakatkaisu, tulos tuntematon', 'Timed out; outcome unknown'],
    deadline_not_started: ['Aikaraja kului ennen aloitusta', 'Deadline elapsed before starting'],
    incomplete: ['Vastaus jäi kesken; ei mukana mittareissa', 'Incomplete answer; excluded from metrics'],
    unsupported_context: ['Markkinaa tai kieltä ei tueta', 'Market or language not supported'],
    diagnostic: ['Diagnostinen ajo', 'Diagnostic run'],
    capacity_blocked: ['Kapasiteetti täynnä', 'Capacity blocked'],
  };
  return m[x] ? L(m[x][0], m[x][1]) : `${L('Poissuljettu', 'Excluded')} (${x})`;
}

export function safeUrl(u: string): string | null {
  try { const p = new URL(u); return (p.protocol === 'http:' || p.protocol === 'https:') && !p.username && !p.password ? p.href : null; } catch { return null; }
}

const COLORS = ['#181f6b', '#2f7d6d', '#b8562b', '#6b5aa8', '#8a6d1d'];
const DASH = [undefined, '6 4', '2 3', '8 3 2 3', '1 4'];

/**
 * Each non-diagnostic run is its own chronological point (same-day runs are kept, never merged).
 * One line per composition group; a null gap point is inserted for every empty UTC day, no interpolation.
 */
export function GroupTrend({ a, from, days }: { a: ProjectAnalytics; from: string; days: number }) {
  const L = useL();
  const [location,navigate]=useLocation();
  const openPoint=(p:Point)=>{
    if(!p.runId || !p.group)return;
    const params=new URLSearchParams(window.location.search);
    params.set('run',String(p.runId));params.set('group',String(p.group));
    navigate(`${location}?${params}`);
  };
  const runs = a.runs.filter((r) => !isDiagnostic(r)).sort((x, y) => toMs(x.createdAt) - toMs(y.createdAt));
  const groupIds = Array.from(new Set(runs.map((r) => r.group)));
  const series: Series[] = groupIds.map((g, i) => ({ key: `g${i}`, label: groupLabel(a, g, L), color: COLORS[i % COLORS.length], dash: DASH[i % DASH.length] }));
  const empty = () => { const p: Record<string, null> = {}; series.forEach((s) => { p[s.key] = null; }); return p; };
  const runDays = new Set(runs.map((r) => utcDay(r.createdAt)));
  const points: { t: number; p: Point }[] = runs.map((r) => ({ t: toMs(r.createdAt), p: { date: new Date(toMs(r.createdAt)).toISOString(), runId:r.id, group:r.group, ...empty(), [`g${groupIds.indexOf(r.group)}`]: r.metrics.visibility } }));
  if (runs.length) {
    const start = new Date(`${from}T00:00:00Z`).getTime();
    for (let k = 0; k < days; k++) {
      const t = start + k * 86_400_000;
      const day = new Date(t).toISOString().slice(0, 10);
      if (!runDays.has(day)) points.push({ t: t + 43_200_000, p: { date: day, gap: '1', ...empty() } });
    }
  }
  const data = points.sort((x, y) => x.t - y.t).map((x) => x.p);
  return <TrendChart withTime onPointSelect={openPoint} title={L('Näkyvyys koostumusryhmittäin', 'Visibility by composition group')} series={series} data={data} emptyText={L('Valitulla aikavälillä ei ole vertailukelpoisia mittauksia.', 'No comparable measurements in the selected range.')} />;
}

/** Mean explicit rank per run; each composition stays separate and missing ranks remain null. */
export function PositionTrend({ a, from, days }: { a: ProjectAnalytics; from: string; days: number }) {
  const L = useL();
  const [location, navigate] = useLocation();
  const openPoint = (p: Point) => {
    if (!p.runId || !p.group) return;
    const params = new URLSearchParams(window.location.search);
    params.set('run', String(p.runId)); params.set('group', String(p.group));
    navigate(`${location}?${params}`);
  };
  const runs = a.runs.filter((r) => !isDiagnostic(r)).sort((x, y) => toMs(x.createdAt) - toMs(y.createdAt));
  const groupIds = Array.from(new Set(runs.map((r) => r.group)));
  const series: Series[] = groupIds.map((g, i) => ({ key: `g${i}`, label: groupLabel(a, g, L), color: COLORS[i % COLORS.length], dash: DASH[i % DASH.length] }));
  const empty = () => { const p: Record<string, null> = {}; series.forEach((s) => { p[s.key] = null; }); return p; };
  const points: { t: number; p: Point }[] = runs.map((r) => ({
    t: toMs(r.createdAt),
    p: {
      date: new Date(toMs(r.createdAt)).toISOString(),
      runId: r.id,
      group: r.group,
      ...empty(),
      [`g${groupIds.indexOf(r.group)}`]: r.metrics.meanPosition,
      rankedAnswers: r.metrics.positions,
    },
  }));
  if (runs.length) {
    const start = new Date(`${from}T00:00:00Z`).getTime();
    const runDays = new Set(runs.map((r) => utcDay(r.createdAt)));
    for (let k = 0; k < days; k++) {
      const t = start + k * 86_400_000;
      const day = new Date(t).toISOString().slice(0, 10);
      if (!runDays.has(day)) points.push({ t: t + 43_200_000, p: { date: day, gap: '1', ...empty(), rankedAnswers: null } });
    }
  }
  const data = points.sort((x, y) => x.t - y.t).map((x) => x.p);
  return <TrendChart withTime onPointSelect={openPoint} title={L('Listasijoitus koostumusryhmittäin', 'List position by composition')} series={series} data={data} sampleKey="rankedAnswers" valueFormat="number" emptyText={L('Valitulla aikavälillä ei ole vertailukelpoisia mittauksia.', 'No comparable measurements in the selected range.')} />;
}

export function metricSample(m: EvidenceMetric, L: Lf) {
  return `${m.eligible} / ${m.expected} ${L('kelvollista vastausta', 'valid responses')}${m.state !== 'complete' ? ` · ${metricStateLabel(m.state, L)}` : ''}`;
}

const isEligible = (e: AnalyticsEvidence) => e.exclusion === null;

/** Evidence table + drawer. Positive drilldowns use exact classification fields only; spans are context, not classification. */
export function EvidenceList({ rows, filter, onFilter }: { rows: AnalyticsEvidence[]; filter: string; onFilter: (v: string) => void }) {
  const L = useL();
  const { date } = useI18n();
  const [open, setOpen] = useState<AnalyticsEvidence | null>(null);
  const answerTrigger = useRef<HTMLButtonElement | null>(null);
  const shown = rows.filter((e) => {
    switch (filter) {
      case 'mentioned': return isEligible(e) && e.mentioned;
      case 'recommended': return isEligible(e) && e.recommendation === 'recommended';
      case 'cited': return isEligible(e) && e.ownedCitation;
      case 'excluded': return !isEligible(e);
      default: return true;
    }
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="px-5">
        <FilterSelect label={L('Näytä', 'Show')} value={filter} onChange={onFilter} testId="filter-evidence" options={[
          { value: 'all', label: L('Kaikki vastaukset', 'All answers') },
          { value: 'mentioned', label: L('Brändi mainittu', 'Brand mentioned') },
          { value: 'recommended', label: L('Suositeltu', 'Recommended') },
          { value: 'cited', label: L('Oma lähde viitattu', 'Owned source cited') },
          { value: 'excluded', label: L('Poissuljettu', 'Excluded') },
        ]} />
      </div>
      <DataTable
        testId="table-evidence"
        caption={L('Mittareiden todisteet', 'Metric evidence')}
        rows={shown}
        rowKey={(r) => r.id}
        columns={[
          { key: 'prompt', header: L('Kysymys', 'Prompt'), cell: (r) => <span className="line-clamp-2">{r.text} <span className="text-muted-ink">v{r.promptVersion}</span></span>, sortValue: (r) => r.text },
          { key: 'provider', header: L('Palvelu', 'Provider'), cell: (r) => <span className="flex flex-col gap-1"><ProviderMark provider={r.provider} /><span className="text-muted-ink">{r.model}</span></span>, sortValue: (r) => r.provider },
          { key: 'result', header: L('Tulos', 'Result'), cell: (r) => <EvidenceBadge e={r} /> },
          { key: 'observed', header: L('Havaittu', 'Observed'), cell: (r) => date(new Date(toMs(r.observedAt))), sortValue: (r) => r.observedAt },
          { key: 'open', header: '', align: 'right', cell: (r) => <Button size="sm" variant="secondary" onClick={(event) => {answerTrigger.current=event.currentTarget;setOpen(r);}} data-testid={`button-evidence-${r.id}`}>{L('Avaa', 'Open')}</Button> },
        ]}
        emptyTitle={L('Ei todisteita tällä suodatuksella', 'No evidence for this filter')}
        emptyBody={L('Mittarit lasketaan vain kelvollisista vastauksista.', 'Metrics are computed only from valid answers.')}
      />
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" onCloseAutoFocus={event=>{event.preventDefault();answerTrigger.current?.focus();}}>
          {open && <EvidenceDetail e={open} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EvidenceBadge({ e }: { e: AnalyticsEvidence }) {
  const L = useL();
  if (!isEligible(e)) return <StatusBadge tone="neutral">{exclusionLabel(e.exclusion!, L)}</StatusBadge>;
  return (
    <span className="flex flex-wrap gap-1">
      {e.mentioned ? <StatusBadge tone="success">{L('Mainittu', 'Mentioned')}{e.position !== null ? ` · #${e.position}` : ''}</StatusBadge> : <StatusBadge tone="neutral">{L('Ei mainintaa', 'Not mentioned')}</StatusBadge>}
      {e.recommendation === 'recommended' && <StatusBadge tone="info">{recLabel(e.recommendation, L)}</StatusBadge>}
    </span>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return <div className="flex flex-col gap-0.5 border-b border-line py-2"><dt className="text-[12px] text-muted-ink">{k}</dt><dd className="text-sm text-ink">{children}</dd></div>;
}

function EvidenceDetail({ e }: { e: AnalyticsEvidence }) {
  const L = useL();
  const { date } = useI18n();
  return (
    <div className="flex flex-col gap-4" data-testid="drawer-evidence">
      <SheetHeader>
        <SheetTitle>{L('Alkuperäinen vastaus', 'Original answer')}</SheetTitle>
        <SheetDescription><ProviderMark provider={e.provider} /> · {e.model} · {date(new Date(toMs(e.observedAt)), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</SheetDescription>
      </SheetHeader>
      <dl>
        <Row k={L('Kysymys ja versio', 'Prompt and version')}>{e.text} (v{e.promptVersion})</Row>
        <Row k={L('Tila', 'Status')}>{e.status === 'success' ? L('Onnistui', 'Succeeded') : e.status}</Row>
        <Row k={L('Mittareissa', 'In metrics')}>{isEligible(e) ? L('Kyllä', 'Yes') : exclusionLabel(e.exclusion!, L)}</Row>
        <Row k={L('Maininta', 'Mention')}>{e.mentioned ? L('Brändi mainittu', 'Brand mentioned') : L('Ei mainintaa', 'Not mentioned')}</Row>
        <Row k={L('Suositusluokitus', 'Recommendation classification')}>{recLabel(e.recommendation, L)}</Row>
        <Row k={L('Sijainti', 'Position')}>{e.position ?? L('Ei selkeää järjestystä', 'No clear ranking')}</Row>
      </dl>
      {e.recommendationSpans.length > 0 && <div>
        <h3 className="mb-1 text-[13px] font-semibold">{L('Suosituksiin liittyvät tekstikohdat', 'Recommendation-related text spans')}</h3>
        <p className="mb-1 text-[12px] text-muted-ink">{L('Kohdat voivat olla ristiriitaisia; luokitus yllä on ratkaiseva.', 'Spans may conflict; the classification above is authoritative.')}</p>
        <ul className="flex flex-col gap-1">{e.recommendationSpans.map((s, i) => <li key={i} className="rounded-md bg-canvas px-2 py-1 text-sm ring-1 ring-line">"{s}"</li>)}</ul>
      </div>}
      <div>
        <h3 className="mb-1 text-[13px] font-semibold">{L('Vastaus', 'Answer')}</h3>
        <p className="whitespace-pre-wrap break-words rounded-lg bg-canvas p-3 text-sm ring-1 ring-line" data-testid="text-evidence-answer">{e.answer || L('Ei vastaustekstiä', 'No answer text')}</p>
      </div>
      <div>
        <h3 className="mb-1 text-[13px] font-semibold">{L('Lähteet', 'Citations')} {e.ownedCitation && <StatusBadge tone="success">{L('Oma lähde', 'Owned source')}</StatusBadge>}</h3>
        {e.citations.length ? <ul className="flex flex-col gap-1 text-sm">{e.citations.map((c, i) => { const u = safeUrl(c); return <li key={i} className="break-all">{u ? <a className="underline" href={u} target="_blank" rel="noopener noreferrer nofollow">{c}</a> : c}</li>; })}</ul> : <p className="text-sm text-muted-ink">{L('Ei lähteitä', 'No citations')}</p>}
      </div>
    </div>
  );
}

/** Honest load failure: an absent analytics endpoint is "unavailable", never mocked data. */
export function AnalyticsFailure({ unavailable, onRetry }: { unavailable: boolean; onRetry: () => void }) {
  const L = useL();
  return unavailable
    ? <EmptyState title={L('Analytiikka ei ole vielä käytettävissä tällä palvelimella', 'Analytics are not available on this server yet')} body={L('Tallennetut tarkistukset ja seuranta-ajot ovat yhä avattavissa.', 'Saved checks and monitoring runs can still be opened.')} />
    : <ErrorState body={L('Analytiikan lataus epäonnistui', 'Analytics could not be loaded')} onRetry={onRetry} />;
}
