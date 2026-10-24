import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateMonitoringRun } from '@workspace/api-client-react';
import { useAccount } from '@/lib/account';
import { CalendarClock, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';
import { readApiError, writeErrorMessage } from '@/lib/api-errors';
import { useSchedule, useScheduleWrite } from '@/lib/use-industries';
import { DAILY_TIMEZONE, dailyTime, pauseResumeInput, promptCountText, scheduleStatus, scheduleStatusInfo, type DailySchedule } from '@/lib/daily-tracking';
import { useProjectsOptional } from '@/lib/project-context';
import { EmptyState, ErrorState, LoadingBlock, Panel, StatusBadge } from './primitives';
import { useL } from './analytics';

const runLabel: Record<string, [string, string]> = { completed: ['Valmis', 'Completed'], succeeded: ['Valmis', 'Completed'], partial: ['Osittainen', 'Partial'], failed: ['Epäonnistui', 'Failed'], running: ['Käynnissä', 'Running'], pending: ['Odottaa', 'Pending'], skipped: ['Ohitettu', 'Skipped'] };

const slotLabel: Record<string, [string, string]> = { pending: ['Odottaa', 'Pending'], submitted: ['Käynnistetty', 'Submitted'], skipped: ['Ohitettu', 'Skipped'], blocked: ['Estetty', 'Blocked'], cancelled: ['Peruttu', 'Cancelled'] };

/** Compact daily-status line for the Prompts page and onboarding. */
function ImmediateCollection({ projectId, schedule, readOnly = false }: { projectId: string; schedule: DailySchedule; readOnly?: boolean }) {
  const L = useL();
  const { d, href } = useI18n();
  const { writeRequest } = useAccount();
  const qc = useQueryClient();
  const { toast } = useToast();
  const collect = useCreateMonitoringRun({ request: writeRequest });
  const state = schedule.immediate?.state;
  if (!schedule.immediate) return null;
  const busy = state === 'pending' || collect.isPending;
  return <div className="flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
    <span>{state === 'pending' ? L('Uusien kysymysten keruu odottaa käsittelyä.', 'Collection of new prompts is queued.')
      : state === 'blocked' ? L('Välitön keruu on estetty.', 'Immediate collection is blocked.')
      : state === 'submitted' ? L('Keruupyyntö on lähetetty. Tarkista eteneminen tuloksista.', 'Collection submitted. Check Results for progress.')
      : L('Uudet kysymykset kerätään automaattisesti. Päivittäinen mittaus jatkuu erikseen.', 'New prompts are collected automatically. Daily monitoring continues separately.')}</span>
    {schedule.immediate?.reason && state === 'blocked' && <code>{schedule.immediate.reason}</code>}
    <Button size="sm" variant="secondary" disabled={readOnly || busy || !schedule.activePromptCount} loading={collect.isPending}
      onClick={() => collect.mutate({ projectId, data: { kind: 'neutral', submissionId: crypto.randomUUID() } }, {
        onSuccess: () => { void qc.invalidateQueries(); toast({ title: L('Keruu jonossa', 'Collection queued') }); },
        onError: e => { void qc.invalidateQueries(); toast({ variant: readApiError(e).code === 'NO_UNMEASURED_PROMPTS' ? 'default' : 'destructive', title: readApiError(e).code === 'NO_UNMEASURED_PROMPTS' ? L('Kaikki nykyiset kysymykset on jo lähetetty keruuseen.', 'All current prompts have already been submitted for collection.') : writeErrorMessage(e, d) }); },
      })}>{L('Kerää uudet kysymykset', 'Collect new prompts')}</Button>
    <Link href={`${href('/dashboard/results')}?project=${encodeURIComponent(projectId)}`} className="text-link hover:underline">{L('Näytä tulokset', 'View results')}</Link>
    <span className="text-xs text-muted-ink">{L('Käyttää nykyisiä maksullisen keruun rajoja. Jo lähetettyjä kysymyksiä ei lähetetä uudelleen.', 'Uses existing paid collection limits. Previously submitted prompts are not resubmitted.')}</span>
  </div>;
}

export function DailyStatusStrip({ projectId, testId = 'strip-daily-status' }: { projectId: string; testId?: string }) {
  const L = useL();
  const { locale, date, href } = useI18n();
  const q = useSchedule(projectId);
  const s = q.data as DailySchedule | undefined;
  if (q.isPending) return <Panel className="p-4" aria-busy="true"><LoadingBlock rows={1} /></Panel>;
  if (!s) return null;
  const st = scheduleStatus(s);
  const info = scheduleStatusInfo(st, locale === 'fi' ? 'fi' : 'en');
  return (
    <Panel className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" data-testid={testId}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-tint text-navy"><CalendarClock className="size-[18px]" aria-hidden /></span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <StatusBadge tone={info.tone} data-testid="status-daily">{info.label}</StatusBadge>
            <span className="tabular" data-testid="text-prompt-count">{promptCountText(s, locale === 'fi' ? 'fi' : 'en')}</span>
          </p>
          <p className="mt-1 text-[12px] leading-[17px] text-muted-ink">{info.body}</p>
          <ImmediateCollection projectId={projectId} schedule={s} readOnly={st === 'archived'} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 text-[12px] text-muted-ink md:items-end">
        <span data-testid="text-daily-next">{L('Seuraava mittaus', 'Next measurement')}: <span className="font-medium text-ink">{s.nextAt ? date(new Date(s.nextAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DAILY_TIMEZONE }) : L('Ei ajastettu', 'Not scheduled')}</span></span>
        <Link href={`${href('/settings')}?project=${encodeURIComponent(projectId)}&tab=tracking`} className="font-medium text-link hover:underline" data-testid="link-daily-settings">{L('Mittausasetukset', 'Measurement settings')}</Link>
      </div>
    </Panel>
  );
}

/** Fixed daily measurement: Europe/Helsinki 04:MM every day. Only pause/resume is user-controlled. */
export function ScheduleSettings({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const L = useL();
  const { d, locale, date, href } = useI18n();
  const { toast } = useToast();
  const ctx = useProjectsOptional();
  const q = useSchedule(projectId);
  const write = useScheduleWrite(projectId);
  const s = q.data as DailySchedule | undefined;

  if (q.isPending) return <Panel className="p-6"><LoadingBlock rows={4} /></Panel>;
  if (q.isError || !s) return <Panel>{q.unavailable ? <EmptyState title={L('Päivittäinen mittaus ei ole vielä käytettävissä tällä palvelimella', 'Daily measurement is not available on this server yet')} body={L('Aiemmat tulokset ovat edelleen saatavilla.', 'Earlier results remain available.')} /> : <ErrorState onRetry={() => void q.refetch()} />}</Panel>;

  const loc = locale === 'fi' ? 'fi' : 'en';
  const st = scheduleStatus(s);
  const info = scheduleStatusInfo(st, loc);
  const fmt = (t: number) => date(new Date(t), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DAILY_TIMEZONE });
  const canResume = s.activationAvailable && !readOnly && st !== 'archived' && st !== 'conflict';
  const toggle = (enabled: boolean) =>
    write.mutate({ projectId, data: pauseResumeInput(s, enabled) }, {
      onSuccess: () => toast({ title: enabled ? L('Päivittäinen mittaus jatkuu', 'Daily measurement resumed') : L('Päivittäinen mittaus keskeytetty', 'Daily measurement paused') }),
      onError: (e) => toast({ variant: 'destructive', title: writeErrorMessage(e, d) }),
    });

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-5 p-5 md:p-6" aria-labelledby="sched-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[620px]">
            <h2 id="sched-h" className="text-[16px] font-semibold text-ink">{L('Päivittäinen mittaus', 'Daily measurement')}</h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-ink">{L('Yksi ei-brändätty kysymyslista mitataan automaattisesti joka päivä samaan aikaan. Aikaa ei voi muuttaa.', 'One non-branded prompt list is measured automatically every day at the same time. The time is fixed.')}</p>
          </div>
          <StatusBadge tone={info.tone} data-testid="status-schedule">{info.label}</StatusBadge>
        </div>
        <dl className="grid grid-cols-1 gap-3 rounded-xl bg-canvas p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-[11px] text-muted-ink">{L('Aika', 'Time')}</dt><dd className="tabular font-medium text-ink" data-testid="text-daily-time">{L('Päivittäin', 'Daily')} {dailyTime(s)} <span className="text-muted-ink">(Helsinki)</span></dd></div>
          <div><dt className="text-[11px] text-muted-ink">{L('Kysymykset', 'Prompts')}</dt><dd className="tabular font-medium text-ink" data-testid="text-schedule-count">{promptCountText(s, loc)}</dd></div>
          <div><dt className="text-[11px] text-muted-ink">{L('Seuraava mittaus', 'Next measurement')}</dt><dd className="font-medium text-ink" data-testid="text-next-run">{s.nextAt ? fmt(s.nextAt) : L('Ei ajastettu', 'Not scheduled')}</dd></div>
          <div><dt className="text-[11px] text-muted-ink">{L('Edellinen mittaus', 'Last measurement')}</dt><dd className="font-medium text-ink" data-testid="text-last-run">{s.lastRunAt ? `${fmt(s.lastRunAt)}${s.lastRunStatus ? ` · ${L(...(runLabel[s.lastRunStatus] ?? [s.lastRunStatus, s.lastRunStatus]))}` : ''}` : L('Ei vielä', 'Not yet')}</dd></div>
        </dl>
        <p className="text-[13px] leading-[19px] text-ink" data-testid="text-schedule-reason">{info.body}</p>
        <ImmediateCollection projectId={projectId} schedule={s} readOnly={readOnly} />
        {(st === 'over_limit' || st === 'prompt_review_required' || st === 'empty') && (
          <Link href={`${href('/dashboard/prompts')}?project=${encodeURIComponent(projectId)}`} className="self-start text-[13px] font-medium text-link hover:underline" data-testid="link-schedule-prompts">{L('Hallitse kysymyksiä', 'Manage prompts')}</Link>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {s.enabled ? (
            <Button variant="secondary" disabled={readOnly} loading={write.isPending} onClick={() => toggle(false)} data-testid="button-schedule-pause"><Pause aria-hidden />{L('Keskeytä mittaus', 'Pause measurement')}</Button>
          ) : (
            <Button disabled={!canResume} loading={write.isPending} onClick={() => toggle(true)} data-testid="button-schedule-resume"><Play aria-hidden />{L('Jatka mittausta', 'Resume measurement')}</Button>
          )}
          <span className="text-[12px] text-muted-ink">{L('Jokainen mittaus käyttää maksullisia mallikutsuja.', 'Every measurement uses paid model calls.')}</span>
          <span className="tabular ml-auto text-[11px] text-muted-ink">v{s.version}</span>
        </div>
      </Panel>
      {s.slots.length > 0 && (
        <Panel className="p-5" aria-labelledby="slots-h">
          <h2 id="slots-h" className="mb-3 text-[16px] font-semibold text-ink">{L('Viimeisimmät mittaukset', 'Recent measurements')}</h2>
          <ul className="divide-y divide-line" data-testid="list-schedule-slots">
            {s.slots.map((x) => (
              <li key={x.slot} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="text-ink">{fmt(x.dueAt)}</span>
                <span className="flex items-center gap-2">{x.reason && <span className="text-[12px] text-muted-ink">{x.reason === 'missed_window' ? L('Ikkuna ohitettu', 'Missed window') : x.reason === 'paused' ? L('Keskeytetty', 'Paused') : x.reason}</span>}<StatusBadge tone={x.state === 'submitted' ? 'success' : x.state === 'pending' ? 'info' : x.state === 'blocked' ? 'warning' : 'neutral'}>{L(...(slotLabel[x.state] ?? [x.state, x.state]))}</StatusBadge></span>
              </li>))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
