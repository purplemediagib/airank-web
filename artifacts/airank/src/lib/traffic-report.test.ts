import { describe, expect, it } from 'vitest';
import { coverage, rangeOk, reportFlags, defaultRange, cell } from './traffic-report';

describe('traffic report helpers', () => {
  it('distinguishes missing imports from no matching reported rows', () => {
    expect(coverage({ totalRows: 0, availableDates: [], missingDates: ['2025-01-01'] })).toBe('missing');
    expect(coverage({ totalRows: 0, availableDates: ['2025-01-01'], missingDates: [] })).toBe('zero');
    expect(coverage({ totalRows: 0, availableDates: ['2025-01-01'], missingDates: ['2025-01-02'] })).toBe('partial-zero');
    expect(coverage({ totalRows: 1, availableDates: ['2025-01-01'], missingDates: ['2025-01-02'] })).toBe('partial');
    expect(coverage({ totalRows: 1, availableDates: ['2025-01-01'], missingDates: [] })).toBe('complete');
  });
  it('uses the total count even when a paginated page is empty', () => {
    const report = { rows: [], totalRows: 25, availableDates: ['2025-01-01'], missingDates: [] };
    expect(coverage(report)).toBe('complete');
    expect(coverage({ ...report, missingDates: ['2025-01-02'] })).toBe('partial');
  });
  it('accepts only exact ISO calendar dates', () => {
    expect(rangeOk('2025-02-30', '2025-03-03')).toBe(false);
    expect(rangeOk('2025-02-01', '2025-02-30')).toBe(false);
    expect(rangeOk('2025-02-29', '2025-03-01')).toBe(false);
    expect(rangeOk('2024-02-29', '2024-03-01')).toBe(true);
    expect(rangeOk('2025-2-01', '2025-02-02')).toBe(false);
    expect(rangeOk('2025-02-01T00:00:00Z', '2025-02-02')).toBe(false);
  });
  it('validates ranges up to 366 days', () => {
    expect(rangeOk('2025-01-01', '2025-12-31')).toBe(true);
    expect(rangeOk('2025-01-02', '2025-01-01')).toBe(false);
    expect(rangeOk('2024-01-01', '2025-06-01')).toBe(false);
    const r = defaultRange(Date.parse('2025-03-01T12:00:00Z'));
    expect(r).toEqual({ from: '2025-02-01', to: '2025-02-28' });
  });
  it('detects quality flags but ignores falsey values', () => {
    expect(reportFlags([{ day: { isDataTruncated: true } }, { samplingMetadatas: [] }, { thresholded: 'false' }])).toEqual({ truncated: true, sampling: false, threshold: false });
    expect(cell(0.123456)).toBe('0.1235');
    expect(cell(null)).toBe('-');
  });
});
