import { getListProjectQuickChecksQueryKey, useListProjectQuickChecks, getListMonitoringRunsQueryKey, useListMonitoringRuns } from '@workspace/api-client-react';
import { useAccount } from './account';
import { useProjectsOptional } from './project-context';
import { useI18n } from '@/i18n';
import { isQuickCheckPending, sortedQuickChecks } from './quick-check-snapshot-data';

export function useQuickCheckSummary() {
  const project = useProjectsOptional()?.project;
  const { user } = useAccount();
  const { locale, d } = useI18n();
  const q = useListProjectQuickChecks(project?.id ?? '', { query: {
    queryKey: [...getListProjectQuickChecksQueryKey(project?.id ?? ''), user?.id],
    enabled: !!project && !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => !query.state.error && query.state.data?.some((check) => isQuickCheckPending(check.status)) ? 4000 : false,
  } });
  const monitoring = useListMonitoringRuns(project?.id ?? '', { query: {
    queryKey: [...getListMonitoringRunsQueryKey(project?.id ?? ''), user?.id],
    enabled: !!project && !!user,
    staleTime: 30_000,
  } });
  const latest = sortedQuickChecks(q.data ?? [])[0];
  const latestMonitoring = monitoring.data?.[0];
  const isPending=q.isPending||monitoring.isPending, isError=q.isError||monitoring.isError;
  const count=(q.data?.length??0)+(monitoring.data?.length??0);
  const label = !project ? d.shell.noProject : isPending ? d.common.loading : isError
    ? (locale === 'fi' ? 'Tarkistusten lataus epäonnistui' : 'Checks could not be loaded')
    : count ? (locale === 'fi' ? `${count} tallennettua tarkistusta tai seuranta-ajoa` : `${count} saved checks or monitoring runs`)
    : d.shell.noMeasurements;
  return { ...q, latest, latestMonitoring, label, project, isPending, isError, refetch:()=>Promise.all([q.refetch(),monitoring.refetch()]) };
}
