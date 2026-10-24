import { useMemo } from 'react';
import { Link } from 'wouter';
import type { OverviewInsights } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { EmptyState, Panel } from '../primitives';
import { useL } from '../analytics';
import { coverageFor, domainRows } from '@/lib/source-workbench';

const CAT: Record<string, { color: string; fi: string; en: string }> = {
  owned: { color: '#181f6b', fi: 'Oma', en: 'Owned' },
  competitor: { color: '#e98e2e', fi: 'Kilpailija', en: 'Competitor' },
  other: { color: '#9aa6b8', fi: 'Muu', en: 'Other' },
  mixed: { color: '#637087', fi: 'Sekalainen', en: 'Mixed' },
};

function Bar({ label, value, max, color, testId }: { label: string; value: number; max: number; color: string; testId: string }) {
  return (
    <li className="flex items-center gap-3 text-[13px]" data-testid={testId}>
      <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md">
        <div className="absolute inset-0 origin-left rounded-md bg-canvas" style={{ transform: `scaleX(${max ? Math.max(value / max, 0.04) : 0})` }} />
        <span className="relative flex h-full items-center gap-2 px-2.5"><span className="size-2 shrink-0 rounded-full" style={{ background: color }} /><span className="truncate text-ink">{label}</span></span>
      </div>
      <span className="tabular w-10 text-right text-muted-ink">{value}</span>
    </li>
  );
}

const FILTER_KEYS = ['range', 'from', 'to', 'provider', 'topic', 'group', 'tag', 'surface', 'prompt', 'promptVersion', 'run'];

/** Top domains and categories. New backends: explicit citations only, with coverage. Older backends: legacy domains labelled as source references. */
export function SourceDomains({ overview, eligible, context, projectId }: { overview: OverviewInsights | undefined; eligible: number; context?: string; projectId?: string }) {
  const L = useL();
  const { href, num } = useI18n();
  const src = overview?.sources;
  const legacy = !src;
  const upgrade = <EmptyState compact title={L('Vaatii taustapalvelun päivityksen', 'Backend upgrade needed')} body={L('Tämä palvelin ei palauta lähdeverkkotunnuksia.', 'This server does not return source domains.')} />;
  const rows = useMemo(() => (src ? domainRows(src.items, 'citation').map((r) => ({ domain: r.domain, category: r.category, answers: r.answers })) : (overview?.domains ?? [])), [src, overview]);
  const domains = [...rows].sort((a, b) => b.answers - a.answers).slice(0, 8);
  const types = useMemo(() => {
    if (!src) return [...(overview?.domainTypes ?? [])].sort((a, b) => b.answers - a.answers);
    const m = new Map<string, Set<string>>();
    for (const i of src.items) if (i.kind === 'citation') m.set(i.category, new Set([...(m.get(i.category) ?? []), ...i.evidenceIds]));
    return [...m.entries()].map(([category, s]) => ({ category, answers: s.size })).sort((a, b) => b.answers - a.answers);
  }, [src, overview]);
  const maxD = domains[0]?.answers ?? 0;
  const cov = src ? coverageFor(src, 'citation') : null;
  const keep = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const q = new URLSearchParams();
  for (const k of FILTER_KEYS) { const v = keep.get(k); if (v) q.set(k, v); }
  for (const [key,value] of new URLSearchParams(context?.replace(/^&/,'') || '')) q.set(key,value);
  if (projectId) q.set('project',projectId);
  const to = `${href('/dashboard/sources')}${q.toString() ? `?${q}` : ''}`;
  const nolabel = legacy ? L('Lähdeviitteet', 'Source references') : L('Eksplisiittiset viittaukset', 'Explicit citations');
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="dom-title" data-testid="panel-top-domains">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="dom-title" className="text-[15px] font-semibold text-ink">{legacy ? L('Lähdeverkkotunnukset', 'Top source domains') : L('Eniten viitatut verkkotunnukset', 'Top cited domains')}</h2>
            {!!overview && <Link href={to} className="text-[12px] text-link hover:underline" data-testid="link-sources">{L('Avaa lähteet', 'Open sources')}</Link>}
          </div>
          <p className="text-[11px] text-muted-ink" data-testid="text-sources-basis">
            {legacy ? L('Vanha palvelin: luvut ovat lähdeviitteitä, eivät todennettuja eksplisiittisiä viittauksia. Hakutuloksia ei lasketa.', 'Older server: counts are source references, not verified explicit citations. Retrieved-only pages are excluded.')
              : cov?.observable == null ? L('Vain eksplisiittiset viittaukset. Havaittavuus tuntematon, joten puuttuva viittaus ei todista mitään.', 'Explicit citations only. Observability is unknown, so a missing citation proves nothing.')
              : L(`Vain eksplisiittiset viittaukset: ${num(cov.answers)} / ${num(cov.observable)} havaittavaa vastausta.`, `Explicit citations only: ${num(cov.answers)} of ${num(cov.observable)} observable answers.`)}
          </p>
        </div>
        {overview === undefined ? upgrade : domains.length === 0 ? <EmptyState compact title={L(`Ei tallennettuja kohteita: ${nolabel}`, `No ${nolabel.toLocaleLowerCase()} recorded`)} body={L('Puuttuva aineisto ei todista, ettei lähteitä käytetty.', 'Missing evidence does not prove that sources were not used.')} />
          : <ul className="flex flex-col gap-1.5" data-testid="list-domains">{domains.map((d) => <Bar key={d.domain} label={d.domain} value={d.answers} max={maxD} color={CAT[d.category]?.color ?? '#9aa6b8'} testId={`row-domain-${d.domain}`} />)}</ul>}
      </Panel>
      <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="cat-title" data-testid="panel-domain-categories">
        <div>
          <h2 id="cat-title" className="text-[15px] font-semibold text-ink">{L('Lähdetyypit', 'Domain categories')}</h2>
          <p className="text-[11px] text-muted-ink">{L(`Vastauksia / ${eligible} kelvollista. Vastaus voi kuulua useaan luokkaan, joten summa ei ole 100 %.`, `Answers of ${eligible} eligible. One answer can fall into several categories, so these do not sum to a whole.`)}</p>
        </div>
        {overview === undefined ? upgrade : types.length === 0 ? <EmptyState compact title={L('Ei luokiteltuja lähteitä', 'No categorised sources')} />
          : <ul className="flex flex-col gap-1.5" data-testid="list-domain-categories">{types.map((t) => { const c = CAT[t.category]; return <Bar key={t.category} label={c ? L(c.fi, c.en) : t.category} value={t.answers} max={Math.max(eligible, types[0].answers)} color={c?.color ?? '#9aa6b8'} testId={`row-category-${t.category}`} />; })}</ul>}
      </Panel>
    </div>
  );
}
