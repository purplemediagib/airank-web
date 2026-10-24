import type { ProjectSchedule } from '@workspace/api-client-react';
import { readApiError } from './api-errors';

/** Fixed daily-measurement configuration. The server owns the per-user minute. */
export const DAILY_TIMEZONE = 'Europe/Helsinki';
export const DAILY_HOUR = 4;
export const DAILY_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export type Loc = 'fi' | 'en';
export type ScheduleStatus = 'scheduled' | 'paused' | 'unavailable' | 'empty' | 'conflict' | 'limit_unconfigured' | 'over_limit' | 'prompt_review_required' | 'archived';
export type DailyTone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

export type DailySchedule = ProjectSchedule;

const STATUS: Record<ScheduleStatus, { tone: DailyTone; fi: [string, string]; en: [string, string] }> = {
  scheduled: { tone: 'success', fi: ['Päivittäinen mittaus ajastettu', 'Kysymyslista mitataan automaattisesti kerran päivässä.'], en: ['Daily measurement scheduled', 'Your prompt list is measured automatically once a day.'] },
  paused: { tone: 'neutral', fi: ['Keskeytetty', 'Päivittäinen mittaus on keskeytetty. Voit jatkaa milloin tahansa.'], en: ['Paused', 'Daily measurement is paused. You can resume at any time.'] },
  unavailable: { tone: 'warning', fi: ['Ei käytettävissä', 'Automaattista mittausta ei ole otettu käyttöön tällä palvelimella.'], en: ['Unavailable', 'Automatic measurement is not enabled on this server.'] },
  empty: { tone: 'info', fi: ['Ei kysymyksiä', 'Lisää vähintään yksi ei-brändätty kysymys, niin päivittäinen mittaus alkaa.'], en: ['No prompts yet', 'Add at least one non-branded prompt and daily measurement starts.'] },
  conflict: { tone: 'error', fi: ['Palvelinpäivitys tarvitaan', 'Palvelin on päivitettävä tukemaan useita työtiloja. Älä poista olemassa olevia projekteja.'], en: ['Server update required', 'The server needs an update to support multiple workspaces. Do not delete existing projects.'] },
  limit_unconfigured: { tone: 'warning', fi: ['Kysymysraja puuttuu', 'Kysymysten enimmäismäärää ei ole määritetty palvelimella, joten mittausta ei ajeta.'], en: ['Prompt limit not configured', 'The server has no prompt limit configured, so nothing is measured.'] },
  over_limit: { tone: 'warning', fi: ['Kysymysraja ylittyy', 'Aktiivisia kysymyksiä on enemmän kuin raja sallii. Arkistoi kysymyksiä jatkaaksesi.'], en: ['Over the prompt limit', 'There are more active prompts than the limit allows. Archive prompts to continue.'] },
  prompt_review_required: { tone: 'warning', fi: ['Kysymykset vaativat tarkistuksen', 'Diagnostiset tai eri kontekstin kysymykset on tarkistettava tai arkistoitava ennen mittausta.'], en: ['Prompts need review', 'Diagnostic or context-mismatched prompts must be reviewed or archived before measuring.'] },
  archived: { tone: 'neutral', fi: ['Arkistoitu', 'Arkistoitua projektia ei mitata. Aiemmat tulokset säilyvät.'], en: ['Archived', 'Archived projects are not measured. Earlier results are kept.'] },
};

export function scheduleStatus(s: DailySchedule): ScheduleStatus {
  const st = s.status as ScheduleStatus | undefined;
  if (st && st in STATUS) return st;
  if (!s.activationAvailable) return 'unavailable';
  return s.enabled ? 'scheduled' : 'paused';
}

export function scheduleStatusInfo(status: ScheduleStatus, loc: Loc) {
  const x = STATUS[status];
  return { tone: x.tone, label: x[loc][0], body: x[loc][1] };
}

/** "04:MM" Helsinki wall-clock time; minute is stable per user. */
export function dailyTime(s: DailySchedule) {
  const m = typeof s.minute === 'number' && s.minute >= 0 && s.minute <= 59 ? s.minute : 0;
  return `${String(DAILY_HOUR).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function promptCountText(s: DailySchedule, loc: Loc) {
  const n = s.activePromptCount ?? 0;
  if (s.promptLimit == null) return loc === 'fi' ? `${n} aktiivista kysymystä` : `${n} active prompts`;
  return loc === 'fi' ? `${n} / ${s.promptLimit} kysymystä` : `${n} / ${s.promptLimit} prompts`;
}

export function atPromptLimit(s: DailySchedule | undefined) {
  return !!s && s.promptLimit != null && (s.activePromptCount ?? 0) >= s.promptLimit;
}

/** Pause/resume always resends the fixed daily configuration. */
export function pauseResumeInput(s: ProjectSchedule, enabled: boolean) {
  return { expectedVersion: s.version, enabled, timezone: DAILY_TIMEZONE, hour: DAILY_HOUR, weekdays: DAILY_WEEKDAYS };
}

const ERR: Record<string, Record<Loc, string>> = {
  PROMPT_LIMIT_REACHED: { fi: 'Kysymysraja on täynnä. Arkistoi kysymys ennen uuden lisäämistä tai palauttamista.', en: 'The prompt limit is reached. Archive a prompt before adding or restoring another.' },
  PROMPT_LIMIT_NOT_CONFIGURED: { fi: 'Kysymysrajaa ei ole määritetty palvelimella. Kysymyksiä ei voi lisätä juuri nyt.', en: 'The prompt limit is not configured on the server. Prompts cannot be added right now.' },
  PROMPT_SET_CONFLICT: { fi: 'Palvelin on päivitettävä tukemaan useita työtiloja. Olemassa olevat projektit säilyvät.', en: 'The server needs an update to support multiple workspaces. Existing projects are preserved.' },
  ACTIVE_PROMPT_SET_EXISTS: { fi: 'Palvelin on päivitettävä tukemaan useita työtiloja. Olemassa olevat projektit säilyvät.', en: 'The server needs an update to support multiple workspaces. Existing projects are preserved.' },
  DAILY_TRACKING_ONLY: { fi: 'Erilliset tarkistukset on korvattu päivittäisellä mittauksella.', en: 'Separate checks have been replaced by daily measurement.' },
};

/** Readable message for daily-tracking error codes, or null when the code is not one of them. */
export function trackingErrorMessage(err: unknown, loc: Loc): string | null {
  const { code } = readApiError(err);
  return code && ERR[code] ? ERR[code][loc] : null;
}
