import { invalidateSchedules } from './use-industries';
import { useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMonitoringRunQueryKey,
  getGetTrackedPromptQueryKey,
  getListMonitoringRunsQueryKey,
  getListPromptSuggestionsQueryKey,
  getListTrackedPromptsQueryKey,
  useCreateTrackedPrompt,
  useGeneratePromptSuggestions,
  useGetMonitoringRun,
  useGetTrackedPrompt,
  useListMonitoringRuns,
  useListPromptSuggestions,
  useListTrackedPrompts,
  useReviewPromptSuggestion,
  useUpdateTrackedPrompt,
  type ListTrackedPromptsParams,
} from '@workspace/api-client-react';
import { useAccount } from './account';
import { PENDING_RUN } from './prompts-copy';
import { itemNeedsPoll, pollDelay } from './sentiment';

function useUid() {
  return useAccount().user?.id ?? 'anon';
}

export function usePromptList(projectId: string, params: ListTrackedPromptsParams) {
  const uid = useUid();
  const queryKey = [...getListTrackedPromptsQueryKey(projectId, params), uid];
  return useListTrackedPrompts(projectId, params, { query: { queryKey, enabled: !!projectId } });
}

export function usePromptDetail(projectId: string, promptId: string) {
  const uid = useUid();
  return useGetTrackedPrompt(projectId, promptId, { query: { queryKey: [...getGetTrackedPromptQueryKey(projectId, promptId), uid], enabled: !!projectId && !!promptId } });
}

export function useSuggestions(projectId: string) {
  const uid = useUid();
  return useListPromptSuggestions(projectId, { query: { queryKey: [...getListPromptSuggestionsQueryKey(projectId), uid], enabled: !!projectId } });
}

export function useRuns(projectId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  const queryKey = useMemo(() => [...getListMonitoringRunsQueryKey(projectId), uid], [projectId, uid]);
  const q = useListMonitoringRuns(projectId, {
    query: { queryKey, enabled: !!projectId, refetchInterval: (query) => (!query.state.error && (query.state.data ?? []).some((r) => PENDING_RUN.has(r.status)) ? 4000 : false) },
  });
  const states=q.data?.map(r=>`${r.id}:${r.status}`).join('|');
  useEffect(()=>{
    if(!states)return;
    // Run status changes refresh every project-scoped cache (prompts, prompt detail, analytics, results) except the runs list itself.
    const runsKey=getListMonitoringRunsQueryKey(projectId)[0];
    const projectPrefix=getListTrackedPromptsQueryKey(projectId)[0].replace(/\/prompts.*$/,'/');
    void qc.invalidateQueries({predicate:q=>typeof q.queryKey[0]==='string'&&q.queryKey[0].startsWith(projectPrefix)&&q.queryKey[0]!==runsKey});
  },[qc,projectId,states]);
  return Object.assign(q, { listKey: queryKey });
}

export function useRun(projectId: string, runId: string) {
  const uid = useUid();
  const analysisPolls = useRef<{ hash: string; base: number } | null>(null);
  return useGetMonitoringRun(projectId, runId, {
    query: {
      queryKey: [...getGetMonitoringRunQueryKey(projectId, runId), uid],
      enabled: !!projectId && !!runId,
      // Collection: unchanged 4s polling. After completion: bounded backoff while sentiment analysis is still queued/running.
      refetchInterval: (query) => {
        const d = query.state.data;
        if (query.state.error) return false;
        if (!d || PENDING_RUN.has(d.run.status)) return 4000;
        const fetches = query.state.dataUpdateCount;
        if (!analysisPolls.current || analysisPolls.current.hash !== query.queryHash) analysisPolls.current = { hash: query.queryHash, base: fetches };
        if (!d.evidence.some((e) => itemNeedsPoll({ state: e.state, sentimentAnalysis: e.sentimentAnalysis, runCreatedAt: d.run.createdAt }))) { analysisPolls.current.base = fetches; return false; }
        return pollDelay(fetches - analysisPolls.current.base);
      },
    },
  });
}

/** All prompt writes: CSRF header, no retries, invalidate project prompt caches (all users' keys share the URL prefix). */
export function usePromptWrites(projectId: string) {
  const qc = useQueryClient();
  const { writeRequest } = useAccount();
  const invalidate = () => {
    const prefixes = [getListTrackedPromptsQueryKey(projectId)[0], getListPromptSuggestionsQueryKey(projectId)[0], getListMonitoringRunsQueryKey(projectId)[0]];
    void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && prefixes.some((p) => (q.queryKey[0] as string).startsWith(p)) });
    invalidateSchedules(qc);
  };
  const opts = { request: writeRequest, mutation: { retry: false as const, onSuccess: invalidate } };
  return {
    create: useCreateTrackedPrompt(opts),
    update: useUpdateTrackedPrompt(opts),
    generate: useGeneratePromptSuggestions(opts),
    review: useReviewPromptSuggestion(opts),
    invalidate,
  };
}
