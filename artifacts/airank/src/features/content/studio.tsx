import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from 'wouter';
import { useAccount } from '@/lib/account';
import { useProjects } from '@/lib/project-context';
import { useI18n } from '@/i18n';
import { contentClient, contentPermissions, createJobSubmitter, type ContentClient, type ContentJob, type ContentRole } from '@/lib/content-api';

export interface Studio {
  projectId: string;
  client: ContentClient;
  submitter: ReturnType<typeof createJobSubmitter>;
  role: ContentRole;
  can: ReturnType<typeof contentPermissions>;
  overview: any;
  modelOk: boolean;
  jobs: ContentJob[];
  jobsPending: boolean;
  refresh: () => void;
  ph: (path: string) => string;
  key: (...k: unknown[]) => unknown[];
  userId: string;
}
const Ctx = createContext<Studio | null>(null);
export const useStudio = () => { const c = useContext(Ctx); if (!c) throw new Error('useStudio outside StudioProvider'); return c; };
const ACTIVE = ['queued', 'running'];
export const isActiveJob = (j: ContentJob) => ACTIVE.includes(j.status);

export function useContentProjectId(): string | null {
  const search = useSearch();
  const { contentProject, project } = useProjects();
  return new URLSearchParams(search).get('project') || contentProject?.id || project?.id || null;
}

/** Loads the overview first (role + capabilities). Children render only with a resolved role. */
export function StudioProvider({ projectId, children, fallback }: { projectId: string; children: ReactNode; fallback: (s: { pending: boolean; error: unknown; retry: () => void }) => ReactNode }) {
  const { csrfToken, user } = useAccount();
  const { href } = useI18n();
  const qc = useQueryClient();
  const csrfRef = useMemoRef(csrfToken ?? '');
  const userId = user?.id ?? 'anon';
  const client = useMemo(() => contentClient(projectId, () => csrfRef.current), [projectId, csrfRef]);
  const submitter = useMemo(() => createJobSubmitter(client, `${userId}:${projectId}`, window.sessionStorage), [client, userId, projectId]);
  const key = (...k: unknown[]) => ['content', userId, projectId, ...k];
  const ov = useQuery({ queryKey: key('overview'), queryFn: () => client.overview(), staleTime: 15_000, retry: false });
  const jobsQ = useQuery({
    queryKey: key('jobs'), queryFn: () => client.jobs(), enabled: ov.isSuccess, retry: false,
    refetchInterval: (q) => (document.visibilityState === 'visible' && (q.state.data ?? []).some(isActiveJob) ? 4000 : false),
  });
  const value = useMemo<Studio | null>(() => {
    if (!ov.data) return null;
    const role = (ov.data.role ?? 'viewer') as ContentRole;
    return {
      projectId, client, submitter, role, can: contentPermissions(role), overview: ov.data,
      modelOk: ov.data.capabilities?.modelConfigured === true, jobs: jobsQ.data ?? [], jobsPending: jobsQ.isPending,
      refresh: () => { void qc.invalidateQueries({ queryKey: ['content', userId, projectId] }); },
      ph: (path: string) => { const u = new URL(href(path), window.location.origin); u.searchParams.set('project', projectId); return `${u.pathname}${u.search}${u.hash}`; },
      key, userId,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov.data, jobsQ.data, jobsQ.isPending, projectId, client, submitter, href, userId]);
  if (!value) return <>{fallback({ pending: ov.isPending, error: ov.error, retry: () => void ov.refetch() })}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
import { useRef } from 'react';
function useMemoRef<T>(v: T) { const r = useRef(v); r.current = v; return r; }

export function useDocuments() {
  const s = useStudio();
  return useQuery({ queryKey: s.key('documents'), queryFn: () => s.client.documents(), retry: false });
}
export function useRecords(area: 'sources' | 'opportunities' | 'publications' | 'assessments') {
  const s = useStudio();
  return useQuery({ queryKey: s.key(area), queryFn: () => s.client.request<any[]>('GET', '/' + area), retry: false });
}
/** Latest jobs per kind for a document. */
export function jobsFor(jobs: ContentJob[], kind: string, documentId?: string) {
  return jobs.filter((j) => j.kind === kind && (!documentId || j.input?.documentId === documentId));
}
