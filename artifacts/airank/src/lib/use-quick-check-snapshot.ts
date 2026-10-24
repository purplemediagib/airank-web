import { useEffect, useState } from 'react';
import { getGetQuickCheckQueryKey, getListProjectQuickChecksQueryKey, useGetQuickCheck, useListProjectQuickChecks } from '@workspace/api-client-react';
import { useAccount } from './account';
import { hasUsefulQuickCheckResults, isQuickCheckPending, nextSnapshotCandidate, sortedQuickChecks } from './quick-check-snapshot-data';

/** Independent of monitoring and analytics filters; all protected cache entries are account scoped. */
export function useQuickCheckSnapshot(projectId: string) {
  const uid = useAccount().user?.id;
  const scope = `${uid}:${projectId}`;
  const [skipped, setSkipped] = useState<string[]>([]);
  const list = useListProjectQuickChecks(projectId, { query: {
    queryKey: [...getListProjectQuickChecksQueryKey(projectId), uid],
    enabled: !!projectId && !!uid,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => !query.state.error && query.state.data?.some((check) => isQuickCheckPending(check.status)) ? 4000 : false,
  } });
  const checks = sortedQuickChecks(list.data ?? []);
  // Inspect completed candidates newest first. A pending job must not hide saved measurements.
  const candidate = nextSnapshotCandidate(checks, skipped.filter((key) => key.startsWith(`${scope}:`)).map((key) => key.slice(scope.length + 1)));
  const report = useGetQuickCheck(candidate?.id ?? '', { query: {
    queryKey: [...getGetQuickCheckQueryKey(candidate?.id ?? ''), uid],
    enabled: !!candidate && !!uid,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => !query.state.error && query.state.data && isQuickCheckPending(query.state.data.status) ? 4000 : false,
  } });
  const data = report.data;
  const useful = data?.project_id === projectId && hasUsefulQuickCheckResults(data);
  useEffect(() => {
    if (candidate && data && !isQuickCheckPending(data.status) && !useful) {
      const key = `${scope}:${candidate.id}`;
      setSkipped((previous) => previous.includes(key) ? previous : [...previous, key]);
    }
  }, [candidate?.id, data, scope, useful]);
  return {
    latest: checks[0],
    snapshot: useful ? data : undefined,
    isPending: list.isPending || (!!candidate && (report.isPending || (!useful && !report.isError))),
    isError: list.isError || (!!candidate && report.isError),
    refetch: () => { setSkipped([]); void list.refetch(); if (candidate) void report.refetch(); },
  };
}
