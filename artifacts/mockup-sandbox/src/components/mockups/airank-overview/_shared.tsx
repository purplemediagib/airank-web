import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import type { Point, Series } from './_types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Illustrative local fixtures only. This mirrors the generated ProjectAnalytics and Research contracts;
// no API client, production data, account state, or app route is imported into the sandbox.
export type EvidenceMetric = {
  eligible: number; expected: number; mentions: number; ownedCitations: number; classified: number;
  recommended: number; positions: number; visibility: number | null; score: number | null;
  citationRate: number | null; recommendationRate: number | null; cohortShare: number | null;
  cohortMentions: number; meanPosition: number | null; state: string;
};
export type AnalyticsEvidence = {
  id: string; runId: string; promptId: string; promptVersion: number; text: string; answer: string;
  provider: string; model: string; status: string; observedAt: number; mentioned: boolean;
  ownedCitation: boolean; recommendation: string; recommendationSpans: string[];
  position: number | null; exclusion: string | null; citations: string[];
};
export type ProjectAnalytics = {
  methodology: string; extractionVersion: string; selectedGroup: string | null;
  groups: { id: string; runCount: number; latestAt: number; label: string }[];
  metrics: EvidenceMetric;
  providers: { provider: string; metrics: EvidenceMetric }[];
  runs: { id: string; createdAt: number; kind: string; status: string; group: string; comparableToPrevious: boolean; metrics: EvidenceMetric }[];
  evidence: AnalyticsEvidence[]; changes: { id: string; createdAt: string; type: string; version: number }[];
  topics: string[]; availableProviders: string[]; totalRuns: number; quickChecks: number;
  market: string; language: string;
};
export type Research = {
  version: number;
  competitors: { id: string; name: string; aliases: string[]; domains: string[]; status: string; version: number }[];
  candidates: { id: string; name: string; evidenceIds: string[]; status: string; brandId: string | null }[];
  sources: { url: string; domain: string; answers: number; owned: boolean; evidenceIds: string[] }[];
  evidence: AnalyticsEvidence[];
};

const metric = (values: Partial<EvidenceMetric> = {}): EvidenceMetric => ({
  eligible: 84, expected: 96, mentions: 54, ownedCitations: 24, classified: 80, recommended: 39,
  positions: 48, visibility: 64.3, score: 6.4, citationRate: 28.6, recommendationRate: 48.8,
  cohortShare: 35, cohortMentions: 154, meanPosition: 2.8, state: 'partial', ...values,
});
const dayMs = 86_400_000;
const now = Date.now();
const ago = (days: number) => now - days * dayMs;
const illustrativeEvidence: AnalyticsEvidence[] = [
  {
    id: 'ev-101', runId: 'run-204', promptId: 'prompt-1', promptVersion: 2,
    text: 'What is a reliable Finnish analytics studio for a growing brand?', answer: 'Aava Studio is a Finnish analytics and brand strategy studio. Its team is often recommended for clear, evidence-led work.',
    provider: 'OpenAI', model: 'gpt-4.1', status: 'success', observedAt: ago(1), mentioned: true,
    ownedCitation: true, recommendation: 'recommended', recommendationSpans: ['often recommended for clear, evidence-led work'],
    position: 1, exclusion: null, citations: ['https://aava.example/services', 'https://example.fi/brand-strategy'],
  },
  {
    id: 'ev-102', runId: 'run-204', promptId: 'prompt-2', promptVersion: 1,
    text: 'Which agencies help companies improve their online visibility?', answer: 'Several Finnish agencies work in this area, including Aava Studio, which focuses on digital strategy and analytics.',
    provider: 'Anthropic', model: 'claude-sonnet', status: 'success', observedAt: ago(1), mentioned: true,
    ownedCitation: false, recommendation: 'unknown', recommendationSpans: [], position: 3, exclusion: null,
    citations: ['https://industry.example/agency-guide'],
  },
  {
    id: 'ev-103', runId: 'run-203', promptId: 'prompt-1', promptVersion: 2,
    text: 'What is a reliable Finnish analytics studio for a growing brand?', answer: 'Aava Studio works with Finnish companies on analytics and brand strategy.',
    provider: 'OpenAI', model: 'gpt-4.1', status: 'success', observedAt: ago(8), mentioned: true,
    ownedCitation: true, recommendation: 'recommended', recommendationSpans: ['works with Finnish companies'],
    position: 2, exclusion: null, citations: ['https://aava.example/about'],
  },
  {
    id: 'ev-104', runId: 'run-203', promptId: 'prompt-3', promptVersion: 1,
    text: 'How should a small company choose a digital partner?', answer: 'Start by comparing relevant experience, transparent methods and measurable outcomes.',
    provider: 'Google', model: 'gemini-2.5-pro', status: 'success', observedAt: ago(8), mentioned: false,
    ownedCitation: false, recommendation: 'not_recommended', recommendationSpans: [], position: null,
    exclusion: null, citations: [],
  },
  {
    id: 'ev-105', runId: 'run-204', promptId: 'prompt-3', promptVersion: 1,
    text: 'How should a small company choose a digital partner?', answer: '', provider: 'Google',
    model: 'gemini-2.5-pro', status: 'failed', observedAt: ago(1), mentioned: false,
    ownedCitation: false, recommendation: 'unknown', recommendationSpans: [], position: null,
    exclusion: 'timeout', citations: [],
  },
];

export const sampleAnalytics: ProjectAnalytics = {
  methodology: 'cohort-v1.2', extractionVersion: 'extract-v3', selectedGroup: 'composition-3',
  groups: [
    { id: 'composition-3', runCount: 8, latestAt: ago(1), label: 'Current composition' },
    { id: 'composition-2', runCount: 4, latestAt: ago(8), label: 'Earlier composition' },
  ],
  metrics: metric(),
  providers: [
    { provider: 'OpenAI', metrics: metric({ eligible: 36, expected: 36, mentions: 25, visibility: 69.4, score: 6.9, citationRate: 33.3, recommendationRate: 55.6, cohortShare: 38.5, state: 'complete' }) },
    { provider: 'Anthropic', metrics: metric({ eligible: 30, expected: 36, mentions: 19, visibility: 63.3, score: 6.3, citationRate: 26.7, recommendationRate: 46.2, cohortShare: 34.5 }) },
    { provider: 'Google', metrics: metric({ eligible: 18, expected: 24, mentions: 10, visibility: 55.6, score: 5.6, citationRate: 22.2, recommendationRate: 40, cohortShare: 31.3 }) },
  ],
  runs: [
    { id: 'run-201', createdAt: ago(25), kind: 'monitoring', status: 'completed', group: 'composition-2', comparableToPrevious: false, metrics: metric({ visibility: 52.1 }) },
    { id: 'run-203', createdAt: ago(8), kind: 'monitoring', status: 'completed', group: 'composition-2', comparableToPrevious: true, metrics: metric({ visibility: 58.3 }) },
    { id: 'run-204', createdAt: ago(1), kind: 'monitoring', status: 'partial', group: 'composition-3', comparableToPrevious: false, metrics: metric({ visibility: 64.3 }) },
    { id: 'run-diagnostic', createdAt: ago(3), kind: 'diagnostic', status: 'completed', group: 'composition-3', comparableToPrevious: false, metrics: metric() },
  ],
  evidence: illustrativeEvidence, changes: [], topics: ['Brand strategy', 'Analytics', 'Digital visibility'],
  availableProviders: ['OpenAI', 'Anthropic', 'Google'], totalRuns: 8, quickChecks: 3, market: 'FI', language: 'fi',
};

// Illustrative neighboring contract stub, deliberately kept local and unused by production paths.
export const sampleResearch: Research = {
  version: 1,
  competitors: [{ id: 'brand-2', name: 'Kajo Digital', aliases: [], domains: ['kajo.example'], status: 'active', version: 1 }],
  candidates: [], sources: [
    { url: 'https://aava.example/services', domain: 'aava.example', answers: 2, owned: true, evidenceIds: ['ev-101', 'ev-103'] },
    { url: 'https://industry.example/agency-guide', domain: 'industry.example', answers: 1, owned: false, evidenceIds: ['ev-102'] },
  ],
  evidence: illustrativeEvidence,
};

export const sampleProject = { id: 'project-aava', name: 'Aava Studio', domain: 'aava.example', status: 'active' as const };
export const sampleAccount = { id: 'illustrative-account', displayName: 'Preview account' };
export const sampleQuickChecks = { latest: { id: 'scan-12' }, latestMonitoring: { id: 'run-204' } };

export type Locale = 'fi' | 'en';
const copy = {
  fi: {
    title: 'Yleiskatsaus', subtitle: 'Näe, milloin tekoäly mainitsee ja suosittelee yritystäsi.', newCheck: 'Uusi tarkistus',
    range: 'Aikaväli', platform: 'Alusta', platformAll: 'Kaikki alustat', topic: 'Aihe', topicAll: 'Kaikki aiheet',
    visibility: 'Näkyvyys', visibilityDef: 'Brändin mainitsevat kelvolliset vastaukset ÷ kelvolliset vastaukset. Brändi lasketaan kerran vastausta kohden.',
    recommendations: 'Suositukset', recommendationsDef: 'Selkeästi suosittelevat vastaukset ÷ vastaukset, joilla on suositusluokitus. Tuntematon ei ole kielteinen.',
    ownedCitations: 'Omat lähdeviittaukset', ownedCitationsDef: 'Vahvistettuun omaan verkkotunnukseen viittaavat kelvolliset vastaukset ÷ kelvolliset vastaukset.',
    share: 'Osuus brändimaininnoista', shareDef: 'Brändisi maininnat ÷ kaikki brändimaininnat kiinteässä vertailujoukossa.',
    chartTitle: 'Näkyvyys ajan kuluessa', scoreTitle: 'Näkyvyyspisteet', scoreEmpty: 'Pisteitä ei lasketa ilman kelvollisia vastauksia. Tyhjä ei tarkoita nollaa.',
    scoreFormula: 'Näkyvyys × 10, yksi desimaali.', outOf: '/ 10', platformsTitle: 'Näkyvyys alustoittain',
    platformsNote: 'Alustakohtaiset tulokset ovat ensisijaisia. Yhdistetty arvo painotetaan kelvollisten vastausten määrällä.',
    notMeasured: 'Ei mitattu', noRuns: 'Valitulla aikavälillä ei ole seuranta-ajoja', noRunsBody: 'Mittarit näkyvät, kun seuranta-ajo on tuottanut kelvollisia vastauksia.',
    definition: 'Määritelmä', unavailable: 'Ei saatavilla', days: 'päivää', all: 'Kaikki', method: 'Menetelmä', extraction: 'Poiminta',
    responses: 'Vastaukset', answers: 'Vastaukset', provider: 'Palvelu', score: 'Pisteet', evidence: 'Todisteet',
    metricEvidence: 'Mittarin todisteet', evidenceDescription: 'Valitun mittarin vastaukset. Avaa vastaus nähdäksesi alkuperäisen tekstin ja luokituksen.',
    everyEvidence: 'Jokainen mittari perustuu alla oleviin alkuperäisiin vastauksiin.', viewEvidence: 'Näytä todisteet',
    methodology: 'Menetelmä', extractionLabel: 'Poiminta', quickChecks: (n:number) => `${n} pikatarkistusta lasketaan erikseen, ei näissä mittareissa.`,
    openLatest: 'Avaa viimeisin', group: 'Ryhmä', run: 'ajo', runs: 'ajoa', diagnostic: 'diagnostinen, ei mittareissa',
    visibilityByGroup: 'Näkyvyys koostumusryhmittäin', noCompare: 'Valitulla aikavälillä ei ole vertailukelpoisia mittauksia.',
    rangeLabel: 'Näytä', evidenceAll: 'Kaikki vastaukset', mentioned: 'Brändi mainittu', recommended: 'Suositeltu',
    cited: 'Oma lähde viitattu', excluded: 'Poissuljettu', prompt: 'Kysymys', result: 'Tulos', observed: 'Havaittu',
    open: 'Avaa', noEvidence: 'Ei todisteita tällä suodatuksella', validOnly: 'Mittarit lasketaan vain kelvollisista vastauksista.',
    original: 'Alkuperäinen vastaus', promptVersion: 'Kysymys ja versio', status: 'Tila', succeeded: 'Onnistui',
    inMetrics: 'Mittareissa', yes: 'Kyllä', mention: 'Maininta', notMentioned: 'Ei mainintaa',
    recommendation: 'Suositusluokitus', position: 'Sijainti', noPosition: 'Ei selkeää järjestystä',
    spans: 'Suosituksiin liittyvät tekstikohdat', spansNote: 'Kohdat voivat olla ristiriitaisia; luokitus yllä on ratkaiseva.',
    answer: 'Vastaus', noAnswer: 'Ei vastaustekstiä', citations: 'Lähteet', owned: 'Oma lähde', noCitations: 'Ei lähteitä',
    timeout: 'Aikakatkaisu', excludedLabel: 'Poissuljettu', partial: 'Osittainen kattavuus; puuttuvia ei lasketa nolliksi',
    complete: 'Täysi kattavuus', missing: 'ei mittausta', date: (d:Date, opts?:Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fi-FI', opts ?? { day:'numeric', month:'short' }).format(d),
    showTable: 'Näytä taulukkona', showChart: 'Näytä kaaviona', dateHeading: 'Päivä',
    gapNote: 'Katkos viivassa = ei mittausta. Puuttuvia arvoja ei täytetä.',
    introDisclosure: 'Esimerkkidata – ei tuotantodataa eikä todellisia mittaustuloksia.',
  },
  en: {
    title: 'Overview', subtitle: 'See when AI mentions and recommends your business.', newCheck: 'Run a new check',
    range: 'Date range', platform: 'Platform', platformAll: 'All platforms', topic: 'Topic', topicAll: 'All topics',
    visibility: 'Visibility', visibilityDef: 'Eligible answers mentioning the brand ÷ eligible answers. The brand counts once per answer.',
    recommendations: 'Recommendations', recommendationsDef: 'Explicitly recommending answers ÷ answers with a recommendation classification. Unknown is not negative.',
    ownedCitations: 'Owned-site citations', ownedCitationsDef: 'Eligible answers citing a confirmed owned domain ÷ eligible answers.',
    share: 'Share of brand mentions', shareDef: 'Your brand’s mentions ÷ all brand mentions in the fixed comparison cohort.',
    chartTitle: 'Visibility over time', scoreTitle: 'Visibility score', scoreEmpty: 'No score without eligible responses. Empty does not mean zero.',
    scoreFormula: 'Visibility × 10, one decimal.', outOf: '/ 10', platformsTitle: 'Visibility by platform',
    platformsNote: 'Per-platform results are primary. Combined values are weighted by valid response counts.',
    notMeasured: 'Not measured', noRuns: 'No monitoring runs in the selected range', noRunsBody: 'Metrics appear once a monitoring run has produced valid answers.',
    definition: 'Definition', unavailable: 'Unavailable', days: 'days', all: 'All', method: 'Methodology', extraction: 'Extraction',
    responses: 'Answers', answers: 'Answers', provider: 'Provider', score: 'Score', evidence: 'Evidence',
    metricEvidence: 'Metric evidence', evidenceDescription: 'Answers behind the selected metric. Open an answer to inspect the original text and classification.',
    everyEvidence: 'Every metric is backed by the original answers below.', viewEvidence: 'View evidence',
    methodology: 'Methodology', extractionLabel: 'Extraction', quickChecks: (n:number) => `${n} quick checks are counted separately and are not part of these metrics.`,
    openLatest: 'Open latest', group: 'Group', run: 'run', runs: 'runs', diagnostic: 'diagnostic, excluded from metrics',
    visibilityByGroup: 'Visibility by composition group', noCompare: 'No comparable measurements in the selected range.',
    rangeLabel: 'Show', evidenceAll: 'All answers', mentioned: 'Brand mentioned', recommended: 'Recommended',
    cited: 'Owned source cited', excluded: 'Excluded', prompt: 'Prompt', result: 'Result', observed: 'Observed',
    open: 'Open', noEvidence: 'No evidence for this filter', validOnly: 'Metrics are computed only from valid answers.',
    original: 'Original answer', promptVersion: 'Prompt and version', status: 'Status', succeeded: 'Succeeded',
    inMetrics: 'In metrics', yes: 'Yes', mention: 'Mention', notMentioned: 'Not mentioned',
    recommendation: 'Recommendation classification', position: 'Position', noPosition: 'No clear ranking',
    spans: 'Recommendation-related text spans', spansNote: 'Spans may conflict; the classification above is authoritative.',
    answer: 'Answer', noAnswer: 'No answer text', citations: 'Citations', owned: 'Owned source', noCitations: 'No citations',
    timeout: 'Timed out', excludedLabel: 'Excluded', partial: 'Partial coverage; missing answers are not counted as zero',
    complete: 'Complete coverage', missing: 'no measurement', date: (d:Date, opts?:Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', opts ?? { day:'numeric', month:'short' }).format(d),
    showTable: 'Show as table', showChart: 'Show chart', dateHeading: 'Date',
    gapNote: 'A break in the line = no measurement. Missing values are never filled in.',
    introDisclosure: 'Illustrative sample data — not production data or actual measurements.',
  },
};
export type CopyKey = keyof typeof copy.fi;
export const useMockLocale = () => {
  const [locale, setLocale] = useState<Locale>('fi');
  return { locale, setLocale, c: copy[locale] };
};
export type Copy = typeof copy.fi;

export function Panel({ children, className = '', as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string; 'aria-busy'?: boolean }) {
  return <As className={`rounded-[12px] border border-line bg-white ${className}`} {...rest}>{children}</As>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return <header className="ar-rise flex flex-col gap-4 md:flex-row md:items-start"><div className="min-w-0 flex-1"><h1 className="text-[26px] font-semibold leading-[38px] text-ink md:text-[28px] md:leading-[41px]">{title}</h1>{subtitle && <p className="mt-1 max-w-[800px] text-sm leading-5 text-muted-ink">{subtitle}</p>}</div>{actions && <div className="flex flex-wrap items-start gap-2">{actions}</div>}</header>;
}
export function StatusBadge({ tone, children }: { tone: 'success' | 'warning' | 'neutral' | 'info'; children: ReactNode }) {
  const colors = { success: 'bg-success-bg text-success', warning: 'bg-warning-bg text-warning', neutral: 'bg-canvas text-muted-ink border border-line', info: 'bg-tint text-link' };
  const dots = { success: 'bg-success', warning: 'bg-warning', neutral: 'bg-muted-ink', info: 'bg-link' };
  return <span className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium leading-5 ${colors[tone]}`}><span aria-hidden className={`size-1.5 rounded-full ${dots[tone]}`} />{children}</span>;
}
export function ReasonNote({ children }: { children: ReactNode }) {
  return <p className="flex items-start gap-2 rounded-lg bg-tint px-3 py-2 text-[12px] leading-[17px] text-[#0a5f75]"><Info className="mt-px size-3.5 shrink-0" aria-hidden /><span>{children}</span></p>;
}
export function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center"><p className="text-sm font-semibold text-ink">{title}</p><p className="max-w-[420px] text-[12px] leading-[17px] text-muted-ink">{body}</p></div>;
}

export function KpiCard({ label, definition, value, sample, testId }: { label: string; definition: string; value: string | null; sample: string; testId: string }) {
  return <Panel as="article" className="flex min-w-0 flex-col gap-1 p-5"><div className="flex items-start justify-between gap-2"><p className="text-[13px] font-medium leading-[19px] text-muted-ink">{label}</p><Tooltip><TooltipTrigger asChild><button type="button" className="-m-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-ink" aria-label={`Definition: ${label}`}><Info className="size-3.5" aria-hidden /></button></TooltipTrigger><TooltipContent className="max-w-[260px] text-[12px] leading-[17px]">{definition}</TooltipContent></Tooltip></div><div className="flex min-h-[46px] items-start gap-3">{value === null ? <p className="text-[32px] font-semibold leading-[46px] text-[#b4bdcb]" data-testid={`value-${testId}`}>–</p> : <p className="tabular text-[32px] font-semibold leading-[46px] text-ink" data-testid={`value-${testId}`}>{value}</p>}</div><p className="text-[12px] leading-[17px] text-muted-ink">{value === null ? `Unavailable · ${sample}` : sample}</p></Panel>;
}

export function FilterSelect({ label, value, onChange, options, testId, className = '', disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; testId: string; className?: string; disabled?: boolean }) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} data-testid={testId} className={`h-11 w-auto min-w-[134px] gap-2 rounded-lg border-line bg-white px-3 text-sm font-medium text-ink shadow-none transition-colors hover:bg-canvas focus:ring-[3px] focus:ring-cyan focus:ring-offset-0 disabled:opacity-100 disabled:text-muted-ink md:h-10 ${className}`}><SelectValue /></SelectTrigger><SelectContent className="rounded-lg border-line">{options.map((option) => <SelectItem key={option.value} value={option.value} className="text-sm">{option.label}</SelectItem>)}</SelectContent></Select>;
}

export function TrendChart({ title, series, data, emptyText, withTime = false, locale }: { title: string; series: Series[]; data: Point[]; emptyText: string; withTime?: boolean; locale: Locale }) {
  const [asTable, setAsTable] = useState(false);
  const c = copy[locale];
  const dateLabel = (v: string) => new Intl.DateTimeFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { day: 'numeric', month: 'numeric' }).format(new Date(v));
  const fmt = (v: unknown) => typeof v === 'number' ? `${new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { maximumFractionDigits: 0 }).format(v)}%` : c.missing;
  const empty = data.length === 0;
  return <div className="flex flex-col gap-3"><div className="relative" style={{ height: 180 }}>{!asTable && <ResponsiveContainer width="100%" height="100%"><LineChart data={empty ? [{ date: '' }] : data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}><CartesianGrid vertical={false} stroke="#e3e8f0" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#637087', fontFamily: 'Figtree' }} tickFormatter={dateLabel} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#637087', fontFamily: 'Figtree' }} tickFormatter={(v:number) => `${v}%`} />{!empty && <RTooltip formatter={(v:unknown, name:string) => [fmt(v), series.find((s) => s.key === name)?.label ?? name]} labelFormatter={(v:string) => new Intl.DateTimeFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { day:'numeric', month:'long', year:'numeric' }).format(new Date(v))} contentStyle={{ fontFamily: 'Figtree', fontSize: 12, borderRadius: 8, border: '1px solid #e3e8f0' }} />}{!empty && series.map((s) => <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} dot={{ r: 2.5, strokeWidth: 0, fill: s.color }} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer>}{empty && !asTable && <div className="absolute inset-0 grid place-items-center pl-10"><p className="ar-hatch max-w-[360px] rounded-lg border border-dashed border-line bg-white/80 px-4 py-3 text-center text-[12px] leading-[17px] text-muted-ink">{emptyText}</p></div>}{asTable && <div className="h-full overflow-auto rounded-lg border border-line"><table className="w-full text-left text-[12px]"><caption className="sr-only">{title}: values as a table</caption><thead className="sticky top-0 bg-canvas text-muted-ink"><tr><th className="px-3 py-2 font-medium">{c.dateHeading}</th>{series.map((s) => <th key={s.key} className="px-3 py-2 font-medium">{s.label}</th>)}</tr></thead><tbody>{data.map((row, i) => <tr key={`${row.date}-${i}`} className="border-t border-line"><th className="px-3 py-1.5 font-normal text-ink">{withTime ? c.date(new Date(row.date), { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : dateLabel(row.date)}</th>{series.map((s) => <td key={s.key} className="tabular px-3 py-1.5">{fmt(row[s.key])}</td>)}</tr>)}</tbody></table></div>}</div><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label={title}>{series.map((s) => <li key={s.key} className="flex items-center gap-2 text-[12px] leading-[17px] text-ink"><svg width="18" height="8" aria-hidden><line x1="0" y1="4" x2="18" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /></svg>{s.label}</li>)}</ul><span className="hidden text-[11px] text-muted-ink sm:inline">{c.gapNote}</span><Button variant="ghost" size="sm" className="ml-auto" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} data-testid="button-toggle-chart-table">{asTable ? c.showChart : c.showTable}</Button></div></div>;
}

export function DataTable<T>({ rows, columns, caption, rowKey, emptyTitle, emptyBody, testId }: { rows:T[]; columns:{key:string;header:string;cell:(row:T)=>ReactNode;sortValue?:(row:T)=>string|number|null;align?:'left'|'right'}[]; caption:string; rowKey:(row:T)=>string; emptyTitle:string; emptyBody:string; testId:string }) {
  const [sort, setSort] = useState<{ key:string; dir:'asc'|'desc' }|null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((item) => item.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a,b) => {
      const av = col.sortValue!(a); const bv = col.sortValue!(b);
      if (av === bv) return 0; if (av === null) return 1; if (bv === null) return -1;
      const result = av < bv ? -1 : 1; return sort.dir === 'asc' ? result : -result;
    });
  }, [rows, sort, columns]);
  return <div data-testid={testId}><div className="overflow-x-auto"><table className="w-full min-w-full border-collapse text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="hidden md:table-header-group"><tr className="border-b border-line">{columns.map((col) => { const active=sort?.key===col.key; return <th key={col.key} scope="col" aria-sort={col.sortValue ? active ? sort!.dir==='asc'?'ascending':'descending' : 'none' : undefined} className={`h-10 px-4 text-[12px] font-medium text-muted-ink ${col.align==='right'?'text-right':''}`}>{col.sortValue ? <button type="button" onClick={() => setSort((current) => (!current||current.key!==col.key?{key:col.key,dir:'asc'}:current.dir==='asc'?{key:col.key,dir:'desc'}:null))} className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-canvas hover:text-ink">{col.header}{active ? sort!.dir==='asc'?<ArrowUp className="size-3" aria-hidden/>:<ArrowDown className="size-3" aria-hidden/>:<ChevronsUpDown className="size-3 opacity-50" aria-hidden/>}</button>:col.header}</th>; })}</tr></thead>{sorted.length>0&&<tbody>{sorted.map((row)=><tr key={rowKey(row)} className="grid grid-cols-1 gap-1 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-canvas/70 md:table-row md:p-0">{columns.map((col)=><td key={col.key} className={`flex justify-between gap-4 md:table-cell md:h-12 md:px-4 ${col.align==='right'?'md:text-right':''}`}><span className="text-[12px] text-muted-ink md:hidden">{col.header}</span><span className="tabular text-ink">{col.cell(row)}</span></td>)}</tr>)}</tbody>}</table></div>{!rows.length&&<EmptyState title={emptyTitle} body={emptyBody}/>}</div>;
}

export function GroupTrend({ a, from, days, locale }: { a:ProjectAnalytics; from:string; days:number; locale:Locale }) {
  const L = (fi:string,en:string) => locale === 'fi' ? fi : en;
  const runs = a.runs.filter((run) => run.kind !== 'diagnostic').sort((x,y) => x.createdAt-y.createdAt);
  const groupIds = Array.from(new Set(runs.map((run) => run.group)));
  const colors=['#181f6b','#2f7d6d','#b8562b','#6b5aa8','#8a6d1d']; const dashes=[undefined,'6 4','2 3','8 3 2 3','1 4'];
  const series:Series[]=groupIds.map((id,i)=>({key:`g${i}`,label:`${L('Ryhmä','Group')} ${a.groups.length-a.groups.findIndex((g)=>g.id===id)} · ${a.groups.find((g)=>g.id===id)?.runCount ?? 0} ${L('ajoa','runs')}`,color:colors[i%colors.length],dash:dashes[i%dashes.length]}));
  const data:Point[]=runs.map((run)=>({date:new Date(run.createdAt).toISOString(),runId:run.id,group:run.group,...Object.fromEntries(series.map((s)=>[s.key,null])),[`g${groupIds.indexOf(run.group)}`]:run.metrics.visibility}));
  const start=new Date(`${from}T00:00:00Z`).getTime(); const present=new Set(runs.map((run)=>new Date(run.createdAt).toISOString().slice(0,10)));
  for(let k=0;k<days;k++){const day=new Date(start+k*dayMs).toISOString().slice(0,10);if(!present.has(day))data.push({date:day,gap:'1',...Object.fromEntries(series.map((s)=>[s.key,null]))});}
  data.sort((x,y)=>new Date(x.date).getTime()-new Date(y.date).getTime());
  return <TrendChart locale={locale} withTime title={L('Näkyvyys koostumusryhmittäin','Visibility by composition group')} series={series} data={data} emptyText={L('Valitulla aikavälillä ei ole vertailukelpoisia mittauksia.','No comparable measurements in the selected range.')}/>;
}

export const pctText=(v:number|null,pct:(n:number,d?:number)=>string)=>v===null?null:pct(v/100,1);
export const metricSample=(m:EvidenceMetric,L:(fi:string,en:string)=>string)=>`${m.eligible} / ${m.expected} ${L('kelvollista vastausta','valid responses')}${m.state!=='complete'?` · ${L('Osittainen kattavuus; puuttuvia ei lasketa nolliksi','Partial coverage; missing answers are not counted as zero')}`:''}`;
export const metricStateLabel=(s:string,L:(fi:string,en:string)=>string)=>s==='complete'?L('Täysi kattavuus','Complete coverage'):s==='partial'?L('Osittainen kattavuus; puuttuvia ei lasketa nolliksi','Partial coverage; missing answers are not counted as zero'):s==='unavailable'?L('Ei saatavilla','Unavailable'):s;
export function EvidenceList({rows,filter,onFilter,L,date}:{rows:AnalyticsEvidence[];filter:string;onFilter:(value:string)=>void;L:(fi:string,en:string)=>string;date:(d:Date,opts?:Intl.DateTimeFormatOptions)=>string}) {
  const [open,setOpen]=useState<AnalyticsEvidence|null>(null);
  const shown=rows.filter((e)=>filter==='mentioned'?e.exclusion===null&&e.mentioned:filter==='recommended'?e.exclusion===null&&e.recommendation==='recommended':filter==='cited'?e.exclusion===null&&e.ownedCitation:filter==='excluded'?e.exclusion!==null:true);
  const options=[['all',L('Kaikki vastaukset','All answers')],['mentioned',L('Brändi mainittu','Brand mentioned')],['recommended',L('Suositeltu','Recommended')],['cited',L('Oma lähde viitattu','Owned source cited')],['excluded',L('Poissuljettu','Excluded')]];
  return <div className="flex flex-col gap-3"><div className="px-5"><FilterSelect label={L('Näytä','Show')} value={filter} onChange={onFilter} testId="filter-evidence" options={options.map(([value,label])=>({value,label}))}/></div><DataTable testId="table-evidence" caption={L('Mittareiden todisteet','Metric evidence')} rows={shown} rowKey={(r)=>r.id} emptyTitle={L('Ei todisteita tällä suodatuksella','No evidence for this filter')} emptyBody={L('Mittarit lasketaan vain kelvollisista vastauksista.','Metrics are computed only from valid answers.')} columns={[
    {key:'prompt',header:L('Kysymys','Prompt'),cell:(r)=><span className="line-clamp-2">{r.text} <span className="text-muted-ink">v{r.promptVersion}</span></span>,sortValue:(r)=>r.text},
    {key:'provider',header:L('Palvelu','Provider'),cell:(r)=><span>{r.provider} <span className="text-muted-ink">{r.model}</span></span>,sortValue:(r)=>r.provider},
    {key:'result',header:L('Tulos','Result'),cell:(r)=>r.exclusion?<StatusBadge tone="neutral">{r.exclusion==='timeout'?L('Aikakatkaisu','Timed out'):`${L('Poissuljettu','Excluded')} (${r.exclusion})`}</StatusBadge>:<span className="flex flex-wrap gap-1"><StatusBadge tone={r.mentioned?'success':'neutral'}>{r.mentioned?L('Mainittu','Mentioned'):L('Ei mainintaa','Not mentioned')}{r.position!==null?` · #${r.position}`:''}</StatusBadge>{r.recommendation==='recommended'&&<StatusBadge tone="info">{L('Suositeltu','Recommended')}</StatusBadge>}</span>},
    {key:'observed',header:L('Havaittu','Observed'),cell:(r)=>date(new Date(r.observedAt)),sortValue:(r)=>r.observedAt},
    {key:'open',header:'',align:'right',cell:(r)=><Button size="sm" variant="secondary" onClick={()=>setOpen(r)}>{L('Avaa','Open')}</Button>},
  ]}/><Sheet open={!!open} onOpenChange={(v)=>!v&&setOpen(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">{open&&<EvidenceDetail e={open} L={L} date={date}/>}</SheetContent></Sheet></div>;
}
function EvidenceDetail({e,L,date}:{e:AnalyticsEvidence;L:(fi:string,en:string)=>string;date:(d:Date,opts?:Intl.DateTimeFormatOptions)=>string}) {
  const Row=({k,children}:{k:string;children:ReactNode})=><div className="flex flex-col gap-0.5 border-b border-line py-2"><dt className="text-[12px] text-muted-ink">{k}</dt><dd className="text-sm text-ink">{children}</dd></div>;
  return <div className="flex flex-col gap-4"><SheetHeader><SheetTitle>{L('Alkuperäinen vastaus','Original answer')}</SheetTitle><SheetDescription>{e.provider} · {e.model} · {date(new Date(e.observedAt),{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</SheetDescription></SheetHeader><dl><Row k={L('Kysymys ja versio','Prompt and version')}>{e.text} (v{e.promptVersion})</Row><Row k={L('Tila','Status')}>{e.status==='success'?L('Onnistui','Succeeded'):e.status}</Row><Row k={L('Mittareissa','In metrics')}>{e.exclusion?e.exclusion:L('Kyllä','Yes')}</Row><Row k={L('Maininta','Mention')}>{e.mentioned?L('Brändi mainittu','Brand mentioned'):L('Ei mainintaa','Not mentioned')}</Row><Row k={L('Suositusluokitus','Recommendation classification')}>{e.recommendation}</Row><Row k={L('Sijainti','Position')}>{e.position??L('Ei selkeää järjestystä','No clear ranking')}</Row></dl>{e.recommendationSpans.length>0&&<div><h3 className="mb-1 text-[13px] font-semibold">{L('Suosituksiin liittyvät tekstikohdat','Recommendation-related text spans')}</h3><p className="mb-1 text-[12px] text-muted-ink">{L('Kohdat voivat olla ristiriitaisia; luokitus yllä on ratkaiseva.','Spans may conflict; the classification above is authoritative.')}</p><ul className="flex flex-col gap-1">{e.recommendationSpans.map((span,i)=><li key={i} className="rounded-md bg-canvas px-2 py-1 text-sm ring-1 ring-line">"{span}"</li>)}</ul></div>}<div><h3 className="mb-1 text-[13px] font-semibold">{L('Vastaus','Answer')}</h3><p className="whitespace-pre-wrap break-words rounded-lg bg-canvas p-3 text-sm ring-1 ring-line">{e.answer||L('Ei vastaustekstiä','No answer text')}</p></div><div><h3 className="mb-1 text-[13px] font-semibold">{L('Lähteet','Citations')} {e.ownedCitation&&<StatusBadge tone="success">{L('Oma lähde','Owned source')}</StatusBadge>}</h3>{e.citations.length?<ul className="flex flex-col gap-1 text-sm">{e.citations.map((url,i)=><li key={i} className="break-all"><a className="underline" href={url} target="_blank" rel="noopener noreferrer nofollow">{url}</a></li>)}</ul>:<p className="text-sm text-muted-ink">{L('Ei lähteitä','No citations')}</p>}</div></div>;
}
