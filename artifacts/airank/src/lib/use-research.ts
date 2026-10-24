import { useQueryClient } from '@tanstack/react-query';
import {
  getGetEvidenceDetailQueryKey,
  getGetProjectAnalyticsQueryKey,
  getGetProjectResearchQueryKey,
  useApplyResearchAction,
  useGetEvidenceDetail,
  useGetProjectResearch,
  type Source,
} from '@workspace/api-client-react';
import { useAccount } from './account';
import { readApiError } from './api-errors';

const isUnavailable = (err: unknown) => {
  const s = readApiError(err).status;
  return s === 404 || s === 501 || s === 503;
};

/** Account-scoped research cohort. Absent backend = honest unavailable, never mock data. */
export function useResearch(projectId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useGetProjectResearch(projectId, { query: { queryKey: [...getGetProjectResearchQueryKey(projectId), uid], enabled: !!projectId, staleTime: 30_000 } });
  return Object.assign(q, { unavailable: !!q.error && isUnavailable(q.error) });
}

export function useEvidenceDetail(projectId: string, evidenceId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useGetEvidenceDetail(projectId, evidenceId, { query: { queryKey: [...getGetEvidenceDetailQueryKey(projectId, evidenceId), uid], enabled: !!projectId && !!evidenceId } });
  const status = q.error ? readApiError(q.error).status : null;
  return Object.assign(q, { unavailable: status === 501 || status === 503, notFound: status === 404 });
}

/** Cohort writes: CSRF header, no retry; refresh research + analytics for every cached key of this project. */
export function useResearchWrite(projectId: string) {
  const qc = useQueryClient();
  const { writeRequest } = useAccount();
  const prefixes = [getGetProjectResearchQueryKey(projectId)[0], getGetProjectAnalyticsQueryKey(projectId)[0]];
  return useApplyResearchAction({
    request: writeRequest,
    mutation: {
      retry: false,
      onSettled: () => void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && prefixes.some((p) => (q.queryKey[0] as string).startsWith(p)) }),
    },
  });
}

export interface DomainRow {
  domain: string;
  urls: number;
  answers: number;
  owned: boolean;
  evidenceIds: string[];
}

/** Domain aggregation is a UNION of citing evidence IDs, never a sum of per-URL counts. */
export function aggregateDomains(sources: Source[]): DomainRow[] {
  const m = new Map<string, { urls: Set<string>; ids: Set<string>; owned: boolean }>();
  for (const s of sources) {
    const r = m.get(s.domain) ?? { urls: new Set(), ids: new Set(), owned: false };
    r.urls.add(s.url);
    s.evidenceIds.forEach((id) => r.ids.add(id));
    r.owned ||= s.owned;
    m.set(s.domain, r);
  }
  return [...m].map(([domain, r]) => ({ domain, urls: r.urls.size, answers: r.ids.size, owned: r.owned, evidenceIds: [...r.ids] }));
}

export const splitList = (v: string) => [...new Set(v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];
