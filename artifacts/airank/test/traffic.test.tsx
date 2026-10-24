import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TrafficPage from '@/pages/traffic';
import { connectionsCopy } from '@/lib/connections-copy';

const mocks = vi.hoisted(() => ({
  status: {} as Record<string, any>,
  report: {} as Record<string, any>,
  locale: 'en' as 'en' | 'fi',
  reports: vi.fn(),
}));
vi.mock('@workspace/api-client-react', () => ({
  useGetGoogleConnection: () => mocks.status,
  useGetGoogleReports: (...args: unknown[]) => mocks.reports(...args),
  getGetGoogleConnectionQueryKey: () => ['connection'],
  getGetGoogleReportsQueryKey: () => ['reports'],
}));
vi.mock('@/lib/project-context', () => ({
  useProjects: () => ({ project: { id: 'project-test' }, projectHref: (path: string) => path }),
}));
vi.mock('@/i18n', () => ({
  useDocumentTitle: () => {},
  useI18n: () => ({
    locale: mocks.locale, d: { nav: { traffic: 'Traffic' }, errors: { title: 'Error' }, common: { retry: 'Retry' } },
    date: (value: string) => value,
    t: (text: string, values: Record<string, unknown>) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key])),
  }),
}));

beforeEach(() => {
  mocks.locale = 'en';
  mocks.status = {
    data: { configured: true, property: 'properties/123', status: 'connected', connected: true },
    isPending: false, isError: false, isFetching: false, refetch: vi.fn(),
  };
  mocks.report = {
    data: {
      property: 'properties/123', rows: [{ aiAssistant: 'ChatGPT', sessionSource: 'chatgpt.com' }],
      totalRows: 26, nextOffset: 25, availableDates: ['2025-01-01'], missingDates: [], metadata: [], notes: [],
    },
    isPending: false, isError: false, isFetching: false, refetch: vi.fn(),
  };
  mocks.reports.mockImplementation(() => mocks.report);
});

describe('Traffic cached reports', () => {
  it('keeps cached status and report visible after a status refresh fails', () => {
    mocks.status.isError = true;
    render(<TrafficPage />);
    expect(screen.getByText('ChatGPT')).toBeTruthy();
    expect(screen.getByText('Refreshing failed. Showing the last cached result.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.status.refetch).toHaveBeenCalledOnce();
  });

  it('shows a full error when status has no cached data', () => {
    mocks.status.data = undefined;
    mocks.status.isError = true;
    render(<TrafficPage />);
    expect(screen.getByText(connectionsCopy.en.loadFailed)).toBeTruthy();
    expect(screen.queryByText('ChatGPT')).toBeNull();
  });

  it('allows Previous on an empty later page without claiming no matching rows', () => {
    mocks.reports.mockImplementation((_project, _service, params) => ({
      ...mocks.report,
      data: { ...mocks.report.data, ...(params.offset ? { rows: [], nextOffset: null } : {}) },
    }));
    render(<TrafficPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('No rows on this page. Use Previous to return to earlier results.')).toBeTruthy();
    expect(screen.queryByText('No matching reported rows')).toBeNull();
    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous.hasAttribute('disabled')).toBe(false);
    fireEvent.click(previous);
    expect(screen.getByText('ChatGPT')).toBeTruthy();
  });

  it.each(['en', 'fi'] as const)('localizes actual connector columns in %s', (locale) => {
    mocks.locale = locale;
    const keys = ['aiAssistant', 'sessionSource', 'sessionMedium', 'landingPagePlusQueryString', 'engagementRate', 'sessionKeyEventRate', 'totalRevenue'];
    mocks.report.data.rows = [Object.fromEntries(keys.map((key) => [key, 1]))];
    render(<TrafficPage />);
    for (const key of keys) {
      expect(screen.getByRole('columnheader', { name: connectionsCopy[locale][`c_${key}` as keyof typeof connectionsCopy.en] })).toBeTruthy();
    }
  });

  it('distinguishes missing imports from imported days with no reported rows', () => {
    mocks.report.data = { ...mocks.report.data, rows: [], totalRows: 0, availableDates: [], missingDates: ['2025-01-01'] };
    const { rerender } = render(<TrafficPage />);
    expect(screen.getByText('No imported data for this range')).toBeTruthy();
    expect(screen.queryByText('No matching reported rows')).toBeNull();
    mocks.report.data = { ...mocks.report.data, availableDates: ['2025-01-01'], missingDates: [] };
    rerender(<TrafficPage />);
    expect(screen.getByText('No matching reported rows')).toBeTruthy();
    expect(screen.getByText(/All requested days were imported/)).toBeTruthy();
    mocks.report.data = { ...mocks.report.data, missingDates: ['2025-01-02'] };
    rerender(<TrafficPage />);
    expect(screen.getByText(/other days are missing/)).toBeTruthy();
  });

  it('retains cached rows on report refresh failure, with a cache-only retry', () => {
    mocks.report.isError = true;
    render(<TrafficPage />);
    expect(screen.getByText('ChatGPT')).toBeTruthy();
    fireEvent.click(screen.getByTestId('button-retry-report-ga4'));
    expect(mocks.report.refetch).toHaveBeenCalledOnce();
  });

  it('blocks stale property rows and disables reports after disconnect', () => {
    mocks.report.data.property = 'properties/old';
    const { rerender } = render(<TrafficPage />);
    expect(screen.queryByText('ChatGPT')).toBeNull();
    mocks.report.data.property = 'properties/123';
    mocks.status.data = { ...mocks.status.data, connected: false, status: 'disconnected' };
    rerender(<TrafficPage />);
    expect(screen.queryByText('ChatGPT')).toBeNull();
    expect(mocks.reports.mock.lastCall?.[3].query.enabled).toBe(false);
    expect(mocks.reports.mock.lastCall?.[3].query.placeholderData).toBeUndefined();
  });

  it('keeps reconnect-required cached reports available', () => {
    mocks.status.data = { ...mocks.status.data, connected: false, status: 'reconnect_required' };
    render(<TrafficPage />);
    expect(screen.getByText(/Cached data below stays available/)).toBeTruthy();
    expect(screen.getByText('ChatGPT')).toBeTruthy();
    expect(mocks.reports.mock.lastCall?.[3].query.enabled).toBe(true);
  });

  it('resets pagination for presets and disables invalid date requests', () => {
    render(<TrafficPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(mocks.reports.mock.lastCall?.[2].offset).toBe(25);
    fireEvent.click(screen.getByTestId('button-range-7'));
    const params = mocks.reports.mock.lastCall?.[2];
    expect(params.offset).toBe(0);
    expect((Date.parse(params.endDate) - Date.parse(params.startDate)) / 86400000).toBe(6);
    fireEvent.change(screen.getByTestId('traffic-from-ga4'), { target: { value: '1900-01-01' } });
    expect(screen.getByText(connectionsCopy.en.rangeBad)).toBeTruthy();
    expect(mocks.reports.mock.lastCall?.[3].query.enabled).toBe(false);
    expect(screen.queryByText('ChatGPT')).toBeNull();
  });

  it('supports keyboard service tabs, uses Google GSC totals and never applies AI-only filtering there', () => {
    render(<TrafficPage />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByTestId('tab-traffic-gsc').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByTestId('tab-traffic-gsc'));
    expect(mocks.reports.mock.lastCall?.[1]).toBe('gsc');
    expect(mocks.reports.mock.lastCall?.[2].view).toBe('totals');
    expect(mocks.reports.mock.lastCall?.[2].aiOnly).toBeUndefined();
    expect(screen.getByText(/Search Console does not separate AI Overviews or AI Mode/)).toBeTruthy();
  });
});
