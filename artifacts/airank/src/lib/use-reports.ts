import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMeasurementSettingsQueryKey,
  getGetReportQueryKey,
  getListReportsQueryKey,
  getReport,
  useCreateReport,
  useGetMeasurementSettings,
  useGetReport,
  useListReports,
  useUpdateMeasurementSettings,
} from '@workspace/api-client-react';
import { useAccount } from './account';
import { readApiError } from './api-errors';

const isUnavailable = (e: unknown) => { const s = readApiError(e).status; return s === 404 || s === 501 || s === 503; };

export function useReports(projectId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useListReports(projectId, { query: { queryKey: [...getListReportsQueryKey(projectId), uid], enabled: !!projectId } });
  return Object.assign(q, { unavailable: !!q.error && isUnavailable(q.error) });
}

export function useReport(projectId: string, reportId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useGetReport(projectId, reportId, { query: { queryKey: [...getGetReportQueryKey(projectId, reportId), uid], enabled: !!projectId && !!reportId, retry: false, staleTime: 0 } });
  const s = q.error ? readApiError(q.error).status : null;
  return Object.assign(q, { expired: s === 410, notFound: s === 404, unavailable: s === 501 || s === 503 });
}

/** Downloads always re-fetch the protected snapshot so expiry, session and ownership are honoured. */
export const fetchReportFresh = (projectId: string, reportId: string) => getReport(projectId, reportId, { cache: 'no-store', credentials: 'include' });

export function useCreateReportWrite(projectId: string) {
  const qc = useQueryClient();
  const { writeRequest } = useAccount();
  const key = getListReportsQueryKey(projectId)[0];
  return useCreateReport({ request: writeRequest, mutation: { retry: false, onSettled: () => void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === key }) } });
}

export function useMeasurementSettings(projectId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const q = useGetMeasurementSettings(projectId, { query: { queryKey: [...getGetMeasurementSettingsQueryKey(projectId), uid], enabled: !!projectId } });
  return Object.assign(q, { unavailable: !!q.error && isUnavailable(q.error) });
}

export function useMeasurementSettingsWrite(projectId: string) {
  const qc = useQueryClient();
  const { writeRequest } = useAccount();
  const key = getGetMeasurementSettingsQueryKey(projectId)[0];
  return useUpdateMeasurementSettings({ request: writeRequest, mutation: { retry: false, onSettled: () => void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === key }) } });
}
