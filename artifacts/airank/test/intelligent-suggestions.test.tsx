import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SuggestionMix, SuggestionRow, topicHints } from '@/components/airank/suggestion-review';
import { KindControl } from '@/components/airank/prompt-parts';
import { CandidateIdentity } from '@/components/airank/candidate-identity';
import { WebsiteFavicon } from '@/components/airank/website-favicon';

const wrap = (ui: React.ReactNode) => { window.history.replaceState(null, '', '/en/dashboard/prompts'); return render(<I18nProvider><TooltipProvider>{ui}</TooltipProvider></I18nProvider>); };
const sugg = (o = {}) => ({ id: 's1', text: 'Best accounting firms in Tampere?', status: 'pending' as const, source: 'ai', promptId: null, kind: 'neutral' as const, topic: 'Accounting', tags: ['t1'], ...o });
const rowProps = { lang: 'en', readOnly: false, busyAction: null, disabled: false, sourceLabel: 'Source', statusLabel: 'Pending', tone: 'info' as const, openHref: '/x', openLabel: 'Open', onReject: () => {} };

describe('prompt suggestions', () => {
  it('accepts with reviewed kind, topic and original tags', () => {
    const onAccept = vi.fn();
    wrap(<SuggestionRow s={sugg()} hints={['Payroll']} onAccept={onAccept} {...rowProps} />);
    expect(screen.getByTestId('text-suggestion-branding-s1').textContent).toBe('Non-branded');
    fireEvent.click(screen.getByTestId('button-edit-suggestion-s1'));
    fireEvent.click(screen.getByTestId('button-kind-diagnostic-s1'));
    fireEvent.click(screen.getByTestId('button-topic-hint-s1-Payroll'));
    fireEvent.click(screen.getByTestId('button-accept-s1'));
    expect(onAccept).toHaveBeenCalledWith({ text: 'Best accounting firms in Tampere?', kind: 'diagnostic', topic: 'Payroll', tags: ['t1'] });
  });
  it('blocks acceptance of too-short edited text', () => {
    const onAccept = vi.fn();
    wrap(<SuggestionRow s={sugg()} hints={[]} onAccept={onAccept} {...rowProps} />);
    fireEvent.click(screen.getByTestId('button-edit-suggestion-s1'));
    fireEvent.change(screen.getByTestId('input-suggestion-text-s1'), { target: { value: 'short' } });
    expect((screen.getByTestId('button-accept-s1') as HTMLButtonElement).disabled).toBe(true);
  });
  it('labels the branded / non-branded mix', () => {
    wrap(<SuggestionMix list={[sugg(), sugg({ id: 's2' }), sugg({ id: 's3', kind: 'diagnostic' })]} />);
    expect(screen.getByTestId('text-mix-neutral').textContent).toContain('2 non-branded');
    expect(screen.getByTestId('text-mix-diagnostic').textContent).toContain('1 branded');
  });
  it('derives topic hints only from drafts and existing topics, deduplicated', () => {
    expect(topicHints([sugg(), sugg({ topic: 'accounting' }), sugg({ topic: '' })], ['Payroll'])).toEqual(['Payroll', 'Accounting']);
  });
});

describe('prompt kind control', () => {
  it('allows selecting branded', () => {
    const onChange = vi.fn();
    wrap(<KindControl value="neutral" onChange={onChange} />);
    expect(screen.getByTestId('radio-kind-neutral').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('radio-kind-diagnostic'));
    expect(onChange).toHaveBeenCalledWith('diagnostic');
  });
});

describe('competitor suggestions', () => {
  it('marks proposed domains as unverified', () => {
    wrap(<CandidateIdentity c={{ id: 'c1', name: 'Kirjanpito Oy', evidenceIds: [], status: 'pending', brandId: null, proposedDomains: ['kirjanpito.fi'], reviewRequired: true }} />);
    expect(screen.getByTestId('badge-unverified-c1').textContent).toMatch(/unverified/i);
    expect(screen.getByTestId('text-proposed-domains-c1').textContent).toContain('kirjanpito.fi');
  });
});

describe('website favicon', () => {
  it('loads the site favicon directly and falls back to the initial', () => {
    const { container } = render(<WebsiteFavicon domain="kirjanpito.fi" brand="kirjanpito" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://kirjanpito.fi/favicon.ico');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('K');
  });
  it('uses the initial for invalid domains', () => {
    const { container } = render(<WebsiteFavicon domain="not a domain" brand="acme" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
