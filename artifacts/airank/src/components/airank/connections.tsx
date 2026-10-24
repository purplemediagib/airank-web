import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetGoogleConnectionQueryKey, getGetGoogleReportsQueryKey, getListGooglePropertiesQueryKey,
  useConnectGoogleConnection, useDisconnectGoogleConnection, useGetGoogleConnection, useGetGoogleReports,
  useListGoogleProperties, useSelectGoogleProperty, useSyncGoogleConnection, type GoogleConnectionStatus,
} from '@workspace/api-client-react';
import { useI18n, isLocale } from '@/i18n';
import { useAccount } from '@/lib/account';
import { readApiError } from '@/lib/api-errors';
import { useToast } from '@/hooks/use-toast';
import { Panel, StatusBadge, LoadingBlock, ErrorState, EmptyState, type Tone } from '@/components/airank/primitives';
import { SelectField, ConfirmDialog } from '@/components/airank/forms';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useProjects } from '@/lib/project-context';
import { connectionsCopy, googleImportDiagnostic, googleImportError, type ConnectionsCopy } from '@/lib/connections-copy';
import { defaultRange, rangeOk, reportFlags, cell } from '@/lib/traffic-report';

type Service = 'ga4' | 'gsc';
const STORE = 'airank.google.oauth';
const ACTIVE = ['queued', 'running', 'retrying'];

export function beginOAuth(projectId: string, locale: string) {
  try { sessionStorage.setItem(STORE, JSON.stringify({ projectId, locale })); } catch { /* storage unavailable */ }
}
export function readOAuth(): { projectId: string; locale: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
    return v && typeof v.projectId === 'string' && isLocale(v.locale) ? v : null;
  } catch { return null; }
}
export function clearOAuth() { try { sessionStorage.removeItem(STORE); } catch { /* ignore */ } }

const fmt = (t: (s: string, v?: Record<string, string | number>) => string, s: string, v: Record<string, string | number>) => t(s, v);
function ReportViewer({ projectId, service, c }: { projectId: string; service: Service; c: ConnectionsCopy }) {
  const { t } = useI18n();
  const views = service === 'ga4' ? ['sources', 'pages', 'countries', 'devices'] : ['totals', 'queries', 'pages', 'countries', 'devices'];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(views[0]);
  const [range, setRange] = useState(defaultRange);
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const valid = rangeOk(range.from, range.to);
  const params = { startDate: range.from, endDate: range.to, view: view as 'sources', offset, limit, ...(service === 'ga4' ? { aiOnly: true } : {}) };
  const q = useGetGoogleReports(projectId, service, params, {
    query: { queryKey: getGetGoogleReportsQueryKey(projectId, service, params), enabled: open && valid, staleTime: 60_000, refetchOnWindowFocus: false },
  });
  const rows = (q.data?.rows ?? []) as Record<string, unknown>[];
  const cols = useMemo(() => { const s = new Set<string>(); rows.forEach((r) => Object.keys(r).forEach((k) => s.add(k))); return [...s]; }, [rows]);
  const meta = (q.data?.metadata ?? []) as Record<string, unknown>[];
  const total = q.data?.totalRows ?? 0;
  const flags = useMemo(() => reportFlags(meta), [meta]);
  const partial = (q.data?.missingDates.length ?? 0) > 0;
  const head = (k: string) => (c[`c_${k}` as keyof ConnectionsCopy] as string | undefined) ?? k;
  const dateInput = 'h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan';
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-auto text-[14px] font-semibold text-ink">{c.reports}</h4>
        <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`button-report-toggle-${service}`}>{open ? c.hideReports : c.showReports}</Button>
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-muted-ink">{c.reportNote}</p>
          <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] font-medium text-ink">{service === 'ga4' ? c.ga4Note : c.gscNote}</p>
          {service === 'gsc' && <p className="text-[12px] text-muted-ink">{c.gscScope}</p>}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-muted-ink">{c.from}<input type="date" className={dateInput} value={range.from} onChange={(e) => { setRange({ ...range, from: e.target.value }); setOffset(0); }} data-testid={`input-from-${service}`} /></label>
            <label className="flex flex-col gap-1 text-[12px] text-muted-ink">{c.to}<input type="date" className={dateInput} value={range.to} onChange={(e) => { setRange({ ...range, to: e.target.value }); setOffset(0); }} data-testid={`input-to-${service}`} /></label>
            <div className="min-w-[160px]"><SelectField label={c.view} value={view} testId={`select-view-${service}`} options={views.map((v) => ({ value: v, label: c[`v_${v}` as keyof ConnectionsCopy] as string }))} onChange={(v) => { setView(v); setOffset(0); }} /></div>
          </div>
          {!valid && <p role="alert" className="text-[13px] font-medium text-danger">{c.rangeBad}</p>}
          {valid && q.isPending && <LoadingBlock rows={3} />}
          {valid && q.isError && <p role="alert" className="text-[13px] font-medium text-danger">{c.reportFailed} <button type="button" className="underline" onClick={() => void q.refetch()}>{c.retry}</button></p>}
          {valid && q.data && (
            <>
              {(partial || flags.truncated || flags.sampling || flags.threshold) && (
                <ul className="flex flex-col gap-2" data-testid={`flags-report-${service}`}>
                  {partial && <li role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] font-medium text-warning">{c.flagPartial}</li>}
                  {flags.truncated && <li role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] font-medium text-warning">{c.flagTruncated}</li>}
                  {flags.sampling && <li role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] font-medium text-warning">{c.flagSampling}</li>}
                  {flags.threshold && <li role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-[13px] font-medium text-warning">{c.flagThreshold}</li>}
                </ul>
              )}
              {rows.length === 0 ? <EmptyState compact title={c.noRows} /> : (
                <div className="overflow-x-auto rounded-[12px] border border-line">
                  <table className="w-full min-w-[480px] text-left text-[13px]" data-testid={`table-report-${service}`}>
                    <thead className="bg-canvas text-[11px] text-muted-ink"><tr>{cols.map((k) => <th key={k} scope="col" className="px-3 py-2 font-medium">{head(k)}</th>)}</tr></thead>
                    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{cols.map((k) => <td key={k} className="max-w-[320px] break-words px-3 py-2 text-ink">{cell(r[k])}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-[12px] text-muted-ink">{rows.length ? fmt(t, c.rows, { from: offset + 1, to: offset + rows.length, total }) : ''}</span>
                <Button variant="secondary" size="sm" disabled={offset === 0 || q.isFetching} onClick={() => setOffset(Math.max(0, offset - limit))} data-testid={`button-prev-${service}`}>{c.prev}</Button>
                <Button variant="secondary" size="sm" disabled={q.data.nextOffset == null || q.isFetching} onClick={() => setOffset(q.data!.nextOffset ?? offset)} data-testid={`button-next-${service}`}>{c.next}</Button>
              </div>
              <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-canvas p-3 text-[12px] text-ink" data-testid={`meta-report-${service}`}>
                <p className="font-semibold">{c.meta}</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  <div><dt className="text-muted-ink">{c.metaTz}</dt><dd>{q.data.timeZone ?? '-'}</dd></div>
                  <div><dt className="text-muted-ink">{c.metaCur}</dt><dd>{q.data.currency ?? '-'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-ink">{c.available}</dt><dd className="break-words">{q.data.availableDates.length ? `${q.data.availableDates[0]} - ${q.data.availableDates[q.data.availableDates.length - 1]} (${q.data.availableDates.length})` : c.none}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-ink">{c.missing}</dt><dd className="break-words">{q.data.missingDates.length ? q.data.missingDates.join(', ') : c.none}</dd></div>
                </dl>
                {q.data.notes.length > 0 && <div><p className="text-muted-ink">{c.notes}</p><ul className="list-disc pl-4">{q.data.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
                {meta.length > 0 && (
                  <details><summary className="cursor-pointer text-muted-ink">{c.rawDetails} ({meta.length})</summary>
                    <ul className="mt-1 flex max-h-48 flex-col gap-1 overflow-auto">{meta.map((m, i) => <li key={i} className="break-words rounded border border-line bg-white px-2 py-1">{Object.entries(m).map(([k, v]) => `${k}: ${cell(v)}`).join(' | ')}</li>)}</ul>
                  </details>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ projectId, service, readOnly, notice }: { projectId: string; service: Service; readOnly: boolean; notice: boolean }) {
  const { d, t, date, locale } = useI18n();
  const c = connectionsCopy[locale];
  const { toast } = useToast();
  const { writeRequest } = useAccount();
  const qc = useQueryClient();
  const [pick, setPick] = useState('');
  const [changing, setChanging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState(false);
  const name = service === 'ga4' ? c.ga4 : c.gsc;
  const statusKey = getGetGoogleConnectionQueryKey(projectId, service);
  const status = useGetGoogleConnection(projectId, service, {
    query: {
      queryKey: statusKey, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, retry: 1,
      refetchInterval: (q) => { const s = (q.state.data as GoogleConnectionStatus | undefined)?.sync?.status; return s && ACTIVE.includes(s) ? 5000 : false; },
    },
  });
  const s = status.data;
  const setupErr = status.isError && readApiError(status.error).code === 'GOOGLE_CONNECTOR_SETUP_REQUIRED';
  const syncState = s?.sync?.status;
  const prevSync = useRef(syncState);
  useEffect(() => {
    if (prevSync.current && ACTIVE.includes(prevSync.current) && syncState && !ACTIVE.includes(syncState)) void qc.invalidateQueries({ queryKey: getGetGoogleReportsQueryKey(projectId, service) });
    prevSync.current = syncState;
  }, [syncState, qc, projectId, service]);
  const connected = !!s?.connected && s.status === 'connected';
  const needsProp = connected && !s?.property;
  const showProps = !!s && s.configured && connected && (needsProp || changing);
  const props = useListGoogleProperties(projectId, service, { query: { queryKey: getListGooglePropertiesQueryKey(projectId, service), enabled: showProps, staleTime: 0, retry: 0 } });
  const opts = {
    request: writeRequest,
  };
  const invalidate = () => {
    for (const k of [statusKey, getListGooglePropertiesQueryKey(projectId, service), getGetGoogleReportsQueryKey(projectId, service)]) void qc.invalidateQueries({ queryKey: k });
  };
  const fail = () => setErr(true);
  const connect = useConnectGoogleConnection({ ...opts, mutation: { retry: false } });
  const select = useSelectGoogleProperty({ ...opts, mutation: { retry: false } });
  const sync = useSyncGoogleConnection({ ...opts, mutation: { retry: false } });
  const disc = useDisconnectGoogleConnection({ ...opts, mutation: { retry: false } });
  const busy = connect.isPending || select.isPending || sync.isPending || disc.isPending;
  const off = readOnly || busy;

  const doConnect = () => {
    setErr(false);
    connect.mutate({ projectId, service, data: {} }, {
      onSuccess: (r) => { beginOAuth(projectId, locale); window.location.assign(r.url); },
      onError: fail,
    });
  };
  const doSelect = () => {
    if (!pick) return;
    setErr(false);
    const rk = getGetGoogleReportsQueryKey(projectId, service);
    void qc.cancelQueries({ queryKey: rk }); qc.removeQueries({ queryKey: rk });
    select.mutate({ projectId, service, data: { property: pick } }, { onSuccess: () => { setChanging(false); setPick(''); qc.removeQueries({ queryKey: getGetGoogleReportsQueryKey(projectId, service) }); invalidate(); }, onError: fail });
  };
  const doSync = () => { setErr(false); sync.mutate({ projectId, service, data: {} }, { onSuccess: invalidate, onError: fail }); };
  const doDisc = () => {
    setErr(false);
    const rk0 = getGetGoogleReportsQueryKey(projectId, service);
    void qc.cancelQueries({ queryKey: rk0 }); qc.removeQueries({ queryKey: rk0 });
    disc.mutate({ projectId, service, data: {} }, {
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetGoogleReportsQueryKey(projectId, service) });
        qc.removeQueries({ queryKey: getListGooglePropertiesQueryKey(projectId, service) });
        qc.setQueryData(statusKey, (old: GoogleConnectionStatus | undefined) => old ? { ...old, connected: false, status: 'disconnected', email: null, property: null, timeZone: null, currency: null, connectedAt: null, sync: null } : old);
        void qc.invalidateQueries({ queryKey: statusKey });
        setPick(''); setChanging(false);
        toast({ title: c.disconnectedOk });
      },
      onError: fail,
    });
  };

  const importFailed = s?.sync?.status === 'failed';
  const hasImportedDays = (s?.sync?.completedDays ?? 0) > 0;
  const imported = connected && !!s?.property && hasImportedDays && !!s?.sync?.completedAt && (s.sync.status === 'complete' || s.sync.status === 'completed');
  const tone: Tone = setupErr ? 'warning' : !s ? 'neutral' : !s.configured ? 'warning' : s.status === 'reconnect_required' ? 'error' : connected ? (imported ? 'success' : 'warning') : 'neutral';
  const label = setupErr ? c.setupNeeded : !s ? '' : !s.configured ? c.setupNeeded : s.status === 'reconnect_required' ? c.reconnect
    : connected && importFailed ? c.authorizedImportFailed
    : connected && !s.property ? c.authorizedNoProperty
    : connected && !imported ? (hasImportedDays ? c.authorizedNoImport : c.propertyNoImport)
    : connected ? c.importedReady : c.disconnected;
  const sy = s?.sync;
  const diagnostic = googleImportDiagnostic(sy?.lastError);
  const syLabel = sy ? (c[`s_${sy.status}` as keyof ConnectionsCopy] as string | undefined) ?? sy.status : '';
  const pct = sy && sy.totalDays > 0 ? Math.min(100, Math.round((sy.completedDays / sy.totalDays) * 100)) : 0;
  const propItems = props.data?.items ?? [];

  return (
    <Panel className="flex flex-col gap-4 p-5 md:p-6" data-testid={`card-connection-${service}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto min-w-0">
          <h3 className="text-[16px] font-semibold text-ink">{name}</h3>
          <p className="max-w-[60ch] text-[12px] text-muted-ink">{service === 'ga4' ? c.ga4Body : c.gscBody}</p>
        </div>
        {label && <StatusBadge tone={tone} data-testid={`status-connection-${service}`}>{label}</StatusBadge>}
      </div>
      {notice && <p role="status" className="rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-muted-ink">{c.cancelled}</p>}
      {status.isPending ? <LoadingBlock rows={2} /> : setupErr ? (
        <p className="rounded-lg border border-warning/30 bg-warning-bg p-3 text-[13px] text-warning" data-testid={`text-setup-${service}`}>{c.setupGuide}</p>
      ) : status.isError || !s ? (
        <ErrorState body={c.loadFailed} onRetry={() => void status.refetch()} retrying={status.isFetching} />
      ) : !s.configured ? (
        <p className="rounded-lg border border-warning/30 bg-warning-bg p-3 text-[13px] text-warning" data-testid={`text-setup-${service}`}>{c.setupBody}</p>
      ) : (
        <>
          {s.status === 'reconnect_required' && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-3 text-[13px] text-danger">{c.reconnectBody}</p>}
          {connected && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-[12px] border border-line bg-canvas p-4 text-[13px] md:grid-cols-3">
              <div className="min-w-0"><dt className="text-[11px] text-muted-ink">{c.account}</dt><dd className="truncate font-medium text-ink">{s.email ?? '-'}</dd></div>
              <div className="min-w-0"><dt className="text-[11px] text-muted-ink">{c.property}</dt><dd className="break-all font-medium text-ink">{s.property ?? '-'}</dd></div>
              <div><dt className="text-[11px] text-muted-ink">{c.connectedAt}</dt><dd className="font-medium text-ink">{s.connectedAt ? date(s.connectedAt, { dateStyle: 'medium' }) : '-'}</dd></div>
              <div><dt className="text-[11px] text-muted-ink">{c.timeZone}</dt><dd className="font-medium text-ink">{s.timeZone ?? '-'}</dd></div>
              <div><dt className="text-[11px] text-muted-ink">{c.currency}</dt><dd className="font-medium text-ink">{s.currency ?? '-'}</dd></div>
            </dl>
          )}
          {showProps && (
            <div className="flex flex-col gap-2">
              {props.isPending ? <LoadingBlock rows={1} /> : props.isError ? (
                <ErrorState body={c.propsFailed} onRetry={() => void props.refetch()} retrying={props.isFetching} />
              ) : propItems.length === 0 ? (
                <EmptyState compact title={c.noProperties} />
              ) : (
                <>
                  <SelectField label={c.chooseProperty} value={pick} testId={`select-property-${service}`} disabled={off}
                    options={[{ value: '', label: '-' }, ...propItems.map((p) => ({ value: p.id, label: [p.displayName ?? p.id, p.accountName, p.permissionLevel].filter(Boolean).join(' / ') }))]}
                    onChange={setPick} />
                  <div className="flex gap-2">
                    {s.property && pick && pick !== s.property && <p role="status" className="text-[12px] text-warning">{c.replaceProperty}</p>}
                    <Button size="sm" onClick={doSelect} disabled={off || !pick} loading={select.isPending} data-testid={`button-save-property-${service}`}>{select.isPending ? c.saving : c.save}</Button>
                    {changing && <Button size="sm" variant="ghost" onClick={() => setChanging(false)}>{d.auth.cancel}</Button>}
                  </div>
                </>
              )}
            </div>
          )}
          {connected && s.property && sy && (
            <div className="flex flex-col gap-2 rounded-[12px] border border-line p-3 text-[13px]" aria-live="polite" data-testid={`sync-${service}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{c.syncStatus}</span>
                <StatusBadge tone={sy.status === 'failed' ? 'error' : (sy.status === 'complete' || sy.status === 'completed') ? 'success' : 'info'} dot={false}>{syLabel}</StatusBadge>
                <span className="text-muted-ink">{fmt(t, c.progress, { done: sy.completedDays, total: sy.totalDays })}</span>
              </div>
              <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-tint"><div className="h-full bg-cyan" style={{ width: `${pct}%` }} /></div>
              {sy.completedAt && <p className="text-[12px] text-muted-ink">{c.completedAt}: {date(sy.completedAt, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
              {sy.lastError && (
                <div role="alert" className="flex flex-col gap-1 text-[12px] text-danger">
                  <p className="font-medium">{googleImportError(sy.lastError, locale)}</p>
                  {diagnostic && <details>
                    <summary className="cursor-pointer text-muted-ink" data-testid={`toggle-sync-error-${service}`}>{c.details}</summary>
                    <p className="mt-1 break-words rounded border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-ink" data-testid={`text-sync-error-${service}`}>
                      {diagnostic}
                    </p>
                  </details>}
                </div>
              )}
            </div>
          )}
          {err && <p role="alert" className="text-[13px] font-medium text-danger" data-testid={`text-error-${service}`}>{c.actionFailed}</p>}
          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-center [&>button]:w-full sm:[&>button]:w-auto">
            {!connected && <Button onClick={doConnect} disabled={off} loading={connect.isPending} data-testid={`button-connect-${service}`}>{connect.isPending ? c.connecting : s.status === 'reconnect_required' ? c.reconnectBtn : c.connect}</Button>}
            {connected && s.property && <Button variant="secondary" onClick={doSync} disabled={off || (!!sy && ACTIVE.includes(sy.status))} loading={sync.isPending} data-testid={`button-sync-${service}`}>{c.sync}</Button>}
            {connected && s.property && !changing && <Button variant="secondary" disabled={off} onClick={() => setChanging(true)} data-testid={`button-change-${service}`}>{c.changeProp}</Button>}
            {(connected || s.status === 'reconnect_required') && (
              <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={fmt(t, c.discTitle, { service: name })} body={c.discBody} confirmLabel={c.discConfirm} destructive onConfirm={doDisc}
                trigger={<Button variant="secondary" className="w-full text-danger sm:ml-auto sm:w-auto" disabled={off} loading={disc.isPending} data-testid={`button-disconnect-${service}`}>{c.disconnect}</Button>} />
            )}
          </div>
          {connected && s.property && <ReportViewer projectId={projectId} service={service} c={c} />}
        </>
      )}
    </Panel>
  );
}

export function ConnectionsPanel({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const { d, locale, setLocale } = useI18n();
  const c = connectionsCopy[locale];
  const { projectHref } = useProjects();
  const [mismatch, setMismatch] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  // OAuth return: restore locale always; clear the saved state only once the matching project is active.
  useEffect(() => {
    const p = readOAuth();
    const flag = new URLSearchParams(window.location.search).get('google_connection');
    if (!p) { if (flag === 'cancelled') setCancelled(true); return undefined; }
    if (p.locale !== locale) {
      // ProjectProvider also normalises ?project= on mount. Navigate after that
      // effect, otherwise its stale EN route can overwrite the FI return.
      const timer = window.setTimeout(() => setLocale(p.locale as 'fi' | 'en'), 0);
      return () => window.clearTimeout(timer);
    }
    if (p.projectId !== projectId) { setMismatch(true); return undefined; }
    setMismatch(false);
    if (flag === 'cancelled') setCancelled(true);
    clearOAuth();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, locale]);
  return (
    <div className="flex flex-col gap-4" data-testid="panel-connections">
      <div>
        <h2 className="text-[18px] font-semibold leading-[26px] text-ink">{c.title}</h2>
        <p className="text-[13px] text-muted-ink">{c.intro}</p>
        <Link href={projectHref('/dashboard/traffic')} className="mt-2 inline-flex items-center gap-1 rounded text-[13px] font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan" data-testid="link-view-traffic">{locale === 'fi' ? 'Katso tuodut tiedot Liikenne-näkymässä' : 'View imported data in Traffic'}<ArrowRight aria-hidden className="size-3.5" /></Link>
      </div>
      {readOnly && <p role="status" className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-muted-ink">{c.archived}</p>}
      {mismatch && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2.5 text-[13px] text-warning"><p className="mr-auto">{c.mismatch}</p><Button size="sm" variant="ghost" onClick={() => { clearOAuth(); setMismatch(false); }}>{d.auth.cancel}</Button></div>}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Card key={`ga4${projectId}`} projectId={projectId} service="ga4" readOnly={readOnly} notice={cancelled} />
        <Card key={`gsc${projectId}`} projectId={projectId} service="gsc" readOnly={readOnly} notice={cancelled} />
      </div>
    </div>
  );
}
