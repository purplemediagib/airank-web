import { useGetProjectAnalytics, getGetProjectAnalyticsQueryKey, type GetProjectAnalyticsParams } from '@workspace/api-client-react';
import { useAccount } from './account';
import { readApiError } from './api-errors';
import { useQueryParam } from './use-query-param';
import { useLocation } from 'wouter';
import { useRef } from 'react';
import { pollDelay } from './sentiment';

/** Only active analysis justifies refresh; not_analysed history and budget/config waits never poll. */
const analysisActive = (st?: Record<string, number>) => !!st && ((st.queued ?? 0) + (st.analysing ?? 0)) > 0;

/** Account-scoped analytics query. Finite freshness; no mocked fallback when the endpoint is missing. */
export function useAnalytics(projectId: string, params: GetProjectAnalyticsParams) {
  const uid = useAccount().user?.id ?? 'anon';
  const polls = useRef<{ hash: string; base: number } | null>(null);
  const q = useGetProjectAnalytics(projectId, params, {
    query: {
      queryKey: [...getGetProjectAnalyticsQueryKey(projectId, params), uid], enabled: !!projectId, staleTime: 60_000, gcTime: 5 * 60_000,
      // Bounded backoff refresh while sentiment analysis is queued/analysing; budget resets on query identity change.
      refetchInterval: (query) => {
        const d = query.state.data;
        if (query.state.error || !d) return false;
        const fetches = query.state.dataUpdateCount;
        if (!polls.current || polls.current.hash !== query.queryHash) polls.current = { hash: query.queryHash, base: fetches };
        if (!analysisActive(d.metrics.sentiment?.states)) { polls.current.base = fetches; return false; }
        return pollDelay(fetches - polls.current.base);
      },
    },
  });
  const status = q.error ? readApiError(q.error).status : null;
  return Object.assign(q, { accessDenied: status === 401 || status === 403, unavailable: status === 404 || status === 503 || status === 501 });
}

const dayIso = (d: Date) => d.toISOString().slice(0, 10);

/** URL-backed filters mapped to the real query (from/to inclusive UTC days). */
export function useAnalyticsFilters() {
  const [location, navigate] = useLocation();
  const [range, setRange] = useQueryParam('range', '28');
  const [provider, setProvider] = useQueryParam('provider', 'all');
  const [topic, setTopic] = useQueryParam('topic', 'all');
  const [group, setGroup] = useQueryParam('group', '');
  const [legacyRunId] = useQueryParam('run', '');
  const [apiRunId] = useQueryParam('runId', '');
  const runId = legacyRunId || apiRunId;
  const [tag] = useQueryParam('tag', 'all');
  const [tagsRaw] = useQueryParam('tags', '');
  const [tagMode] = useQueryParam('tagMode', 'or');
  const [market] = useQueryParam('market', 'all');
  const [language] = useQueryParam('language', 'all');
  let tags: string[] = [];
  try { const parsed = JSON.parse(tagsRaw || '[]'); if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string'); } catch { /* Keep the invalid URL value in params for API validation. */ }
  const selectedTags = [...new Set([...tags, ...(tag !== 'all' ? [tag] : [])])];
  const [surface] = useQueryParam('surface', 'all');
  const [promptId] = useQueryParam('promptId', 'all');
  const [promptVersion] = useQueryParam('promptVersion', '');
  const [customFrom] = useQueryParam('from', '');
  const [customTo] = useQueryParam('to', '');
  const presetDays = ['7', '28', '90'].includes(range) ? Number(range) : 28;
  const custom = range === 'custom' || !!customFrom || !!customTo;
  const resetComposition = (name: string, value: string) => {
    const p = new URLSearchParams(window.location.search);
    const retainLatest = /\/dashboard\/results(?:\/|$)/.test(location) && p.has('group');
    for (const key of ['group','run','runId','answer','evidenceBrand','evidence','answersPage','page','src']) p.delete(key);
    if (retainLatest) p.set('group', 'latest');
    if (name === 'tags') p.delete('tag');
    if (name === 'tag') p.delete('tags');
    if (name === 'range') { p.delete('from'); p.delete('to'); }
    if (name === 'promptId') p.delete('promptVersion');
    if (!value || value === 'all') p.delete(name); else p.set(name, value);
    navigate(`${location}?${p.toString()}`, { replace: true });
  };
  const now = new Date();
  const to = custom && customTo ? customTo : dayIso(now);
  const from = custom && customFrom ? customFrom : dayIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (presetDays - 1))));
  const days = custom ? Math.max(1, Math.round((Date.parse(to)-Date.parse(from))/86400000)+1) : presetDays;
  const params: GetProjectAnalyticsParams = { from, to };
  if (provider !== 'all') params.provider = provider;
  if (topic !== 'all') params.topic = topic;
  if (group && group !== 'latest') params.group = group;
  if (runId) params.runId = runId;
  if (tag !== 'all') params.tag = tag;
  if (tagsRaw) params.tags = tagsRaw;
  if (tagMode !== 'or') params.tagMode = tagMode as 'and' | 'or';
  if (market !== 'all') params.market = market;
  if (language !== 'all') params.language = language;
  if (surface !== 'all') params.surface = surface;
  if (promptId !== 'all') params.promptId = promptId;
  if (promptVersion && promptId !== 'all') params.promptVersion = Number(promptVersion);
  const setDates = (from: string, to: string) => {
    const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && dayIso(new Date(s)) === s;
    if (!valid(from) || !valid(to) || from > to) return false;
    const p = new URLSearchParams(window.location.search);
    const retainLatest = /\/dashboard\/results(?:\/|$)/.test(location) && p.has('group');
    for (const key of ['group','run','runId','answer','evidenceBrand','evidence','answersPage','page','src']) p.delete(key);
    if (retainLatest) p.set('group', 'latest');
    p.set('range','custom'); p.set('from',from); p.set('to',to);
    navigate(`${location}?${p}`, {replace:true}); return true;
  };
  const reset = () => {
    const p = new URLSearchParams(window.location.search);
    for (const key of ['range','from','to','provider','topic','tag','tags','tagMode','market','language','surface','promptId','promptVersion','group','run','runId','answer','evidenceBrand','evidence','answersPage','answersQuery','page','src']) p.delete(key);
    navigate(`${location}${p.size ? `?${p}` : ''}`, {replace:true});
  };
  return { range:custom?'custom':range, setRange:(v:string)=>resetComposition('range',v),
    provider, setProvider:(v:string)=>resetComposition('provider',v), topic, setTopic:(v:string)=>resetComposition('topic',v),
    tag,setTag:(v:string)=>resetComposition('tag',v),surface,setSurface:(v:string)=>resetComposition('surface',v),
    tags: selectedTags, tagsRaw, tagMode, setTags:(v:string[])=>resetComposition('tags',v.length ? JSON.stringify([...new Set(v)].sort()) : ''),
    setTagMode:(v:string)=>resetComposition('tagMode',v),market,setMarket:(v:string)=>resetComposition('market',v),language,setLanguage:(v:string)=>resetComposition('language',v),
    promptId,setPromptId:(v:string)=>resetComposition('promptId',v),promptVersion,setPromptVersion:(v:string)=>resetComposition('promptVersion',v),
    setDates,reset,group, setGroup:(v:string)=>{ const p=new URLSearchParams(window.location.search);for(const key of ['run','runId','answer','answersPage','page','src'])p.delete(key);p.set('group',v);navigate(`${location}?${p}`,{replace:true}); },
    runId, setRunId:(v:string)=>{const p=new URLSearchParams(window.location.search);p.delete('runId');p.delete('run');if(v)p.set('run',v);navigate(`${location}?${p}`,{replace:true});}, params, from, to, days };
}

/** Timestamps may arrive as seconds or milliseconds. */
export const toMs = (n: number) => (n < 1e12 ? n * 1000 : n);
export const utcDay = (n: number) => dayIso(new Date(toMs(n)));
