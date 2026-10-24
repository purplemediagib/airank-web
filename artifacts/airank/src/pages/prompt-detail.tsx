import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle, useI18n } from '@/i18n';
import { isStatus } from '@/lib/api-errors';
import { useProjects } from '@/lib/project-context';
import { toDate } from '@/lib/prompts-copy';
import { usePromptDetail } from '@/lib/use-prompts';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { SubTabs } from '@/components/airank/forms';
import { EvidenceTable, KindBadge, PromptDialog, usePC } from '@/components/airank/prompt-parts';
import { StatusAction } from './prompts';
import { PromptContextMismatch } from '@/components/airank/context-select';
import { projectContext } from '@/lib/measurement-context';
import { PromptResults } from '@/components/airank/prompt-results';
import { PromptScopedMetrics } from '@/components/airank/prompt-metrics';

export default function PromptDetailPage() {
  const c = usePC();
  const { href, date } = useI18n();
  const { id = '' } = useParams<{ id: string }>();
  const { project } = useProjects();
  const q = usePromptDetail(project?.id ?? '', id);
  const [editing, setEditing] = useState(false);
  useDocumentTitle(c.detailTitle);
  if (!project) return null;
  const readOnly = project.status === 'archived';
  const back = (
    <Link href={href(`/dashboard/prompts?project=${encodeURIComponent(project.id)}`)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-ink hover:text-ink" data-testid="link-back">
      <ArrowLeft className="size-4" aria-hidden />{c.back}
    </Link>
  );
  if (q.isPending) return <div className="flex flex-col gap-4">{back}<Panel className="p-6"><LoadingBlock rows={6} /></Panel></div>;
  if (q.isError) return <div className="flex flex-col gap-4">{back}<Panel>{isStatus(q.error, 404) ? <EmptyState title={c.notFound} body={c.notFoundBody} /> : <ErrorState onRetry={() => void q.refetch()} />}</Panel></div>;

  const { prompt, versions, measurements } = q.data;
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={back}
        title={c.detailTitle}
        actions={
          <div className="flex gap-2">
            {prompt.status === 'active' && <Button variant="secondary" disabled={readOnly} onClick={() => setEditing(true)} data-testid="button-edit-prompt"><Pencil aria-hidden />{c.edit}</Button>}
            <StatusAction project={project} prompt={prompt} readOnly={readOnly} />
          </div>
        }
      />
      {readOnly && <ReasonNote tone="warning">{c.readOnly}</ReasonNote>}
      <Panel className="p-5 ar-rise">
        <PromptContextMismatch detailed prompt={prompt} project={project} />
        <p lang={prompt.language ?? projectContext(project).language} className="mt-2 text-[18px] font-semibold leading-[26px] text-ink" data-testid="text-prompt">{prompt.text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <KindBadge kind={prompt.kind} />
          <StatusBadge tone={prompt.status === 'active' ? 'success' : 'neutral'}>{prompt.status === 'active' ? c.meta.active : c.meta.archivedS}</StatusBadge>
          <span className="tabular rounded-md bg-canvas px-2 py-1 text-ink ring-1 ring-line">v{prompt.version}</span>
          {prompt.topic && <span className="text-muted-ink">{c.cols.topic}: <span className="text-ink">{prompt.topic}</span></span>}
          {prompt.tags.map((t) => <span key={t} className="rounded bg-canvas px-1.5 py-0.5 text-muted-ink ring-1 ring-line">#{t}</span>)}
        </div>
        <p className="mt-3 text-[12px] leading-[17px] text-muted-ink">{c.kindHelp[prompt.kind]}</p>
      </Panel>

      <SubTabs label={c.detailTitle} fallback="responses" tabs={[{ value: 'responses', label: c.detailTabs.responses }, { value: 'versions', label: c.detailTabs.versions }]}>
        {(tab) => {
          if (tab === 'responses') return <PromptResults metrics={<PromptScopedMetrics projectId={project.id} promptId={prompt.id} version={prompt.version} />} fallback={measurements.length ? <EvidenceTable evidence={measurements} testId="list-responses" /> : undefined} projectId={project.id} promptId={prompt.id} currentVersion={prompt.version} market={prompt.market ?? projectContext(project).market} language={prompt.language ?? projectContext(project).language} />;
          if (tab === 'versions')
            return (
              <Panel className="overflow-hidden" as="div">
                {!sortedVersions.length ? <EmptyState compact title={c.versions.empty} /> : (
                  <ol className="divide-y divide-line" data-testid="list-versions">
                    {sortedVersions.map((v) => (
                      <li key={v.version} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start md:justify-between" data-testid={`row-version-${v.version}`}>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[12px] text-muted-ink"><span className="tabular font-semibold text-ink">v{v.version}</span>{v.version === prompt.version && <StatusBadge tone="info" dot={false}>{c.versions.current}</StatusBadge>}<KindBadge kind={v.kind} /></p>
                          <p lang={v.language ?? projectContext(project).language} className="mt-1 text-sm text-ink">{v.text}</p>
                          {(v.topic || v.tags.length > 0) && <p className="mt-1 text-[12px] text-muted-ink">{v.topic}{v.tags.length ? ` · ${v.tags.map((t) => `#${t}`).join(' ')}` : ''}</p>}
                        </div>
                        <p className="tabular shrink-0 text-[12px] text-muted-ink">{c.versions.created} {date(toDate(v.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            );
          return null;
        }}
      </SubTabs>
      <PromptDialog open={editing} onOpenChange={setEditing} project={project} prompt={prompt} />
    </div>
  );
}
