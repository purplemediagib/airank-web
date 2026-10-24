import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateProjectIntelligence, getGetProjectAnalyticsQueryKey, type DiscoveredBrand, type EvidenceIntelligence, type IntelligenceInput, type FanoutQuery } from '@workspace/api-client-react';
import { readApiError } from './api-errors';

export const MAX_ANALYSE = 50;
export const FANOUT_PAGE = 15;
export const SOURCE_TYPES = ['corporate', 'ugc', 'editorial', 'institutional', 'unknown'] as const;

/** Rejected and unconfirmed-ambiguous brands are never ranked; they go to the review list. */
export function splitBrands(rankings: DiscoveredBrand[]) {
  const ranked: DiscoveredBrand[] = [];
  const review: DiscoveredBrand[] = [];
  for (const b of rankings) (b.review === 'rejected' || (b.ambiguous && b.review !== 'confirmed') ? review : ranked).push(b);
  return { ranked, review };
}

const ACTIVE = new Set(['queued', 'running', 'analysing']);
export const jobsActive = (i?: EvidenceIntelligence) => !!i?.jobs.some((j) => ACTIVE.has(j.state));
/** Budget waits and credential problems are operator matters; never poll on them. */
export const jobsBlocked = (i?: EvidenceIntelligence) => !!i?.jobs.some((j) => j.error && /BUDGET_WAIT|CREDENTIAL|UNAUTHORI|API_KEY/i.test(j.error));
export const canAnalyse = (i?: EvidenceIntelligence) => !!i && i.available && i.enabled;

/** Saved eligible answers without an existing job, capped at 50. */
export function analyseCandidates(ids: string[], i: EvidenceIntelligence): string[] {
  const states = new Map(i.jobs.map((j) => [j.evidenceId,j.state]));
  return ids.filter((id) => !states.has(id) || states.get(id) === 'not_analysed').slice(0, MAX_ANALYSE);
}

export function fanoutPage(queries: FanoutQuery[], q: string, page: number) {
  const n = q.trim().toLocaleLowerCase();
  const rows = queries.filter((x) => !n || x.query.toLocaleLowerCase().includes(n));
  const pages = Math.max(1, Math.ceil(rows.length / FANOUT_PAGE));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((p - 1) * FANOUT_PAGE, p * FANOUT_PAGE), total: rows.length, page: p, pages };
}

/** One mutation hook for analyse, source review and brand review. Invalidates every filtered analytics variant of this workspace. */
export function useIntelligenceAction(projectId: string) {
  const qc = useQueryClient();
  const m = useUpdateProjectIntelligence();
  const busy = useRef(false);
  const run = (data: IntelligenceInput, cb: { onSuccess?: () => void; onError?: (message: string) => void } = {}) => {
    if (busy.current || m.isPending || !projectId) return;
    busy.current = true;
    m.mutate({ projectId, data }, {
      onSuccess: () => {
        const root = getGetProjectAnalyticsQueryKey(projectId)[0];
        void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === root });
        void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes(`/${projectId}/research`) });
        cb.onSuccess?.();
      },
      onError: (e) => { const f = readApiError(e); cb.onError?.(f.code ?? String(f.status ?? 'error')); },
      onSettled: () => { busy.current = false; },
    });
  };
  return { run, pending: m.isPending };
}
