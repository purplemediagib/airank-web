import { useQueryClient } from '@tanstack/react-query';
import {
  getListOpportunitiesQueryKey,
  useListOpportunities,
  useRefreshOpportunities,
  useUpdateOpportunity,
  type Opportunity,
} from '@workspace/api-client-react';
import { useAccount } from './account';
import { readApiError } from './api-errors';

/** Account-scoped opportunity list. Absent backend = honest unavailable. */
export function useOpportunities(projectId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useListOpportunities(projectId, { query: { queryKey: [...getListOpportunitiesQueryKey(projectId), uid], enabled: !!projectId, staleTime: 30_000 } });
  const s = q.error ? readApiError(q.error).status : null;
  return Object.assign(q, { unavailable: s === 404 || s === 501 || s === 503 });
}

function useInvalidate(projectId: string) {
  const qc = useQueryClient();
  const key = getListOpportunitiesQueryKey(projectId)[0];
  return { qc, uidKey: (uid: string) => [...getListOpportunitiesQueryKey(projectId), uid], all: () => void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === key }) };
}

/** Deterministic rule refresh from stored analytics (no paid calls); the returned list replaces the cache. */
export function useOpportunityRefresh(projectId: string) {
  const { writeRequest, user } = useAccount();
  const { qc, uidKey, all } = useInvalidate(projectId);
  return useRefreshOpportunities({
    request: writeRequest,
    mutation: { retry: false, onSuccess: (list) => qc.setQueryData(uidKey(user?.id ?? 'anon'), list), onSettled: all },
  });
}

export function useOpportunityUpdate(projectId: string) {
  const { writeRequest, user } = useAccount();
  const { qc, uidKey, all } = useInvalidate(projectId);
  return useUpdateOpportunity({
    request: writeRequest,
    mutation: {
      retry: false,
      onSuccess: (o) => qc.setQueryData<Opportunity[]>(uidKey(user?.id ?? 'anon'), (old) => old?.map((x) => (x.id === o.id ? o : x))),
      onSettled: all,
    },
  });
}
