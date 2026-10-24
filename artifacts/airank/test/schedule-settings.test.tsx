import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const state = vi.hoisted(() => ({ data: null as unknown, mutate: vi.fn() }));
vi.mock('@/lib/account', () => ({ useAccount: () => ({ writeRequest: {} }) }));
vi.mock('@/lib/use-industries', () => ({
  useSchedule: () => ({ isPending: false, isError: false, data: state.data, unavailable: false, refetch: () => {} }),
  useScheduleWrite: () => ({ isPending: false, mutate: state.mutate }),
}));
vi.mock('@/lib/project-context', () => ({ useProjectsOptional: () => ({ activeProjects: [{ id: 'p1' }] }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }));
const { ScheduleSettings } = await import('@/components/airank/schedule-settings');

const sched = (o = {}) => ({ version: 5, enabled: true, timezone: 'Europe/Helsinki', hour: 4, weekdays: [0, 1, 2, 3, 4, 5, 6], nextAt: Date.UTC(2025, 0, 2, 2, 17), activationAvailable: true, missedPolicy: 'skip', slots: [], minute: 17, status: 'scheduled', activePromptCount: 6, promptLimit: 10, lastRunAt: null, lastRunStatus: null, ...o });
const wrap = () => { window.history.replaceState(null, '', '/en/settings?project=p1&tab=tracking'); return render(<QueryClientProvider client={new QueryClient()}><I18nProvider><ScheduleSettings projectId="p1" readOnly={false} /></I18nProvider></QueryClientProvider>); };

describe('daily schedule settings', () => {
  it('shows fixed time, count/limit, and no weekly editor', () => {
    state.data = sched();
    wrap();
    expect(screen.getByTestId('text-daily-time').textContent).toMatch(/04:17/);
    expect(screen.getByTestId('text-schedule-count').textContent).toBe('6 / 10 prompts');
    expect(screen.queryByTestId('button-weekday-1')).toBeNull();
    expect(screen.queryByTestId('select-schedule-hour')).toBeNull();
  });
  it('pause sends the fixed daily configuration', () => {
    state.data = sched();
    state.mutate.mockClear();
    wrap();
    fireEvent.click(screen.getByTestId('button-schedule-pause'));
    expect(state.mutate.mock.calls[0][0]).toEqual({ projectId: 'p1', data: { expectedVersion: 5, enabled: false, timezone: 'Europe/Helsinki', hour: 4, weekdays: [0, 1, 2, 3, 4, 5, 6] } });
  });
  it('identifies an outdated single-workspace server without asking users to archive projects', () => {
    state.data = sched({ enabled: false, status: 'conflict', nextAt: null });
    wrap();
    expect(screen.getByTestId('status-schedule').textContent).toMatch(/Server update required/);
    expect(screen.queryByTestId('link-schedule-archive')).toBeNull();
    expect((screen.getByTestId('button-schedule-resume') as HTMLButtonElement).disabled).toBe(true);
  });
});
