import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { MonitoringEvidence, MonitoringRun, Project, TrackedPrompt, TrackedPromptInputKind } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';
import { ProviderMark } from './provider-brand';
import { readApiError, writeErrorMessage } from '@/lib/api-errors';
import { PENDING_RUN, promptsCopy, toDate, type PromptsCopy } from '@/lib/prompts-copy';
import { usePromptWrites, useRun, useRuns } from '@/lib/use-prompts';
import { useQueryParam } from '@/lib/use-query-param';
import { cn } from '@/lib/utils';
import { TextField } from './forms';
import { projectContext, useContextLabels } from '@/lib/measurement-context';
import { EmptyState, ErrorState, LoadingBlock, Panel, ReasonNote, StatusBadge, type Tone } from './primitives';

export function usePC() {
  const { locale } = useI18n();
  return promptsCopy(locale);
}

export function KindBadge({ kind }: { kind: string }) {
  const c = usePC();
  const diag = kind === 'diagnostic';
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] font-medium', diag ? 'bg-warning-bg text-warning ar-hatch' : 'bg-tint text-link')}
      data-testid={`badge-kind-${kind}`}
    >
      {diag ? c.kind.diagnostic : c.kind.neutral}
    </span>
  );
}

export function runTone(status: string): Tone {
  if (status === 'complete' || status === 'success') return 'success';
  if (status === 'budget_blocked' || status === 'timeout_unknown' || status === 'interrupted_unknown' || status === 'deadline_not_started' || status === 'unconfigured') return 'warning';
  if (status === 'provider_failed') return 'error';
  if (status === 'partial' || status === 'capacity_blocked') return 'warning';
  if (status === 'failed' || status === 'unavailable') return 'error';
  if (PENDING_RUN.has(status)) return 'info';
  return 'neutral';
}

export function RunStatus({ status }: { status: string }) {
  const c = usePC();
  return <StatusBadge tone={runTone(status)} data-testid={`status-run-${status}`}>{c.mon.states[status] ?? c.filters.outcomes[status] ?? status}</StatusBadge>;
}

export function RunStatusText({ status }: { status: string }) {
  const c = usePC();
  return <>{c.mon.states[status] ?? c.filters.outcomes[status] ?? status}</>;
}

/* ---------- Create / edit dialog: exact contract {text, topic, tags, kind} (+status, expectedVersion on edit) ---------- */
export function PromptDialog({ open, onOpenChange, project, prompt }: { open: boolean; onOpenChange: (v: boolean) => void; project: Project; prompt?: TrackedPrompt }) {
  const c = usePC();
  const labels = useContextLabels();
  const { d } = useI18n();
  const { toast } = useToast();
  const { locale } = useI18n();
  const { create, update } = usePromptWrites(project.id);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState('');
  const [kind, setKind] = useState<TrackedPromptInputKind>('neutral');
  const [errors, setErrors] = useState<{ text?: string; topic?: string; tags?: string; form?: string }>({});

  useEffect(() => {
    if (!open) return;
    setText(prompt?.text ?? '');
    setTopic(prompt?.topic ?? '');
    setTags(prompt?.tags.join(', ') ?? '');
    setKind(prompt?.kind ?? 'neutral');
    setErrors({});
  }, [open, prompt]);

  const pending = create.isPending || update.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tagList = Array.from(new Set(tags.split(',').map((s) => s.trim()).filter(Boolean)));
    const t = text.trim();
    const errs: typeof errors = {};
    if (t.length < 8 || t.length > 1000) errs.text = c.form.errText;
    if (topic.trim().length > 80) errs.topic = c.form.errTopic;
    if (tagList.length > 12) errs.tags = c.form.errTags;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const data = { text: t, topic: topic.trim(), tags: tagList, kind };
    const onError = (err: unknown) => {
      const { code, fieldErrors } = readApiError(err);
      if (code === 'DUPLICATE_PROMPT') return setErrors({ text: c.form.errDuplicate });
      if (code === 'VERSION_CONFLICT') return setErrors({ form: c.form.errConflict });
      if (code === 'VALIDATION_FAILED') {
        const fe = fieldErrors ?? {};
        if (kind === 'neutral' && (fe.text || !Object.keys(fe).length)) return setErrors({ text: c.form.errBrand });
        return setErrors({ text: fe.text ? c.form.errText : undefined, topic: fe.topic ? c.form.errTopic : undefined, tags: fe.tags ? c.form.errTags : undefined, form: writeErrorMessage(err, d) });
      }
      setErrors({ form: writeErrorMessage(err, d) });
    };
    const onSuccess = () => {
      toast({ title: prompt ? c.saved : c.created });
      onOpenChange(false);
    };
    if (prompt) update.mutate({ projectId: project.id, promptId: prompt.id, data: { ...data, status: prompt.status, expectedVersion: prompt.version } }, { onSuccess, onError });
    else create.mutate({ projectId: project.id, data }, { onSuccess, onError });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-[560px] rounded-[12px] border-line" data-testid="dialog-prompt">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-ink">{prompt ? c.form.editTitle : c.form.createTitle}</DialogTitle>
            <DialogDescription className="text-sm text-muted-ink">{prompt ? c.form.editNote : locale === 'fi' ? 'Ei-brändätyt kysymykset mittaavat löydettävyyttä. Brändätyt kysymykset seurataan erikseen, eikä niitä lasketa löydettävyysnäkyvyyteen.' : 'Non-branded prompts measure discovery. Branded prompts are tracked separately and never count toward discovery visibility.'}</DialogDescription>
            <p className="text-[12px] text-muted-ink" data-testid="text-prompt-save-context">{labels.market(projectContext(project).market)} · {labels.language(projectContext(project).language)}</p>
          </DialogHeader>
          <TextField multiline label={`${c.form.text.replace(/\s*\([^)]*\)\s*$/, '')} (${labels.language(projectContext(project).language)})`} hint={c.form.textHint} value={text} onChange={setText} error={errors.text} lang={projectContext(project).language} testId="input-prompt-text" maxLength={1000} />
          <KindControl value={kind} onChange={setKind} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={c.form.topic} hint={c.form.topicHint} optional value={topic} onChange={setTopic} error={errors.topic} testId="input-prompt-topic" maxLength={80} />
            <TextField label={c.form.tags} hint={c.form.tagsHint} optional value={tags} onChange={setTags} error={errors.tags} testId="input-prompt-tags" />
          </div>
          {errors.form && <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger" data-testid="text-form-error">{errors.form}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending} data-testid="button-prompt-cancel">{c.form.cancel}</Button>
            <Button type="submit" loading={pending} data-testid="button-prompt-save">{prompt ? c.form.save : c.form.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Evidence table (chronological) ---------- */
export function EvidenceTable({ evidence, showText, testId }: { evidence: MonitoringEvidence[]; showText?: boolean; testId: string }) {
  const c = usePC();
  const { date } = useI18n();
  const rows = [...evidence].sort((a, b) => a.observedAt - b.observedAt);
  return (
    <ol className="divide-y divide-line" data-testid={testId}>
      {rows.map((e) => (
        <li key={e.id} className="grid gap-3 px-4 py-4 md:grid-cols-[160px_1fr]" data-testid={`row-evidence-${e.id}`}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] md:grid-cols-1">
            <div><dt className="text-muted-ink">{c.ev.observed}</dt><dd className="tabular font-medium text-ink">{date(toDate(e.observedAt), { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
            <div><dt className="text-muted-ink">{c.ev.provider} / {c.ev.model}</dt><dd className="font-medium text-ink"><ProviderMark provider={e.provider} /> · <span className="font-mono text-[11px]">{e.model}</span></dd></div>
            <div><dt className="text-muted-ink">{c.ev.version}</dt><dd className="tabular font-medium text-ink">v{e.promptVersion}</dd></div>
            <div><dt className="sr-only">{c.ev.status}</dt><dd><RunStatus status={e.status} /></dd></div>
          </dl>
          <div className="min-w-0 space-y-2">
            {showText && <p className="text-[13px] font-semibold text-ink">{e.text}</p>}
            <p className="whitespace-pre-wrap text-[13px] leading-[20px] text-ink">{e.answer || <span className="text-muted-ink">{c.ev.noAnswer}</span>}</p>
            <div>
              <p className="mb-1 text-[12px] text-muted-ink">{c.ev.citations}</p>
              {e.citations.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {e.citations.map((ci, i) => (
                    <li key={`${ci.url}-${i}`}>
                      <a href={ci.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[320px] items-center gap-1 truncate rounded-md border border-line px-2 py-1 text-[12px] text-link hover:bg-tint">
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{ci.title || ci.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[12px] text-muted-ink">{c.ev.noCitations}</p>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Progress({ run, c }: { run: MonitoringRun; c: PromptsCopy }) {
  const { t } = useI18n();
  const pct = run.expected > 0 ? Math.min(1, run.completed / run.expected) : 0;
  return (
    <div className="min-w-[160px]">
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={run.expected} aria-valuenow={run.completed}>
        <div className="h-full origin-left rounded-full bg-cyan transition-transform" style={{ transform: `scaleX(${pct})` }} />
      </div>
      <p className="tabular mt-1 text-[12px] text-muted-ink">{t(c.mon.progressText, { completed: run.completed, expected: run.expected, valid: run.valid })}</p>
    </div>
  );
}

/* ---------- Run detail (?run=) ---------- */
export function RunDetail({ projectId, runId, onClose }: { projectId: string; runId: string; onClose: () => void }) {
  const c = usePC();
  const { date } = useI18n();
  const q = useRun(projectId, runId);
  if (q.isPending) return <Panel className="p-5"><LoadingBlock rows={3} /></Panel>;
  if (q.isError) return <Panel><ErrorState onRetry={() => void q.refetch()} /></Panel>;
  const { run, evidence } = q.data;
  return (
    <Panel className="overflow-hidden ar-rise" aria-labelledby="run-detail-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
        <div>
          <h2 id="run-detail-title" className="text-[16px] font-semibold text-ink">{c.mon.run} <span className="font-mono text-[13px] text-muted-ink">{run.id.slice(0, 8)}</span></h2>
          <div className="mt-2 flex flex-wrap items-center gap-2"><RunStatus status={run.status} /><KindBadge kind={run.kind} /></div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-run"><X aria-hidden />{c.mon.close}</Button>
      </div>
      <div className="grid gap-4 border-b border-line p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-[12px] text-muted-ink">{c.mon.progress}</p><Progress run={run} c={c} /></div>
        <div><p className="text-[12px] text-muted-ink">{c.mon.created}</p><p className="tabular text-ink">{date(toDate(run.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
        <div><p className="text-[12px] text-muted-ink">{c.mon.deadline}</p><p className="tabular text-ink">{date(toDate(run.deadlineAt), { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
        <div><p className="text-[12px] text-muted-ink">{c.mon.methodology}</p><p className="font-mono text-[12px] text-ink">{run.methodology}</p></div>
        <div className="sm:col-span-2 lg:col-span-4">
          <p className="text-[12px] text-muted-ink">{c.mon.routes}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {run.routes.map((r, i) => <li key={i} className="rounded-md bg-canvas px-2 py-1 font-mono text-[11px] text-ink ring-1 ring-line">{r.provider}/{r.model}</li>)}
          </ul>
        </div>
      </div>
      {(run.reason || run.status === 'capacity_blocked') && (
        <div className="border-b border-line p-4"><ReasonNote tone="warning">{run.status === 'capacity_blocked' && `${c.mon.capacity} `}{run.reason && `${c.mon.reason}: ${c.mon.reasons[run.reason] ?? run.reason}`}</ReasonNote></div>
      )}
      {PENDING_RUN.has(run.status) && <p className="px-4 pt-3 text-[12px] text-muted-ink" aria-live="polite">{c.mon.polling}</p>}
      <h3 className="px-4 pt-4 text-sm font-semibold text-ink">{c.mon.evidence}</h3>
      {evidence.length ? <EvidenceTable evidence={evidence} showText testId="list-run-evidence" /> : <EmptyState compact title={c.mon.noEvidence} />}
    </Panel>
  );
}

/** Historical monitoring runs (read-only). New runs are created only by the daily schedule. */
export function MonitoringPanel({ project }: { project: Project; readOnly?: boolean }) {
  const c = usePC();
  const { locale, date } = useI18n();
  const runs = useRuns(project.id);
  const [runId, setRunId] = useQueryParam('run', '');
  const list = runs.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-4" aria-labelledby="mon-title">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[560px]">
            <h2 id="mon-title" className="text-[16px] font-semibold text-ink">{c.mon.title}</h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-ink">{locale === 'fi' ? 'Kysymyslista mitataan automaattisesti kerran päivässä. Alla ovat aiemmat mittaukset; erillisiä ajoja ei käynnistetä käsin.' : 'Your prompt list is measured automatically once a day. Earlier measurements are listed below; runs are not started manually.'}</p>
          </div>
        </div>
      </Panel>

      {runId && <RunDetail projectId={project.id} runId={runId} onClose={() => setRunId('')} />}

      <Panel className="overflow-hidden" aria-labelledby="runs-title">
        <h2 id="runs-title" className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{c.mon.runs}</h2>
        {runs.isPending ? <LoadingBlock rows={3} /> : runs.isError ? <ErrorState onRetry={() => void runs.refetch()} /> : !list.length ? <EmptyState compact title={c.mon.noRuns} body={c.mon.noRunsBody} /> : (
          <ul className="divide-y divide-line" data-testid="list-runs">
            {[...list].sort((a, b) => b.createdAt - a.createdAt).map((r) => (
              <li key={r.id} className={cn('flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', r.id === runId && 'bg-tint/50')} data-testid={`row-run-${r.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <RunStatus status={r.status} /><KindBadge kind={r.kind} />
                  <span className="tabular text-[12px] text-muted-ink">{date(toDate(r.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Progress run={r} c={c} />
                  <Button size="sm" variant="secondary" onClick={() => setRunId(r.id)} aria-label={`${c.mon.view} ${r.id}`} data-testid={`button-view-run-${r.id}`}>{c.mon.view}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

    </div>
  );
}

/** Explicit prompt type: non-branded measures discovery; branded is tracked but kept out of discovery visibility. */
export function KindControl({ value, onChange }: { value: TrackedPromptInputKind; onChange: (k: TrackedPromptInputKind) => void }) {
  const c = usePC();
  return (
    <fieldset data-testid="fieldset-prompt-kind">
      <legend className="mb-1.5 text-[13px] font-medium text-ink">{c.form.kind}</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={c.form.kind}>
        {(['neutral', 'diagnostic'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} data-testid={`radio-kind-${k}`}
            className={cn('rounded-lg border p-3 text-left transition-colors', value === k ? (k === 'neutral' ? 'border-cyan bg-tint' : 'border-warning/40 bg-warning-bg') : 'border-line bg-white hover:border-cyan/60')}>
            <span className={cn('block text-[13px] font-semibold', k === 'neutral' ? 'text-link' : 'text-warning')}>{c.kind[k]}</span>
            <span className="mt-0.5 block text-[12px] leading-[16px] text-muted-ink">{c.kindHelp[k]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
