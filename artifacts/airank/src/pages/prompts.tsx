import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Archive, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Sparkles, Check, X } from 'lucide-react';
import type { Project, TrackedPrompt } from '@workspace/api-client-react';
import { SuggestionMix, SuggestionRow, topicHints} from '@/components/airank/suggestion-review';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTitle, useI18n } from '@/i18n';
import { writeErrorMessage, readApiError } from '@/lib/api-errors';
import { useProjects } from '@/lib/project-context';
import { toDate } from '@/lib/prompts-copy';
import { usePromptList, usePromptWrites, useSuggestions } from '@/lib/use-prompts';
import { useQueryParam } from '@/lib/use-query-param';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { FilterSelect, SearchInput } from '@/components/airank/data';
import { ConfirmDialog, SubTabs } from '@/components/airank/forms';
import { KindBadge, MonitoringPanel, PromptDialog, usePC } from '@/components/airank/prompt-parts';
import { PromptContextMismatch } from '@/components/airank/context-select';
import { projectContext, useContextLabels } from '@/lib/measurement-context';
import { MEASUREMENT_PROVIDERS, measurementProviderLabel } from '@/lib/provider-labels';
import { useAnalytics } from '@/lib/use-analytics';
import { PromptMetricCells } from '@/components/airank/prompt-metrics';
import { DailyStatusStrip } from '@/components/airank/schedule-settings';
import { useSchedule } from '@/lib/use-industries';
import { atPromptLimit, type DailySchedule } from '@/lib/daily-tracking';

export function StatusAction({ project, prompt, readOnly }: { project: Project; prompt: TrackedPrompt; readOnly: boolean }) {
  const c = usePC();
  const { d } = useI18n();
  const { toast } = useToast();
  const { update } = usePromptWrites(project.id);
  const [open, setOpen] = useState(false);
  const archived = prompt.status === 'archived';
  const run = () =>
    update.mutate(
      { projectId: project.id, promptId: prompt.id, data: { text: prompt.text, topic: prompt.topic, tags: prompt.tags, kind: prompt.kind, status: archived ? 'active' : 'archived', expectedVersion: prompt.version } },
      {
        onSuccess: () => toast({ title: archived ? c.restored : c.archived }),
        onError: (err) => toast({ variant: 'destructive', title: readApiError(err).code === 'VERSION_CONFLICT' ? c.form.errConflict : writeErrorMessage(err, d) }),
      },
    );
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={archived ? c.restoreConfirm : c.archiveConfirm}
      body={archived ? c.restoreBody : c.archiveBody}
      confirmLabel={archived ? c.restore : c.archive}
      onConfirm={run}
      trigger={
        <Button variant="ghost" size="sm" disabled={readOnly || update.isPending} aria-label={`${archived ? c.restore : c.archive}: ${prompt.text}`} data-testid={`button-${archived ? 'restore' : 'archive'}-${prompt.id}`}>
          {archived ? <RotateCcw aria-hidden /> : <Archive aria-hidden />}
          <span className="hidden lg:inline">{archived ? c.restore : c.archive}</span>
        </Button>
      }
    />
  );
}

function PromptList({ project, status, readOnly, onEdit }: { project: Project; status: 'active' | 'archived'; readOnly: boolean; onEdit: (p: TrackedPrompt) => void }) {
  const c = usePC();
  const { t, date, href } = useI18n();
  const [q, setQ] = useQueryParam('q', '');
  const [topic, setTopic] = useQueryParam('topic', '');
  const [tag, setTag] = useQueryParam('tag', '');
  const [provider, setProvider] = useQueryParam('provider', 'all');
  const [outcome, setOutcome] = useQueryParam('outcome', 'all');
  const [sort, setSort] = useQueryParam('sort', 'updated');
  const [pageRaw, setPage] = useQueryParam('page', '1');
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return;
    const id = window.setTimeout(() => { setQ(search); }, 300);
    return () => window.clearTimeout(id);
  }, [search, q, setQ]);

  const params = {
    status,
    page,
    sort,
    ...(q ? { search: q } : {}),
    ...(topic ? { topic } : {}),
    ...(tag ? { tag } : {}),
    ...(provider !== 'all' ? { provider } : {}),
    ...(outcome !== 'all' ? { outcome } : {}),
  };
  const list = usePromptList(project.id, params);
  const analytics = useAnalytics(project.id, {});
  const topics = Array.from(new Set([...(analytics.data?.topics ?? []).filter(Boolean), ...(topic ? [topic] : [])]));
  const filtered = !!(q || topic || tag || provider !== 'all' || outcome !== 'all');
  const total = list.data?.total ?? 0;
  const pageSize = list.data?.pageSize ?? 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const items = list.data?.items ?? [];
  const resetPage = (fn: (v: string) => void) => (v: string) => { fn(v); if (page !== 1) setTimeout(() => setPage('1'), 0); };

  const projectQs = `?project=${encodeURIComponent(project.id)}`;
  return (
    <Panel className="overflow-hidden" as="div">
      {topics.length > 0 && (
        <nav className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5" aria-label={c.filters.topic} data-testid="nav-topics">
          {['', ...topics].map((t) => (
            <button key={t || 'all'} type="button" aria-pressed={topic === t} onClick={() => resetPage(setTopic)(t)}
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ring-1 transition-colors ${topic === t ? 'bg-tint text-ink ring-cyan' : 'bg-white text-muted-ink ring-line hover:text-ink'}`} data-testid={`button-topic-${t || 'all'}`}>
              {t || c.filters.all}
            </button>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-2 border-b border-line p-4 xl:flex-row xl:flex-wrap xl:items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); if (page !== 1) setPage('1'); }} label={c.filters.search} testId="input-search" />
        <input value={topic} onChange={(e) => resetPage(setTopic)(e.target.value)} placeholder={c.filters.topic} aria-label={c.filters.topic} className="h-11 rounded-lg border border-line bg-white px-3 text-sm md:h-10 xl:w-[150px]" data-testid="input-filter-topic" />
        <input value={tag} onChange={(e) => resetPage(setTag)(e.target.value)} placeholder={c.filters.tag} aria-label={c.filters.tag} className="h-11 rounded-lg border border-line bg-white px-3 text-sm md:h-10 xl:w-[130px]" data-testid="input-filter-tag" />
        <div className="flex flex-wrap gap-2">
          <FilterSelect label={c.filters.provider} value={provider} onChange={resetPage(setProvider)} testId="select-provider" options={[{ value: 'all', label: `${c.filters.provider}: ${c.filters.all}` }, ...MEASUREMENT_PROVIDERS.map(value => ({ value, label: measurementProviderLabel(value) }))]} />
          <FilterSelect label={c.filters.outcome} value={outcome} onChange={resetPage(setOutcome)} testId="select-outcome" options={[{ value: 'all', label: `${c.filters.outcome}: ${c.filters.all}` }, ...Object.entries(c.filters.outcomes).map(([value, label]) => ({ value, label }))]} />
          <FilterSelect label={c.filters.sort} value={sort} onChange={resetPage(setSort)} testId="select-sort" options={[{ value: 'updated', label: c.filters.sortUpdated }, { value: 'text', label: c.filters.sortText }]} />
        </div>
        {filtered && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setQ(''); setTopic(''); setTag(''); setProvider('all'); setOutcome('all'); setPage('1'); }} data-testid="button-clear-filters">{c.filters.clear}</Button>}
      </div>
      <p className="border-b border-line px-4 py-2 text-[11px] leading-4 text-muted-ink" data-testid="text-performance-gap">{c.performanceGap}</p>
      {list.isPending ? <LoadingBlock rows={5} /> : list.isError ? <ErrorState onRetry={() => void list.refetch()} /> : !items.length ? (
        filtered ? <EmptyState title={c.emptyFiltered} body={c.emptyFilteredBody} /> : status === 'active' ? <EmptyState title={c.emptyActive} body={c.emptyActiveBody} /> : <EmptyState title={c.emptyArchive} body={c.emptyArchiveBody} icon={<Archive className="size-[18px]" aria-hidden />} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid={`table-prompts-${status}`}>
              <caption className="sr-only">{c.title}</caption>
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-line text-[12px] text-muted-ink">
                  <th scope="col" className="h-10 px-4 font-medium">{c.cols.prompt}</th>
                  <th scope="col" className="px-4 font-medium">{c.cols.kind}</th>
                  <th scope="col" className="px-4 font-medium">{c.cols.topic}</th>
                  <th scope="col" className="px-4 font-medium">{c.cols.version}</th>
                  <th scope="col" className="px-4 font-medium">{c.meta.created}</th>
                  {[c.perf.visibility, c.perf.recommendations, c.perf.sentiment].map((h) => <th key={h} scope="col" className="px-3 text-right font-medium">{h}</th>)}
                  <th scope="col" className="px-4 text-right font-medium"><span className="sr-only">{c.cols.actions}</span></th>
                </tr>
              </thead>
              <tbody className={list.isFetching ? 'opacity-70 transition-opacity' : ''}>
                {items.map((p) => (
                  <tr key={p.id} className="grid gap-2 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas/70 md:table-row md:p-0" data-testid={`row-prompt-${p.id}`}>
                    <td className="md:max-w-[440px] md:px-4 md:py-3">
                      <Link href={href(`/dashboard/prompts/${p.id}${projectQs}`)} lang={p.language ?? projectContext(project).language} className="font-medium text-ink underline-offset-2 hover:text-link hover:underline" data-testid={`link-prompt-${p.id}`}>{p.text}</Link> <PromptContextMismatch prompt={p} project={project} />
                      {p.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{p.tags.map((tg) => <span key={tg} className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted-ink ring-1 ring-line">#{tg}</span>)}</div>}
                    </td>
                    <td className="md:px-4"><KindBadge kind={p.kind} /></td>
                    <td className="text-[13px] text-muted-ink md:px-4">{p.topic || '–'}</td>
                    <td className="tabular text-[13px] text-ink md:px-4">v{p.version}</td>
                    <td className="tabular text-[13px] text-muted-ink md:px-4"><span className="mr-2 md:hidden">{c.meta.created}</span>{date(toDate(p.createdAt), { dateStyle: 'medium' })}</td>
                    <PromptMetricCells a={analytics.accessDenied ? undefined : analytics.data} promptId={p.id} version={p.version} loading={analytics.isPending} />
                    <td className="md:px-4 md:text-right">
                      <div className="flex gap-1 md:justify-end">
                        <Button asChild variant="ghost" size="sm"><Link href={`${href('/dashboard/results')}?project=${encodeURIComponent(project.id)}&prompt=${encodeURIComponent(p.id)}`} aria-label={`${c.answersLink}: ${p.text}`} data-testid={`link-answers-${p.id}`}><span className="hidden lg:inline">{c.answersLink}</span><span className="lg:hidden">{c.answersShort}</span></Link></Button>
                        {status === 'active' && <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => onEdit(p)} aria-label={`${c.edit}: ${p.text}`} data-testid={`button-edit-${p.id}`}><Pencil aria-hidden /><span className="hidden lg:inline">{c.edit}</span></Button>}
                        <StatusAction project={project} prompt={p} readOnly={readOnly} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12px] text-muted-ink">
            <span data-testid="text-total">{t(c.total, { n: total })}</span>
            <div className="flex items-center gap-1">
              <span className="mr-2" aria-live="polite">{t(c.page, { page, total: pages })}</span>
              <Button variant="ghost" size="icon" className="size-9 md:size-8" disabled={page <= 1} onClick={() => setPage(String(page - 1))} aria-label={c.prev} data-testid="button-page-prev"><ChevronLeft aria-hidden /></Button>
              <Button variant="ghost" size="icon" className="size-9 md:size-8" disabled={page >= pages} onClick={() => setPage(String(page + 1))} aria-label={c.next} data-testid="button-page-next"><ChevronRight aria-hidden /></Button>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function Suggestions({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const c = usePC();
  const ctxLabels = useContextLabels();
  const { d: dd, t: tt } = useI18n();
  const { d, href } = useI18n();
  const { toast } = useToast();
  const q = useSuggestions(project.id);
  const { generate, review } = usePromptWrites(project.id);
  const onErr = (err: unknown) => {
    const code = readApiError(err).code;
    toast({ variant: 'destructive', title: code === 'DUPLICATE_PROMPT' ? c.form.errDuplicate : code === 'APP_NOT_CONFIGURED' ? c.sugg.notConfigured : code === 'AI_UNAVAILABLE' ? c.sugg.aiUnavailable : writeErrorMessage(err, d) });
  };
  const list = q.data ?? [];
  const analytics = useAnalytics(project.id, {});
  const hints = topicHints(list, analytics.data?.topics ?? []);
  const tone = { pending: 'info', accepted: 'success', rejected: 'neutral' } as const;
  return (
    <Panel className="overflow-hidden" aria-labelledby="sugg-title">
      <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[620px]">
          <h2 id="sugg-title" className="text-[16px] font-semibold text-ink">{c.sugg.title}</h2>
          <p className="mt-1 text-[13px] leading-[19px] text-muted-ink">{c.sugg.body}</p>
          <p className="mt-1 text-[12px] leading-[17px] text-muted-ink" data-testid="text-suggestion-language">{tt(dd.auth.suggestTranslateNote, { language: ctxLabels.language(projectContext(project).language) })}</p>
        </div>
        <Button variant="secondary" disabled={readOnly} loading={generate.isPending} onClick={() => generate.mutate({ projectId: project.id, data: {} }, { onSuccess: (r) => { if (!r.length) toast({ title: c.sugg.none }); }, onError: onErr })} data-testid="button-generate-suggestions">
          <Sparkles aria-hidden />{c.sugg.generate}
        </Button>
      </div>
      {q.isPending ? <LoadingBlock rows={4} /> : q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : !list.length ? <EmptyState title={c.sugg.empty} body={c.sugg.emptyBody} icon={<Sparkles className="size-[18px]" aria-hidden />} /> : (
        <>
        <SuggestionMix list={list} />
        <ul className="divide-y divide-line" data-testid="list-suggestions">
          {list.map((s) => {
            const busy = review.isPending && review.variables?.suggestionId === s.id;
            return (
              <SuggestionRow key={s.id} s={s} lang={projectContext(project).language} hints={hints} readOnly={readOnly} disabled={review.isPending}
                busyAction={busy ? (review.variables?.data.action as 'accept' | 'reject') : null} sourceLabel={c.sugg.source} statusLabel={c.sugg[s.status]} tone={tone[s.status]}
                openHref={href(`/dashboard/prompts/${s.promptId}?project=${encodeURIComponent(project.id)}`)} openLabel={c.sugg.open}
                onAccept={(edits) => review.mutate({ projectId: project.id, suggestionId: s.id, data: { action: 'accept', ...(edits ?? {}) } }, { onSuccess: () => toast({ title: c.sugg.accepted }), onError: onErr })}
                onReject={() => review.mutate({ projectId: project.id, suggestionId: s.id, data: { action: 'reject' } }, { onError: onErr })} />
            );
          })}
        </ul>
        </>
      )}
    </Panel>
  );
}

export default function PromptsPage() {
  const c = usePC();
  const { project, activeProjects } = useProjects();
  const { locale, href } = useI18n();
  const sched = useSchedule(project?.id ?? '');
  const [dialog, setDialog] = useState<{ open: boolean; prompt?: TrackedPrompt }>({ open: false });
  useDocumentTitle(c.title);
  if (!project) return null;
  const readOnly = project.status === 'archived';
  const schedule = sched.data as DailySchedule | undefined;
  const full = atPromptLimit(schedule);
  const noLimit = schedule?.status === 'limit_unconfigured';
  const conflict = schedule?.status === 'conflict';
  const addBlocked = readOnly || full || noLimit || conflict;
  const addReason = conflict ? (locale === 'fi' ? 'Arkistoi ylimääräiset projektit ennen kysymysten lisäämistä.' : 'Archive the extra projects before adding prompts.')
    : noLimit ? (locale === 'fi' ? 'Kysymysrajaa ei ole määritetty palvelimella.' : 'The prompt limit is not configured on the server.')
    : full ? (locale === 'fi' ? 'Kysymysraja on täynnä. Arkistoi kysymys lisätäksesi uuden.' : 'The prompt limit is reached. Archive a prompt to add another.') : null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        actions={<Button disabled={addBlocked} title={addReason ?? undefined} onClick={() => setDialog({ open: true })} data-testid="button-add-prompt"><Plus aria-hidden />{c.add}</Button>}
      />
      <DailyStatusStrip projectId={project.id} />
      {conflict && (
        <ReasonNote tone="warning">
          <span className="flex flex-wrap items-center gap-2" data-testid="text-prompt-set-conflict">
            {locale === 'fi' ? 'Palvelin on päivitettävä tukemaan useita työtiloja. Aiemmat projektit ja vastaukset säilyvät.' : 'The server needs an update to support multiple workspaces. Existing projects and answers are preserved.'}
          </span>
        </ReasonNote>
      )}
      {addReason && !conflict && !readOnly && <p className="text-[12px] text-muted-ink" data-testid="text-add-blocked">{addReason}</p>}
      {readOnly && <ReasonNote tone="warning">{c.readOnly}</ReasonNote>}
      <SubTabs
        label={c.title}
        fallback="active"
        tabs={[{ value: 'active', label: c.tabs.active }, { value: 'suggestions', label: c.tabs.suggestions }, { value: 'archive', label: c.tabs.archive }, { value: 'runs', label: c.tabs.runs }]}
      >
        {(tab) =>
          tab === 'suggestions' ? <Suggestions project={project} readOnly={readOnly} />
          : tab === 'runs' ? <MonitoringPanel project={project} />
          : <PromptList key={tab} project={project} status={tab === 'archive' ? 'archived' : 'active'} readOnly={readOnly} onEdit={(p) => setDialog({ open: true, prompt: p })} />
        }
      </SubTabs>
      <PromptDialog open={dialog.open} onOpenChange={(v) => setDialog((s) => ({ ...s, open: v }))} project={project} prompt={dialog.prompt} />
    </div>
  );
}
