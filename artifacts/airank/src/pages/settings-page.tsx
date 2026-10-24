import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, History, RotateCcw } from 'lucide-react';
import {
  getListProjectVersionsQueryKey,
  useArchiveProject,
  useListProjectVersions,
  useUpdateProject,
  type Project,
  type ProjectInput,
} from '@workspace/api-client-react';
import { useDocumentTitle, useI18n, isLocale } from '@/i18n';
import { useAccount } from '@/lib/account';
import { useProjects } from '@/lib/project-context';
import { readApiError, writeErrorMessage } from '@/lib/api-errors';
import { mapServerFieldErrors, normLanguage, normMarket, normaliseInput, sameInput, validateProject, type ProjectErrors } from '@/lib/project-validate';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, Panel, DisabledAction, StatusBadge, LoadingBlock, ErrorState, EmptyState } from '@/components/airank/primitives';
import { SelectField, ConfirmDialog } from '@/components/airank/forms';
import { useQueryParam } from '@/lib/use-query-param';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { ProjectFields } from '@/components/airank/project-form';
import { MeasurementContextFields, ProviderContextNotice } from '@/components/airank/context-select';
import { useContextLabels } from '@/lib/measurement-context';
import { Button } from '@/components/ui/button';
import { MeasurementSettingsPanel } from '@/components/airank/measurement-settings';
import { invalidateSchedules } from '@/lib/use-industries';
import { ConnectionsPanel } from '@/components/airank/connections';
import { connectionsCopy } from '@/lib/connections-copy';
import { ScheduleSettings } from '@/components/airank/schedule-settings';

const toInput = (p: Project): ProjectInput => {
  const category = p.categoryFi || p.category || '';
  return { brandName: p.brandName, aliases: [...p.aliases], ownedDomains: p.ownedDomains.length ? [...p.ownedDomains] : [''], categoryFi: category, category, market: normMarket(p.market), promptLanguage: normLanguage(p.promptLanguage) };
};

function useReplaceProjectInCache() {
  const qc = useQueryClient();
  const { listKey } = useProjects();
  return (p: Project) => {
    qc.setQueryData(listKey, (old: Project[] | undefined) => (old ? old.map((x) => (x.id === p.id ? p : x)) : old));
    void qc.invalidateQueries({ queryKey: getListProjectVersionsQueryKey(p.id) });
    invalidateSchedules(qc);
  };
}

function IdentityMeta({ project }: { project: Project }) {
  const { d, t, date } = useI18n();
  const labels = useContextLabels();
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-[12px] border border-line bg-canvas p-4 text-[13px] md:grid-cols-4">
      <div><dt className="text-[11px] text-muted-ink">{d.auth.market}</dt><dd className="font-medium text-ink" data-testid="text-project-market">{labels.market(project.market)}</dd></div>
      <div><dt className="text-[11px] text-muted-ink">{d.auth.promptLanguage}</dt><dd className="font-medium text-ink" data-testid="text-project-language">{labels.language(project.promptLanguage)}</dd></div>
      <div><dt className="text-[11px] text-muted-ink">{d.tabs.versions}</dt><dd className="font-medium text-ink" data-testid="text-project-version">{t(d.auth.version, { version: project.version })}</dd></div>
      <div><dt className="text-[11px] text-muted-ink">{d.auth.createdAt}</dt><dd className="font-medium text-ink">{date(project.createdAt, { dateStyle: 'medium' })}</dd></div>
    </dl>
  );
}

function ProjectTab({ project }: { project: Project }) {
  const { d, t, plural } = useI18n();
  const { toast } = useToast();
  const { writeRequest } = useAccount();
  const { refetch } = useProjects();
  const replace = useReplaceProjectInCache();
  const update = useUpdateProject({ request: writeRequest, mutation: { retry: false } });
  const archive = useArchiveProject({ request: writeRequest, mutation: { retry: false } });
  const readOnly = project.status === 'archived';

  const [draft, setDraft] = useState<ProjectInput>(() => toInput(project));
  const [base, setBase] = useState<Project>(project);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProjectErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const initFor = useRef(project.id);

  const dirty = !sameInput(draft, toInput(base));

  // Re-init on project switch; on a newer server version adopt it only if there are no local edits.
  useEffect(() => {
    if (initFor.current !== project.id) {
      initFor.current = project.id;
      setDraft(toInput(project)); setBase(project); setSubmitted(false); setServerErrors({}); setMessage(null); setConflict(false);
      return;
    }
    if (project.version !== base.version || project.status !== base.status) {
      if (!dirty) { setDraft(toInput(project)); setBase(project); }
      else setConflict(true);
    }
  }, [project, base.version, base.status, dirty]);

  const local = submitted ? validateProject(draft, d, t) : {};
  const errors = { ...serverErrors, ...local };
  const localCount = Object.keys(local).length;

  const reloadLatest = () => {
    setDraft(toInput(project)); setBase(project); setConflict(false); setMessage(null); setServerErrors({}); setSubmitted(false);
    refetch();
  };

  const save = () => {
    setSubmitted(true);
    if (update.isPending || !dirty || conflict) return;
    if (Object.keys(validateProject(draft, d, t)).length) return;
    setServerErrors({}); setMessage(null);
    update.mutate(
      { projectId: project.id, data: { ...normaliseInput(draft), expectedVersion: base.version } },
      {
        onSuccess: (p) => {
          replace(p); setBase(p); setDraft(toInput(p)); setSubmitted(false);
          toast({ title: t(d.auth.saved, { version: p.version }) });
        },
        onError: (err) => {
          const e = readApiError(err);
          if (e.status === 409 || e.code === 'VERSION_CONFLICT') { setConflict(true); refetch(); return; }
          setServerErrors(mapServerFieldErrors(e.fieldErrors, d));
          setMessage(writeErrorMessage(err, d));
        },
      },
    );
  };

  const doArchive = () => {
    archive.mutate(
      { projectId: project.id, data: { expectedVersion: base.version } },
      {
        onSuccess: (p) => { replace(p); setBase(p); setDraft(toInput(p)); toast({ title: d.auth.archived }); },
        onError: (err) => {
          const e = readApiError(err);
          if (e.status === 409) { setConflict(true); refetch(); return; }
          setMessage(writeErrorMessage(err, d));
        },
      },
    );
  };

  const saveAction = readOnly ? null : conflict ? (
    <DisabledAction reason={d.auth.conflictBody} className="min-w-[172px]" data-testid="button-save-settings">{d.auth.saveChanges}</DisabledAction>
  ) : !dirty ? (
    <DisabledAction reason={d.auth.noChanges} className="min-w-[172px]" data-testid="button-save-settings">{d.auth.saveChanges}</DisabledAction>
  ) : (
    <Button onClick={save} loading={update.isPending} className="min-w-[172px]" data-testid="button-save-settings">{update.isPending ? d.auth.saving : d.auth.saveChanges}</Button>
  );

  return (
    <SettingsChrome actions={saveAction} subtitle={project.brandName}>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,714fr)_minmax(0,410fr)]">
        <section className="flex flex-col gap-4 rounded-[12px] border border-line bg-white p-5 md:p-6" aria-labelledby="business-details">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="business-details" className="mr-auto text-[18px] font-semibold leading-[26px] text-ink">{d.auth.businessDetails}</h2>
            {dirty && !readOnly && <StatusBadge tone="warning">{d.auth.unsaved}</StatusBadge>}
            <StatusBadge tone={readOnly ? 'neutral' : 'success'} data-testid="status-project">{readOnly ? d.auth.archivedBadge : d.auth.activeBadge}</StatusBadge>
          </div>
          {readOnly && <p role="status" className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-muted-ink" data-testid="text-archived-note">{d.auth.archivedNote}</p>}
          {conflict && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-bg p-4 text-[13px] text-warning" data-testid="state-conflict">
              <p className="font-semibold">{d.auth.conflictTitle}</p>
              <p>{d.auth.conflictBody}</p>
              <Button variant="secondary" size="sm" className="self-start" onClick={reloadLatest} data-testid="button-reload-latest"><RotateCcw aria-hidden /> {d.auth.reload}</Button>
            </div>
          )}
          <ProjectFields stacked draft={draft} setDraft={setDraft} errors={errors} disabled={readOnly || update.isPending} />
          <div className="h-px w-full bg-line" />
          <MeasurementContextFields
            market={normMarket(draft.market)}
            language={normLanguage(draft.promptLanguage)}
            disabled={readOnly || update.isPending}
            errors={{ market: errors.market, promptLanguage: errors.promptLanguage }}
            changed={normMarket(draft.market) !== normMarket(base.market) || normLanguage(draft.promptLanguage) !== normLanguage(base.promptLanguage)}
            onChange={(ctx) => setDraft({ ...draft, ...ctx })}
          />
          <p className="text-[12px] leading-[17px] text-muted-ink">{d.auth.marketLocked} {d.auth.localeNote}</p>
          <ProviderContextNotice />
          {localCount > 0 && <p role="alert" className="text-[13px] font-medium text-danger">{plural(d.validation.summary, localCount)}</p>}
          {message && <p role="alert" className="text-[13px] font-medium text-danger" data-testid="text-save-error">{message}</p>}
          <IdentityMeta project={base} />
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button variant="ghost" disabled={!dirty || update.isPending} onClick={() => { setDraft(toInput(base)); setSubmitted(false); setServerErrors({}); setMessage(null); }} data-testid="button-reset">{d.auth.cancel}</Button>
              <div className="flex-1" />
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={d.auth.archiveTitle}
                body={d.auth.archiveBody}
                confirmLabel={d.auth.archiveConfirm}
                destructive
                onConfirm={doArchive}
                trigger={
                  <Button variant="secondary" className="text-danger" loading={archive.isPending} disabled={dirty || conflict} data-testid="button-archive-project">
                    {!archive.isPending && <Archive aria-hidden />} {d.auth.archive}
                  </Button>
                }
              />
            </div>
          )}
        </section>
        <LanguageAccessCard />
      </div>
    </SettingsChrome>
  );
}

function VersionsTab({ project }: { project: Project }) {
  const { d, t, date } = useI18n();
  const q = useListProjectVersions(project.id, { query: { queryKey: getListProjectVersionsQueryKey(project.id), enabled: !!project.id, staleTime: 30_000 } });
  const rows = useMemo(() => [...(q.data ?? [])].sort((a, b) => b.version - a.version), [q.data]);
  return (
    <Panel className="flex flex-col gap-4 p-5 md:p-6">
      <div>
        <h2 className="text-[16px] font-semibold text-ink">{d.auth.versions}</h2>
        <p className="text-[12px] text-muted-ink">{d.auth.versionsBody}</p>
      </div>
      {q.isPending ? <LoadingBlock rows={3} /> : q.isError ? <ErrorState onRetry={() => void q.refetch()} retrying={q.isFetching} /> : !rows.length ? (
        <EmptyState compact icon={<History className="size-[18px]" aria-hidden />} title={d.auth.noVersions} />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((v) => (
            <li key={v.version} className="rounded-[12px] border border-line p-4" data-testid={`row-version-${v.version}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{t(d.auth.version, { version: v.version })}</span>
                {v.version === project.version && <StatusBadge tone="info" dot={false}>{d.auth.current}</StatusBadge>}
                <span className="text-[12px] text-muted-ink">{date(v.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-[13px] md:grid-cols-2">
                <div><dt className="text-[11px] text-muted-ink">{d.settings.brandName}</dt><dd className="font-medium text-ink">{v.brandName}</dd></div>
                <div><dt className="text-[11px] text-muted-ink">{d.auth.domains}</dt><dd className="break-all font-medium text-ink">{v.ownedDomains.join(', ')}</dd></div>
                <div className="md:col-span-2"><dt className="text-[11px] text-muted-ink">{d.settings.category}</dt><dd className="font-medium text-ink" lang={normLanguage(v.promptLanguage)}>{v.categoryFi || v.category}</dd></div>
                {v.aliases.length > 0 && <div className="md:col-span-2"><dt className="text-[11px] text-muted-ink">{d.settings.aliases}</dt><dd className="font-medium text-ink">{v.aliases.join(', ')}</dd></div>}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function timezones(current: string) {
  let list: string[] = ['Europe/Helsinki', 'UTC'];
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) list = fn('timeZone');
  } catch { /* older browser */ }
  if (!list.includes(current)) list = [current, ...list];
  return list.map((z) => ({ value: z, label: z }));
}

function LanguageAccessCard() {
  const { projectHref } = useProjects();
  const { d, locale, setLocale } = useI18n();
  const { toast } = useToast();
  const { user, prefs, prefsPending, savePrefs } = useAccount();
  const [tz, setTz] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tzValue = tz ?? prefs?.timezone ?? 'Europe/Helsinki';
  const options = useMemo(() => timezones(tzValue), [tzValue]);

  const persist = async (changes: { timezone?: string; locale?: 'fi' | 'en' }) => {
    setBusy(true); setMessage(null);
    try {
      await savePrefs(changes);
      toast({ title: d.auth.preferencesSaved });
      if (changes.timezone) setTz(null);
    } catch (err) {
      setMessage(readApiError(err).status === 409 ? d.auth.prefsConflict : changes.locale ? d.auth.localeFailed : writeErrorMessage(err, d));
    } finally { setBusy(false); }
  };

  return (
    <section className="flex flex-col gap-5 rounded-[12px] border border-line bg-white p-5 md:p-6" aria-labelledby="language-access">
      <h2 id="language-access" className="text-[18px] font-semibold leading-[26px] text-ink">{d.auth.languageAccess}</h2>
      {prefsPending ? <LoadingBlock rows={3} /> : (
        <>
          <SelectField label={d.auth.language} value={locale} disabled={busy} testId="select-locale" options={locale === 'fi' ? [{ value: 'fi', label: 'Suomi' }, { value: 'en', label: 'English' }] : [{ value: 'en', label: 'English' }, { value: 'fi', label: 'Suomi' }]} onChange={(v) => { if (isLocale(v) && v !== locale) { setLocale(v); void persist({ locale: v }); } }} />
          <p className="-mt-2 text-sm text-muted-ink">{d.auth.localeNote}</p>
          <div className="flex flex-col gap-2">
            <SelectField label={d.auth.timezone} value={tzValue} disabled={busy} testId="select-timezone" options={options} onChange={setTz} />
            <p className="text-[12px] leading-[17px] text-muted-ink">{d.auth.timezoneHint}</p>
            {tz && tz !== prefs?.timezone && (
              <Button variant="secondary" size="sm" className="self-start" onClick={() => void persist({ timezone: tz })} loading={busy} data-testid="button-save-preferences">{d.common.save}</Button>
            )}
          </div>
          {busy && <p role="status" className="sr-only">{d.auth.prefsSaving}</p>}
          {message && <p role="alert" className="text-[13px] font-medium text-danger" data-testid="text-prefs-error">{message}</p>}
        </>
      )}
      <div className="h-px w-full bg-line" />
      <StatusBadge tone="success" className="self-start">{d.auth.freeAccess}</StatusBadge>
      <p className="text-sm text-ink">{d.auth.freeAccessBody}</p>
      <div className="h-px w-full bg-line" />
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-muted-ink">{d.auth.owner}</p>
        <p className="truncate text-sm font-medium text-ink" data-testid="text-account-name">{user?.name || user?.email}</p>
        {user?.name && <p className="truncate text-[12px] text-muted-ink" data-testid="text-account-email">{user.email}</p>}
      </div>
      <Button asChild variant="secondary" className="w-full sm:w-[240px]" data-testid="button-export-project"><Link href={projectHref('/dashboard/reports')}>{d.auth.exportData}</Link></Button>
    </section>
  );
}

const SETTINGS_TABS = ['project', 'tracking', 'connections', 'versions'] as const;

/** Figma 16:3407 header + pill tabs; each tab supplies its own header action (Save changes on Project). */
function SettingsChrome({ actions, children }: { actions?: ReactNode; subtitle?: string; children: ReactNode }) {
  const { d, locale } = useI18n();
  const [raw, setTab] = useQueryParam('tab', 'project');
  const tab = (SETTINGS_TABS as readonly string[]).includes(raw) ? raw : 'project';
  const labels: Record<string, string> = { project: d.tabs.project, tracking: d.auth.tabTracking, connections: connectionsCopy[locale].tab, versions: d.auth.versions };
  return (
    <>
      <PageHeader title={d.features.settings.title} subtitle={d.auth.settingsSubtitle} actions={actions ?? undefined} />
      <div role="tablist" aria-label={d.tabs.sectionTabs} className="-mx-1 flex flex-wrap gap-2 px-1">
        {SETTINGS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'h-10 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan',
              tab === t ? 'bg-tint text-ink' : 'border border-line bg-white text-ink hover:bg-canvas',
            )}
            data-testid={`tab-${t}`}
          >
            {labels[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children}</div>
    </>
  );
}

export function SettingsPage() {
  const { d } = useI18n();
  useDocumentTitle(d.features.settings.title);
  const { project, pending, error, refetch } = useProjects();
  const [raw] = useQueryParam('tab', 'project');
  if (raw === 'tracking')
    return <SettingsChrome>{pending ? <Panel className="p-6"><LoadingBlock rows={5} /></Panel> : project ? <div className="flex flex-col gap-4"><MeasurementSettingsPanel key={`m${project.id}`} projectId={project.id} readOnly={project.status === 'archived'} /><ScheduleSettings key={project.id} projectId={project.id} readOnly={project.status === 'archived'} /></div> : <Panel><EmptyState title={d.auth.noActive} body={d.auth.noActiveBody} /></Panel>}</SettingsChrome>;
  if (pending) return <SettingsChrome><Panel className="p-6"><LoadingBlock rows={5} /></Panel></SettingsChrome>;
  if (error) return <SettingsChrome><Panel><ErrorState body={d.auth.loadFailed} onRetry={refetch} /></Panel></SettingsChrome>;
  if (!project) return <SettingsChrome><Panel><EmptyState title={d.auth.noActive} body={d.auth.noActiveBody} /></Panel></SettingsChrome>;
  if (raw === 'connections') return <SettingsChrome><ConnectionsPanel key={project.id} projectId={project.id} readOnly={project.status === 'archived'} /></SettingsChrome>;
  if (raw === 'versions') return <SettingsChrome><VersionsTab project={project} /></SettingsChrome>;
  return <ProjectTab key={project.id} project={project} />;
}
