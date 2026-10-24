import { useQueryClient } from '@tanstack/react-query';
import {
  getGetIndustryQueryKey,
  getGetProjectScheduleQueryKey,
  getListIndustriesQueryKey,
  useApplyIndustryAction,
  useGetIndustry,
  useGetProjectSchedule,
  useListIndustries,
  useUpdateProjectSchedule,
} from '@workspace/api-client-react';
import { useAccount } from './account';
import { readApiError } from './api-errors';

const unavailable = (err: unknown) => { const s = readApiError(err).status; return s === 404 || s === 501 || s === 503; };

export function useIndustryDirectory() {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useListIndustries({ query: { queryKey: [...getListIndustriesQueryKey(), uid], staleTime: 30_000 } });
  return Object.assign(q, { unavailable: !!q.error && unavailable(q.error) });
}

export function useIndustry(id: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useGetIndustry(id, { query: { queryKey: [...getGetIndustryQueryKey(id), uid], enabled: !!id } });
  const s = q.error ? readApiError(q.error).status : null;
  return Object.assign(q, { notFound: s === 404, unavailable: s === 501 || s === 503 });
}

/** Admin actions. The server alone decides admin (403 otherwise); every industry query is refreshed. */
export function useIndustryAction() {
  const qc = useQueryClient();
  const { writeRequest } = useAccount();
  const prefix = getListIndustriesQueryKey()[0] as string;
  return useApplyIndustryAction({
    request: writeRequest,
    mutation: { retry: false, onSettled: () => void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(prefix) }) },
  });
}

export function useSchedule(projectId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useGetProjectSchedule(projectId, { query: { queryKey: [...getGetProjectScheduleQueryKey(projectId), uid], enabled: !!projectId, refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 15_000 } });
  return Object.assign(q, { unavailable: !!q.error && unavailable(q.error) });
}

export function useScheduleWrite(projectId: string) {
  const qc = useQueryClient();
  const { writeRequest } = useAccount();
  const key = getGetProjectScheduleQueryKey(projectId)[0] as string;
  return useUpdateProjectSchedule({
    request: writeRequest,
    mutation: { retry: false, onSettled: () => void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === key }) },
  });
}

/** Every user's cached schedule for every project; call after prompt/project mutations. */
export function invalidateSchedules(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/airank/v1/projects/') && (q.queryKey[0] as string).endsWith('/schedule') });
}
