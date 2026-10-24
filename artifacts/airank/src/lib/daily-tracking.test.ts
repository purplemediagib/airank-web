import { describe, expect, it } from 'vitest';
import { atPromptLimit, dailyTime, pauseResumeInput, promptCountText, scheduleStatus, scheduleStatusInfo, trackingErrorMessage, type DailySchedule } from './daily-tracking';

const base: DailySchedule = { version: 3, enabled: true, timezone: 'Europe/Helsinki', hour: 4, weekdays: [0, 1, 2, 3, 4, 5, 6], nextAt: null, activationAvailable: true, missedPolicy: 'skip', slots: [] };
const apiErr = (status: number, code: string) => ({ status, data: { error: { code } } });

describe('daily tracking helpers', () => {
  it('prefers server status and falls back from enrollment flags', () => {
    expect(scheduleStatus({ ...base, status: 'conflict' })).toBe('conflict');
    expect(scheduleStatus({ ...base, status: 'bogus' })).toBe('scheduled');
    expect(scheduleStatus({ ...base, enabled: false })).toBe('paused');
    expect(scheduleStatus({ ...base, activationAvailable: false })).toBe('unavailable');
  });
  it('formats the stable minute and prompt counts', () => {
    expect(dailyTime({ ...base, minute: 7 })).toBe('04:07');
    expect(dailyTime(base)).toBe('04:00');
    expect(promptCountText({ ...base, activePromptCount: 4, promptLimit: 10 }, 'en')).toBe('4 / 10 prompts');
    expect(promptCountText({ ...base, activePromptCount: 4, promptLimit: null }, 'fi')).toBe('4 aktiivista kysymystä');
    expect(atPromptLimit({ ...base, activePromptCount: 10, promptLimit: 10 })).toBe(true);
    expect(atPromptLimit({ ...base, activePromptCount: 10, promptLimit: null })).toBe(false);
  });
  it('pause/resume sends the fixed daily configuration', () => {
    expect(pauseResumeInput(base, false)).toEqual({ expectedVersion: 3, enabled: false, timezone: 'Europe/Helsinki', hour: 4, weekdays: [0, 1, 2, 3, 4, 5, 6] });
  });
  it('maps new error codes in both locales', () => {
    expect(trackingErrorMessage(apiErr(422, 'PROMPT_LIMIT_REACHED'), 'en')).toMatch(/limit is reached/);
    expect(trackingErrorMessage(apiErr(503, 'PROMPT_LIMIT_NOT_CONFIGURED'), 'fi')).toMatch(/Kysymysrajaa/);
    expect(trackingErrorMessage(apiErr(409, 'PROMPT_SET_CONFLICT'), 'en')).toMatch(/server needs an update/);
    expect(trackingErrorMessage(apiErr(409, 'VERSION_CONFLICT'), 'en')).toBeNull();
    expect(scheduleStatusInfo('over_limit', 'fi').tone).toBe('warning');
  });
});
