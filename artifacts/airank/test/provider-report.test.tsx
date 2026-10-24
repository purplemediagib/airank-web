import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportView } from '@/components/public/report-view';
import type { PublicReport } from '@/lib/public-check-api';

const report = {
  status: 'running', brand_name: 'Example', domain: 'example.com',
  created_at: 1, finished_at: null, progress: { completed: 2, expected: 3 },
  score: { value: null, out_of: 10, mentions: 0, valid_answers: 1, providers_requested: 2, providers_measured: 1 },
  insight: { kind: 'no_mentions', mentions: 0, valid_answers: 1 },
  prompts: [{ id: 'q', sequence: 1, text: 'Which tools help?' }],
  observations: [
    { id: 'a', prompt_id: 'q', provider: 'openai', status: 'success', response_text: 'A valid zero-mention answer.', brand_mentioned: 0, model: 'test', citations: [{ url: 'https://example.com/source', domain: 'example.com', owned: true }] },
    { id: 'b', prompt_id: 'q', provider: 'claude', status: 'timeout', response_text: null, brand_mentioned: 0, model: null, citations: [] },
  ],
  providers: [
    { provider: 'openai', score: null, mentions: 0, valid_answers: 1, expected_answers: 2, unavailable_answers: 0, models: ['test'] },
    { provider: 'claude', score: null, mentions: 0, valid_answers: 0, expected_answers: 1, unavailable_answers: 1, models: [] },
  ],
} as unknown as PublicReport;

describe('public report evidence during partial progress', () => {
  it('renders successful zero-mention evidence and sources before completion', () => {
    render(<ReportView report={report} loc="en" />);
    expect(screen.getByText('A valid zero-mention answer.')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.com/source');
    expect(screen.getByText('Timed out')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
  });
  it('keeps successful evidence and backend score when another provider fails', () => {
    render(<ReportView report={{ ...report, status: 'failed', score: { ...report.score, value: 0 } }} loc="en" />);
    expect(screen.getByText('A valid zero-mention answer.')).toBeTruthy();
    expect(screen.getByText('Timed out')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('translates actual status codes in Finnish', () => {
    render(<ReportView report={report} loc="fi" />);
    expect(screen.getByText('Aikakatkaisu')).toBeTruthy();
  });
});
