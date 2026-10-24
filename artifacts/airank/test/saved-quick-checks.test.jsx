import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { SavedQuickChecks } from '@/components/airank/saved-quick-checks';

const report = { id: 'c3', status: 'completed', domain: 'x.fi', project_id: 'p', project_version: 1, submission_id: 's', created_at: 3,
  score: {}, prompts: [{ id: 'qp1', sequence: 1, prompt_text: 'Paras kahvila?', prompt_version: '1' }],
  observations: [{ prompt_id: 'qp1', provider: 'openai', provider_status: 'success', answer_text: 'Exact saved answer text', citations: [] },
    { prompt_id: 'qp1', provider: 'gemini', provider_status: 'failed', answer_text: null, citations: [] }] };
vi.mock('wouter', async (load) => ({ ...await load(), Link: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));
vi.mock('@/lib/account', () => ({ useAccount: () => ({ user: { id: 'u' } }) }));
vi.mock('@workspace/api-client-react', async (load) => ({
  ...await load(),
  useListProjectQuickChecks: () => ({ isPending: false, isError: false, data: [1, 2, 3].map((n) => ({ ...report, id: `c${n}`, created_at: n })) }),
  useGetQuickCheck: (id, o) => ({ isPending: false, isError: false, data: o.query.enabled ? { ...report, id } : undefined }),
}));

describe('SavedQuickChecks', () => {
  it('lists every saved check and shows exact saved answers on demand without linking tracked prompts', () => {
    render(<I18nProvider><SavedQuickChecks projectId="p" /></I18nProvider>);
    for (const n of [1, 2, 3]) expect(screen.getByTestId(`row-quick-check-c${n}`)).toBeTruthy();
    expect(screen.queryByText('Exact saved answer text')).toBeNull();
    fireEvent.click(screen.getByTestId('button-toggle-quick-check-c3'));
    expect(screen.getByText('Exact saved answer text')).toBeTruthy();
    expect(screen.getByTestId('link-quick-check-report-c3').getAttribute('href')).toContain('scan=c3');
  });
});
