import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicEmbedPage } from '@/pages/public-check';
import { ReportView } from '@/components/public/report-view';
import { canEmailPublicReport } from '@/components/public/report-policy';
import type { PublicCapabilities, PublicPreview, PublicReport } from '@/lib/public-check-api';
import { publicQueryClient } from '@/pages/public-check';

const mocks = vi.hoisted(() => ({
  capabilities: {} as any,
  prepare: { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null as unknown },
  preview: { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null as unknown },
  start: { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null as unknown },
  scan: { data: undefined as unknown, isError: false, error: null as unknown, refetch: vi.fn() },
}));

vi.mock('@/lib/public-check-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/public-check-api')>('@/lib/public-check-api');
  return {
    ...actual,
    usePublicCapabilities: () => mocks.capabilities,
    usePreparePublicProfile: () => mocks.prepare,
    usePreviewPublicScan: () => mocks.preview,
    useStartPublicScan: () => mocks.start,
    usePublicScan: () => mocks.scan,
  };
});

const capabilities: PublicCapabilities = {
  enabled: true,
  emailEnabled: false,
  marketingEnabled: false,
  autofillEnabled: false,
  providers: ['openai', 'claude'],
  promptCount: 3,
  markets: [{ code: 'FI', name: 'Finland' }],
  languages: [{ code: 'en', name: 'English' }, { code: 'fi', name: 'Finnish' }],
  limits: { guestScansPerDay: 1, domainScansPerWeek: 5 },
};

const preview: PublicPreview = {
  profile: {
    domain: 'example.fi', brand_name: 'Example', aliases: ['Example Oy'],
    category_fi: 'accounting software', market: 'FI', language: 'en',
  },
  prompts: ['Which accounting tools work well for small Finnish businesses?'],
  providers: ['openai', 'claude'],
  methodology: 'confirmed-fi-mentions-v2',
  preview_hash: 'synthetic-preview-hash',
  paid_calls: 6,
};

function report(overrides: Partial<PublicReport> = {}): PublicReport {
  return {
    id: 'synthetic-report',
    domain: 'example.fi',
    brand_name: 'Example',
    status: 'partial',
    created_at: 1_800_000_000_000,
    finished_at: 1_800_000_060_000,
    profile: preview.profile,
    score: {
      value: 5,
      out_of: 10,
      state: 'partial',
      mentions: 1,
      valid_answers: 2,
      expected_answers: 3,
      providers_requested: 2,
      providers_measured: 1,
      formula: '10 * brand-mention answers / valid answers',
    },
    prompts: [{ id: 'synthetic-prompt', sequence: 1, text: preview.prompts[0] }],
    observations: [{
      id: 'synthetic-observation',
      prompt_id: 'synthetic-prompt',
      provider: 'openai',
      model: 'synthetic-model',
      status: 'success',
      response_text: 'Example is one option.',
      brand_mentioned: 1,
      citations: [],
    }],
    providers: [
      { provider: 'openai', score: 5, mentions: 1, valid_answers: 2, expected_answers: 3, models: ['synthetic-model'], unavailable_answers: 1 },
      { provider: 'claude', score: null, mentions: 0, valid_answers: 0, expected_answers: 3, models: [], unavailable_answers: 3 },
    ],
    progress: { completed: 3, expected: 6 },
    insight: { kind: 'mentions', mentions: 1, valid_answers: 2 },
    methodology: 'Synthetic fixture methodology.',
    ...overrides,
  };
}

beforeEach(() => {
  publicQueryClient.clear();
  mocks.capabilities = { data: capabilities, isPending: false, isError: false, refetch: vi.fn() };
  mocks.prepare = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null };
  mocks.preview = {
    mutate: vi.fn((_profile: unknown, callbacks: { onSuccess: (value: PublicPreview) => void }) => callbacks.onSuccess(preview)),
    reset: vi.fn(), isPending: false, isError: false, error: null,
  };
  mocks.start = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null };
  mocks.scan = { data: undefined, isError: false, error: null, refetch: vi.fn() };
});

describe('public free-check UI', () => {
  it('rejects an invalid website before allowing profile review', async () => {
    const user = userEvent.setup();
    render(<PublicEmbedPage locale="en" />);

    const website = screen.getByPlaceholderText('https://example.fi');
    await user.type(website, 'http://bad..example.fi');
    const continueButton = screen.getByRole('button', { name: /check my ai visibility/i });
    expect(continueButton.hasAttribute('disabled')).toBe(true);
    expect(mocks.preview.mutate).not.toHaveBeenCalled();
    expect(mocks.start.mutate).not.toHaveBeenCalled();
  });

  it('requires a reviewed profile, previews before starting, and requires explicit confirmation', async () => {
    const user = userEvent.setup();
    render(<PublicEmbedPage locale="en" />);

    await user.type(screen.getByPlaceholderText('https://example.fi'), 'https://example.fi');
    await user.click(screen.getByRole('button', { name: /check my ai visibility/i }));

    await user.type(screen.getAllByRole('textbox', { name: /brand name/i })[0], 'Example');
    await user.type(screen.getAllByRole('textbox', { name: /neutral category/i })[0], 'accounting software');
    await user.click(screen.getByRole('button', { name: /preview questions/i }));

    expect(mocks.preview.mutate).toHaveBeenCalledOnce();
    expect(mocks.preview.mutate.mock.calls[0][0]).toMatchObject({
      domain: 'example.fi', brand_name: 'Example', category_fi: 'accounting software',
      market: 'FI', language: 'en',
    });
    expect(screen.getByText(preview.prompts[0])).toBeTruthy();

    const start = screen.getByRole('button', { name: 'Start check' });
    expect(start.hasAttribute('disabled')).toBe(true);
    expect(mocks.start.mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox'));
    await user.click(start);
    expect(mocks.start.mutate).toHaveBeenCalledOnce();
    expect(mocks.start.mutate.mock.calls[0][0]).toMatchObject({
      domain: 'example.fi',
      brand_name: 'Example',
      profile_confirmed: true,
      methodology: 'confirmed-fi-mentions-v2',
      preview_hash: 'synthetic-preview-hash',
    });
    expect(mocks.start.mutate.mock.calls[0][0].submission_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('keeps the free checker unavailable when the server capability is off', () => {
    mocks.capabilities.data = { ...capabilities, enabled: false };
    render(<PublicEmbedPage locale="en" />);
    expect(screen.getByRole('alert').textContent).toContain('currently switched off');
    expect(screen.queryByPlaceholderText('https://example.fi')).toBeNull();
  });
});

describe('public report display and email gate', () => {
  it('shows a partial score and unavailable providers distinctly from zero visibility', () => {
    render(<ReportView report={report()} loc="en" />);
    expect(screen.getByText('Partial result')).toBeTruthy();
    expect(screen.getByText('5.0 / 10')).toBeTruthy();
    expect(screen.getByText(/1 unavailable/)).toBeTruthy();
    expect(screen.getByText('N/A')).toBeTruthy();
    expect(screen.getByText(/some answers were unavailable/i)).toBeTruthy();
  });

  it('offers report email only when enabled and a terminal report has valid answers', () => {
    const current = report();
    expect(canEmailPublicReport({ emailEnabled: false }, current)).toBe(false);
    expect(canEmailPublicReport({ emailEnabled: true }, current)).toBe(true);
    expect(canEmailPublicReport(
      { emailEnabled: true },
      report({ status: 'running', score: { ...current.score, valid_answers: 2 } }),
    )).toBe(false);
    expect(canEmailPublicReport(
      { emailEnabled: true },
      report({ status: 'completed', score: { ...current.score, valid_answers: 0 } }),
    )).toBe(false);
  });
});
