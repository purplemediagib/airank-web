import { useRef } from 'react';
import type { Query, QueryKey } from '@tanstack/react-query';
import {
  getGetProjectResultQueryKey,
  getListProjectResultsQueryKey,
  useGetProjectResult,
  useListProjectResults,
  useRequestSentimentBackfill,
  type ListProjectResultsParams,
  type ResultItem,
  type ResultPage,
} from '@workspace/api-client-react';
import { useAccount } from './account';
import { readApiError } from './api-errors';
import { MAX_POLLS, itemNeedsPoll, pollDelay } from './sentiment';

const AUTH_DENIED = new Set([401, 403]);
const MAX_POLL_MS = 10 * 60_000;

const failure = (err: unknown) => {
  const s = err ? readApiError(err).status : null;
  return { httpStatus: s, unavailable: s === 404 || s === 501 || s === 503, forbidden: s === 401 || s === 403 };
};

/** Bounded retry for transient failures only; auth denials and missing resources never retry. */
const retry = (n: number, err: unknown) => {
  const s = readApiError(err).status;
  return s !== null && s >= 500 && s !== 501 && n < 2;
};

type PollState = { hash: string; base: number; startedAt: number; last: number };

/**
 * Poll scheduler driven by real fetch outcomes (data + error update counts) since polling began
 * for this exact query identity. Identity change (project, user, filters, page) resets the budget.
 * Stops on auth denial, when nothing is outstanding, after MAX_POLLS fetches or MAX_POLL_MS.
 */
function makeInterval<T>(ref: { current: PollState | null }, needsPoll: (d: T) => boolean) {
  return (query: Query<T, unknown, T, QueryKey>): number | false => {
    const { data, error, dataUpdateCount, errorUpdateCount } = query.state;
    const fetches = dataUpdateCount + errorUpdateCount;
    if (!ref.current || ref.current.hash !== query.queryHash) ref.current = { hash: query.queryHash, base: fetches, startedAt: Date.now(), last: fetches };
    const st = ref.current;
    st.last = fetches;
    const status = error ? readApiError(error).status : null;
    if (status !== null && AUTH_DENIED.has(status)) return false;
    if (!data || !needsPoll(data)) { st.base = fetches; st.startedAt = Date.now(); return false; }
    if (Date.now() - st.startedAt > MAX_POLL_MS) return false;
    return pollDelay(fetches - st.base);
  };
}

const stopped = (ref: { current: PollState | null }, outstanding: boolean) =>
  outstanding && !!ref.current && (ref.current.last - ref.current.base >= MAX_POLLS || Date.now() - ref.current.startedAt > MAX_POLL_MS);

/**
 * Results page. GET only; never creates scans or analysis jobs.
 * Previous data is shown as a placeholder only while paging/filtering within the same
 * owner and project, never across projects or users. React Query keeps the last successful
 * data on transient refetch errors, dedupes in-flight requests (no overlap), and aborts
 * through the generated request signal when the page unmounts.
 */
export function useResults(projectId: string, params: ListProjectResultsParams, opts: { enabled?: boolean } = {}) {
  const uid = useAccount().user?.id ?? 'anon';
  const poll = useRef<PollState | null>(null);
  const scope = getListProjectResultsQueryKey(projectId)[0];
  const q = useListProjectResults(projectId, params, {
    query: {
      queryKey: [...getListProjectResultsQueryKey(projectId, params), uid],
      enabled: !!projectId && opts.enabled !== false,
      placeholderData: (prev: ResultPage | undefined, prevQuery?: Query<ResultPage, unknown, ResultPage, QueryKey>) => {
        const k = prevQuery?.queryKey;
        return k && k[0] === scope && k[k.length - 1] === uid ? prev : undefined;
      },
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry,
      refetchInterval: makeInterval<ResultPage>(poll, (d) => d.items.some(itemNeedsPoll)),
    },
  });
  const outstanding = !!q.data?.items.some(itemNeedsPoll);
  return Object.assign(q, failure(q.error), { pollingStopped: stopped(poll, outstanding) });
}

export function useResult(projectId: string, evidenceId: string) {
  const uid = useAccount().user?.id ?? 'anon';
  const poll = useRef<PollState | null>(null);
  const q = useGetProjectResult(projectId, evidenceId, {
    query: {
      queryKey: [...getGetProjectResultQueryKey(projectId, evidenceId), uid],
      enabled: !!projectId && !!evidenceId,
      refetchOnWindowFocus: false,
      retry,
      refetchInterval: makeInterval<ResultItem>(poll, itemNeedsPoll),
    },
  });
  return Object.assign(q, failure(q.error));
}

/** Explicit, user-confirmed historical analysis. May incur charges. Never called automatically. */
export function useSentimentBackfill() {
  const { writeRequest } = useAccount();
  return useRequestSentimentBackfill({ request: writeRequest, mutation: { retry: false } });
}
