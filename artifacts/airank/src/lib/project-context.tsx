import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useSearch } from 'wouter';
import { getListProjectsQueryKey, useListProjects, type Project } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from './account';
import { writeErrorMessage } from './api-errors';
import { useContentProjects, type ContentProjectIdentity } from './content-projects';

interface ProjectValue {
  projects: Project[];
  activeProjects: Project[];
  project: Project | null;
  contentProject: ContentProjectIdentity | null;
  contentProjects: ContentProjectIdentity[];
  contentPending: boolean;
  contentError: unknown;
  pending: boolean;
  error: unknown;
  refetch: () => void;
  listKey: readonly unknown[];
  select: (id: string) => void;
  /** Locale-prefixed href that keeps the active `?project=`. */
  projectHref: (path: string) => string;
}

const ProjectContext = createContext<ProjectValue | null>(null);

export function useProjectListKey() {
  const { user } = useAccount();
  return useMemo(() => [...getListProjectsQueryKey(), user?.id ?? 'anon'] as const, [user?.id]);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { authenticated, prefs, prefsPending, savePrefs } = useAccount();
  const { d, href } = useI18n();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const listKey = useProjectListKey();
  const q = useListProjects({ query: { queryKey: listKey, enabled: authenticated, staleTime: 30_000, refetchOnWindowFocus: true, refetchOnMount: true } });
  const projects = useMemo(() => q.data ?? [], [q.data]);
  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'active'), [projects]);
  const param = new URLSearchParams(search).get('project');
  const inContent = /^\/(fi|en)\/dashboard\/content(?:\/|$)/.test(location);
  const contentQ = useContentProjects(inContent);
  const contentProjects = contentQ.data ?? [];

  const project = useMemo(() => {
    if (param) {
      const hit = projects.find((p) => p.id === param);
      if (hit) return hit;
      return null;
    }
    const saved = prefs?.lastProjectId ? activeProjects.find((p) => p.id === prefs.lastProjectId) : undefined;
    return saved ?? activeProjects[0] ?? null;
  }, [param, projects, activeProjects, prefs?.lastProjectId]);
  const contentProject = inContent
    ? (param ? contentProjects.find(p => p.id === param) ?? null : contentProjects.find(p => p.id === project?.id) ?? contentProjects[0] ?? null)
    : null;

  // Keep ?project= in the URL so deep links, reloads and locale switches retain context.
  useEffect(() => {
    const selected = inContent ? contentProject : project;
    if (q.isPending || prefsPending || !selected || param === selected.id) return;
    const p = new URLSearchParams(window.location.search);
    p.set('project', selected.id);
    navigate(`${location}?${p.toString()}${window.location.hash}`, { replace: true });
  }, [q.isPending, prefsPending, project, contentProject, inContent, param, location, navigate]);

  const select = useCallback(
    (id: string) => {
      const p = new URLSearchParams(window.location.search);
      p.set('project', id);
      p.delete('scan');
      navigate(`${location}?${p.toString()}${window.location.hash}`);
      // Shared content access must not change ownership-scoped account preferences.
      if (prefs && projects.some(project => project.id === id) && prefs.lastProjectId !== id) {
        savePrefs({ lastProjectId: id }).catch((err) =>
          toast({ variant: 'destructive', title: d.auth.selectFailed, description: writeErrorMessage(err, d) }),
        );
      }
    },
    [location, navigate, prefs, savePrefs, toast, d, projects],
  );

  const projectHref = useCallback((path: string) => {
    const url = new URL(href(path), window.location.origin);
    const selected = inContent ? contentProject : project;
    if (selected) url.searchParams.set('project', selected.id);
    return `${url.pathname}${url.search}${url.hash}`;
  }, [href, project, contentProject, inContent]);

  const value = useMemo(
    () => ({ projects, activeProjects, project, contentProject, contentProjects, contentPending: contentQ.isPending, contentError: contentQ.error, pending: q.isPending || prefsPending, error: q.isError ? q.error : null, refetch: () => { void q.refetch(); if (inContent) void contentQ.refetch(); }, listKey, select, projectHref }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, activeProjects, project, contentProject, contentProjects, contentQ.isPending, contentQ.error, q.isPending, prefsPending, q.isError, q.error, listKey, select, projectHref],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects outside ProjectProvider');
  return ctx;
}

export function useProjectsOptional() {
  return useContext(ProjectContext);
}
