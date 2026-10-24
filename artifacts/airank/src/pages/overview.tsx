import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Globe2, Languages } from 'lucide-react';
import { Link } from 'wouter';
import { EmptyState, Panel, ReasonNote, Skeleton } from '@/components/airank/primitives';
import { AnalyticsFilterBar } from '@/components/airank/analytics-filters';
import { AnalyticsFailure, groupLabel, useL } from '@/components/airank/analytics';
import { MetricTrend } from '@/components/airank/overview/metric-trend';
import { DataAvailability } from '@/components/airank/overview/data-availability';
import { WorkflowHeader } from '@/components/airank/overview/workflow-header';
import { KpiStrip } from '@/components/airank/overview/kpi-strip';
import { CompetitorTable } from '@/components/airank/overview/competitor-table';
import { SourceImpact } from '@/components/airank/overview/source-impact';
import { ProviderCoverage } from '@/components/airank/overview/provider-coverage';
import { TopicMatrix } from '@/components/airank/overview/topic-matrix';
import { SourceDomains } from '@/components/airank/overview/source-domains';
import { DiscoverySummary } from '@/components/airank/intelligence-workbench';
import { OpportunitiesCompact } from '@/components/airank/overview/opportunities-compact';
import { RecentAnswers } from '@/components/airank/overview/recent-answers';
import { useDocumentTitle, useI18n } from '@/i18n';
import { useQueryParam } from '@/lib/use-query-param';
import { toMs, useAnalytics, useAnalyticsFilters } from '@/lib/use-analytics';
import { useQuickCheckSummary } from '@/lib/quick-check-summary';
import { scopeEvidence } from '@/lib/overview-data';
import { usableOverviewGroup } from '@/lib/overview-trends';

function localizedCodeName(value: string, locale: 'fi' | 'en', type: 'region' | 'language') {
  const code = value.trim();
  const pattern = type === 'region' ? /^[a-z]{2}$/i : /^[a-z]{2,3}$/i;
  if (!pattern.test(code)) return value;
  try {
    const name = new Intl.DisplayNames([locale === 'fi' ? 'fi-FI' : 'en-GB'], { type }).of(type === 'region' ? code.toUpperCase() : code.toLowerCase());
    if (!name || name.toLowerCase() === code.toLowerCase() || /unknown/i.test(name)) return value;
    return `${name} (${code})`;
  } catch { return value; }
}

function MeasurementContext({ market, language, projectId }: { market: string; language: string; projectId: string }) {
  const { href, locale } = useI18n();
  const L = useL();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink" data-testid="context-measurement">
      <span className="inline-flex items-center gap-1.5" data-testid="value-market"><Globe2 className="size-3.5 text-link" aria-hidden /><span className="text-muted-ink">{L('Markkina', 'Market')}</span><b>{localizedCodeName(market, locale, 'region') || '—'}</b></span>
      <span className="inline-flex items-center gap-1.5" data-testid="value-measurement-language"><Languages className="size-3.5 text-link" aria-hidden /><span className="text-muted-ink">{L('Mittauskieli', 'Measurement language')}</span><b>{localizedCodeName(language, locale, 'language') || '—'}</b></span>
      <Link href={`${href('/settings')}?project=${projectId}`} className="inline-flex items-center gap-1 font-semibold text-link hover:underline" data-testid="link-measurement-settings">{L('Projektin asetukset', 'Project settings')} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
      <Link href={`${href('/dashboard/traffic')}?project=${projectId}`} className="inline-flex items-center gap-1 font-semibold text-link hover:underline" data-testid="link-traffic">{L('Liikenne (GA4 ja GSC)', 'Traffic (GA4 and GSC)')} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" data-testid="state-overview-loading">
      <Skeleton className="h-[92px] w-full rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><Skeleton className="h-[260px] rounded-xl" /><Skeleton className="h-[260px] rounded-xl" /></div>
      <Skeleton className="h-[220px] w-full rounded-xl" />
    </div>
  );
}

export default function OverviewPage() {
  const { d, date, href } = useI18n();
  const L = useL();
  const checks = useQuickCheckSummary();
  useDocumentTitle(d.overview.title);
  const f = useAnalyticsFilters();
  const [evFilter, setEvFilter] = useQueryParam('evidence', 'all');
  const [evidenceBrand, setEvidenceBrand] = useQueryParam('evidenceBrand', '');
  const [answerId, setAnswerId] = useQueryParam('answer', '');
  const answersRef = useRef<HTMLDivElement | null>(null);
  const project = checks.project;
  const projectId = project?.id ?? '';
  const q = useAnalytics(projectId, f.params);
  const a = q.data;
  const [autoGroup, setAutoGroup] = useState<{ projectId: string; group: string } | null>(null);
  useEffect(() => {
    // A deep link, explicit group, or failed refresh must never be silently overridden.
    if (!a || q.isError || f.group || f.runId) return;
    const group = usableOverviewGroup(a);
    if (group) {
      setAutoGroup({ projectId, group });
      f.setGroup(group);
    }
  }, [a, q.isError, f.group, f.runId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const scoped = useMemo(() => (a ? scopeEvidence(a, f).filter(e => !evidenceBrand ||
    (e.brandOrder?.mentions.some(mention => mention.brandName === evidenceBrand) ??
      e.brandNames?.includes(evidenceBrand))) : []), [a, f.from, f.to, f.provider, f.topic, f.tag, f.tagsRaw, f.tagMode, f.market, f.language, f.surface, f.promptId, f.promptVersion, f.group, f.runId, evidenceBrand]); // eslint-disable-line react-hooks/exhaustive-deps

  // A deep-linked answer outside the current selection (group/filter change) is dropped, never shown stale.
  const stale = !!a && !!answerId && !scoped.some((e) => e.id === answerId);
  useEffect(() => { if (stale) setAnswerId(''); }, [stale]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = <WorkflowHeader projectId={projectId} brand={project?.brandName ?? ''} domain={project?.ownedDomains?.[0]} archived={project?.status === 'archived'} title={d.overview.title} />;
  const ctx = [['from', f.from], ['to', f.to], ['provider', f.provider], ['topic', f.topic], ['tag',f.tag], ['tags',f.tagsRaw], ['tagMode',f.tags.length ? f.tagMode : ''], ['market',f.market], ['language',f.language], ['surface',f.surface], ['promptId',f.promptId], ['promptVersion',f.promptVersion], ['group',f.group], ['run',f.runId]].filter(([, v]) => v && v !== 'all').map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');

  if (q.isPending) return <div className="flex flex-col gap-4 pb-8" data-testid="page-overview">{header}<OverviewSkeleton /></div>;
  if (q.accessDenied || !a) return (
    <div className="flex flex-col gap-4 pb-8" data-testid="page-overview">
      {header}
      <AnalyticsFilterBar f={f} />
      <Panel><AnalyticsFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel>
    </div>
  );

  const lastRun = a.runs.filter((r) => r.kind !== 'diagnostic' && r.group === a.selectedGroup && (!f.runId || r.id === f.runId) && (r.status === 'completed' || r.status === 'partial')).sort((x, y) => toMs(y.createdAt) - toMs(x.createdAt))[0];
  const noData = a.totalRuns === 0;
  const showEvidence = (filter: string) => { setEvidenceBrand(''); setEvFilter(filter); answersRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); };
  const showBrandEvidence = (brand: string) => { setEvidenceBrand(brand); setEvFilter('all'); answersRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="flex flex-col gap-4 pb-8" data-testid="page-overview">
      {header}
      {q.isError && <ReasonNote tone="warning">{L('Päivitys epäonnistui. Näytetään viimeksi haetut mittarit.', 'Refresh failed. Showing the last loaded metrics.')}</ReasonNote>}
      <div className="flex flex-col gap-2">
        <AnalyticsFilterBar f={f} a={a} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MeasurementContext market={a.market} language={a.language} projectId={projectId} />
          {lastRun && <p className="text-[11px] text-muted-ink" data-testid="text-last-updated">{L('Päivitetty', 'Updated')} {date(new Date(toMs(lastRun.createdAt)), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
      </div>
      {a.groups.length > 1 && <ReasonNote>{L('Mittarit kattavat vain valitun koostumusryhmän; eri koostumuksia ei yhdistetä.', 'Metrics cover only the selected composition group; different compositions are never combined.')} {a.selectedGroup ? `(${groupLabel(a, a.selectedGroup, L)})` : ''}</ReasonNote>}
      {autoGroup?.projectId === projectId && autoGroup.group === a.selectedGroup && <div data-testid="notice-usable-group"><ReasonNote>{L('Uusimmassa ryhmässä ei ollut kelvollisia vastauksia. Näytetään uusin ryhmä, jossa niitä on. Voit vaihtaa ryhmää suodattimista; tuloksia ei yhdistetä.', 'The newest group had no usable answers. Showing the most recent group with usable answers. You can change the group in the filters; results are not combined.')}</ReasonNote></div>}

      {noData ? (
        <Panel className="p-2"><EmptyState title={L('Valitulla aikavälillä ei ole seuranta-ajoja', 'No monitoring runs in the selected range')}
          body={L('Tarkista aikaväli ja suodattimet sekä kysymysten keräystila Kysymykset-sivulta. Näkyvyys ei ole nolla: valinnasta puuttuvat mittaukset.', 'Check the date range and filters, then review prompt collection status on the Prompts page. Visibility is not zero: measurements are missing from this selection.')} /></Panel>
      ) : (
        <>
          <KpiStrip a={a} onEvidence={showEvidence} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <MetricTrend a={a} from={f.from} days={f.days} brand={project?.brandName ?? ''} runId={f.runId} />
            <CompetitorTable cohort={a.competitors} onBrand={showBrandEvidence} />
          </div>
          <DataAvailability a={a} projectId={projectId} runId={f.runId} onExcluded={() => showEvidence('excluded')} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SourceImpact a={a} runId={f.runId} />
            <ProviderCoverage providers={a.providers} evidence={a.evidence} />
          </div>
          <TopicMatrix overview={a.overview} />
          <SourceDomains overview={a.overview} eligible={a.metrics.eligible} context={ctx} projectId={projectId} />
          <DiscoverySummary a={a} to={`${href('/dashboard/competitors')}?project=${encodeURIComponent(projectId)}&tab=discovered${ctx}`} />
          {a.quickChecks > 0 && <p className="text-[11px] text-muted-ink" data-testid="text-quickchecks">{L(`${a.quickChecks} pikatarkistusta lasketaan erikseen eikä niitä ole näissä mittareissa.`, `${a.quickChecks} quick checks are counted separately and are not part of these metrics.`)}</p>}
        </>
      )}
      {projectId && <OpportunitiesCompact projectId={projectId} />}
      {projectId && (
        <Link href={`${href('/dashboard/traffic')}?project=${encodeURIComponent(projectId)}`} className="group flex items-center gap-3 rounded-[12px] border border-line bg-white p-4 transition-colors hover:border-[#bfe9f6] hover:bg-tint/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan" data-testid="link-overview-traffic">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">{L('Liikenne: tekoälyviittaukset ja hakunäkyvyys', 'Traffic: AI referrals and search performance')}</span>
            <span className="block text-[12px] text-muted-ink">{L('Tuodut Google Analytics- ja Search Console -tiedot, kun yhteydet on otettu käyttöön.', 'Imported Google Analytics and Search Console data, once connections are set up.')}</span>
          </span>
          <ArrowUpRight aria-hidden className="size-4 text-navy transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      )}
      {!noData && (
        <div ref={answersRef} className="scroll-mt-4">
          {evidenceBrand && <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-tint px-3 py-2 text-[12px]" data-testid="state-brand-evidence"><span>{L('Vastaukset, joissa mainitaan', 'Answers mentioning')} <b>{evidenceBrand}</b> · {scoped.length}</span><button type="button" onClick={() => setEvidenceBrand('')} className="font-semibold text-link hover:underline">{L('Näytä kaikki brändit', 'Show all brands')}</button></div>}
          <RecentAnswers rows={scoped} filter={evFilter} onFilter={setEvFilter} answerId={stale ? '' : answerId} onAnswer={setAnswerId} projectId={projectId} context={ctx} />
        </div>
      )}
      <p className="text-[11px] leading-4 text-muted-ink" data-testid="text-methodology-note">{L('Tulokset koskevat tämän työtilan tallennettuja seurattavia kysymyksiä. Keräystapa näkyy vastauksen tiedoissa; API-vastauksia ei esitetä kuluttajapalvelun havaintoina. Sijoitus ja voitot koskevat ajoon tallennettua seurattujen brändien joukkoa, eivät kaikkia brändejä. Puuttuvia vastauksia ei lasketa nolliksi.', 'Results cover this workspace’s stored tracked prompts. Each answer identifies its collection surface; API answers are not presented as consumer observations. Position and wins cover the frozen tracked-brand set, not every brand. Missing answers are not counted as zero.')}</p>
    </div>
  );
}
