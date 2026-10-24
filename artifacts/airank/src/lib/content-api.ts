/** The Content Studio contract is pinned to Bunny revision b34d7c39231d.
 * Browser calls stay on the existing same-origin proxy. No worker/service keys here.
 */
export type Locale = 'en' | 'fi';
export type JobKind = 'import' | 'sitemap' | 'audit' | 'research' | 'rewrite' | 'create' | 'opportunities' | 'perception' | 'impact' | 'publish';
export type JobState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'uncertain';
export type ContentRole = 'owner' | 'editor' | 'reviewer' | 'viewer';
export interface ContentDocument {
  id: string; version: number; title: string; description: string; markdown: string;
  locale: Locale; status: 'draft' | 'in_review' | 'approved' | 'changes_requested';
  sourceUrl: string | null; reviewedClaims: boolean; updatedAt: number;
  topic?: string; expertise?: string; [field: string]: any;
}
export interface ContentJob {
  id: string; kind: JobKind; status: JobState; input: Record<string, any>;
  checkpoint: Record<string, any>; result: any; error: string | null;
  [field: string]: any;
}
export class ContentError extends Error {
  constructor(public status: number, public code: string) { super(code); this.name = 'ContentError'; }
}
export const contentPermissions = (role: ContentRole) => ({
  read: true, edit: role === 'owner' || role === 'editor',
  review: role === 'owner' || role === 'reviewer', manage: role === 'owner',
});
export function contentClient(projectId: string, csrf: () => string, base = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/airank/v1`) {
  const prefix = `${base}/projects/${encodeURIComponent(projectId)}/content`;
  async function request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    // Do not permit a caller to escape the authenticated project's content prefix.
    if (path && (!path.startsWith('/') || /[?#\\]/.test(path.split('?')[0]) || path.split(/[/?]/).some(p => p === '..' || p === '.')))
      throw new ContentError(400, 'INVALID_PATH');
    const token = method === 'GET' ? '' : csrf();
    if (method !== 'GET' && !token) throw new ContentError(401, 'AUTH_REQUIRED');
    let response: Response;
    try {
      response = await fetch(prefix + path, {
        method, credentials: 'same-origin', redirect: 'error',
        headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-CSRF-Token': token } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new ContentError(0, 'CONNECTION_UNCERTAIN'); }
    let payload: any;
    try { payload = await response.json(); }
    catch { throw new ContentError(response.ok ? 502 : response.status, 'RESPONSE_UNAVAILABLE'); }
    if (!response.ok) throw new ContentError(response.status, payload?.error?.code || 'REQUEST_FAILED');
    return payload as T;
  }
  return {
    overview: () => request('GET', ''),
    documents: () => request<ContentDocument[]>('GET', '/documents'),
    document: (id: string) => request<ContentDocument>('GET', '/documents/' + encodeURIComponent(id)),
    create: (input: Pick<ContentDocument, 'title' | 'description' | 'markdown' | 'locale'> & Record<string, unknown>) => request<ContentDocument>('POST', '/documents', input),
    save: (id: string, expectedVersion: number, changes: Partial<ContentDocument>) => request<ContentDocument>('PATCH', '/documents/' + encodeURIComponent(id), { ...changes, expectedVersion }),
    submit: (kind: JobKind, input: Record<string, unknown>, submissionId: string) => request<ContentJob>('POST', '/jobs', { kind, input, submissionId }),
    job: (id: string) => request<ContentJob>('GET', '/jobs/' + encodeURIComponent(id)),
    jobs: () => request<ContentJob[]>('GET', '/jobs'),
    cancel: (id: string) => request<ContentJob>('POST', '/jobs/' + encodeURIComponent(id) + '/cancel', {}),
    retry: (id: string) => request<ContentJob>('POST', '/jobs/' + encodeURIComponent(id) + '/retry', {}),
    apply: (id: string, expectedVersion: number, jobId: string, changeIds?: string[]) => request<ContentDocument>('POST', '/documents/' + encodeURIComponent(id) + '/apply', { expectedVersion, jobId, ...(changeIds ? { changeIds } : {}) }),
    review: (id: string, expectedVersion: number, status: string, factsChecked = false, note = '') => request<ContentDocument>('POST', '/documents/' + encodeURIComponent(id) + '/review', { expectedVersion, status, factsChecked, note }),
    export: (id: string) => request<{ markdown: string; html: string; plainText: string; title: string; description: string; structuredDataSuggestion: unknown; note: string }>('GET', '/documents/' + encodeURIComponent(id) + '/export'),
    request,
  };
}
export const newSubmissionId = () => crypto.randomUUID();
export type ContentClient = ReturnType<typeof contentClient>;
type PendingIntent = { key: string; body: string; id: string };

/** Persist an uncertain submission, not a second automatic attempt. Scope MUST
 * include authenticated user + project. CMS credentials never enter job input.
 */
export function createJobSubmitter(client: ContentClient, scope: string, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const key = `airank-content-intent:${scope}`;
  let memory: PendingIntent | undefined;
  function load() {
    try { const raw = storage?.getItem(key); if (raw) return JSON.parse(raw) as PendingIntent; } catch { /* storage unavailable */ }
    return memory;
  }
  function canonical(value: any): any {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])]));
    return value;
  }
  async function run<T>(intent: string, payload: unknown, send: (id: string) => Promise<T>) {
    const body = JSON.stringify(canonical(payload));
    const pending = load();
    // Require resolution of an uncertain publication before a second publish intent.
    if (pending?.key === 'publish' && (intent !== pending.key || pending.body !== body))
      throw new ContentError(409, 'PUBLICATION_RECONCILIATION_REQUIRED');
    const next = pending?.key === intent && pending.body === body ? pending : { key: intent, body, id: newSubmissionId() };
    memory = next;
    try { storage?.setItem(key, JSON.stringify(next)); } catch { /* still safe for this mounted page */ }
    try {
      const result = await send(next.id);
      memory = undefined;
      try { storage?.removeItem(key); } catch { /* storage unavailable */ }
      return result;
    } catch (error) {
      // An explicit client rejection proves no new queue write was accepted.
      // Network/5xx remain uncertain and retain the SAME id for reconciliation.
      if (error instanceof ContentError && error.status >= 400 && error.status < 500) {
        memory = undefined; try { storage?.removeItem(key); } catch { /* storage unavailable */ }
      }
      throw error;
    }
  }
  return {
    submit: (kind: JobKind, input: Record<string, unknown>) => run(kind, input, id => client.submit(kind, input, id)),
    bulk: (items: { kind: 'audit' | 'research' | 'rewrite'; documentId: string; documentVersion: number }[]) =>
      run('bulk', items, submissionId => client.request<ContentJob[]>('POST', '/bulk', { items, submissionId })),
    pending: load,
    /** Use only after an explicit lookup/acknowledgement by the user. */
    clear: () => { memory = undefined; try { storage?.removeItem(key); } catch { /* storage unavailable */ } },
  };
}
