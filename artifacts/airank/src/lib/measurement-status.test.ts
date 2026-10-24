import { describe, expect, it } from 'vitest';
import { isSuccessfulMeasurement, measurementLabel, providerProgress } from './measurement-status';

describe('backend measurement status semantics', () => {
  it('only accepts explicit success, including an answer with zero mentions', () => {
    expect(isSuccessfulMeasurement('success')).toBe(true);
    for (const status of ['unconfigured', 'budget_blocked', 'no_grounding', 'no_overview', 'failed', 'skipped', 'pending', 'timeout']) {
      expect(isSuccessfulMeasurement(status)).toBe(false);
    }
  });
  it('does not mark failed but settled providers as completed', () => {
    expect(providerProgress([], 3)).toBe('pending');
    expect(providerProgress(['success'], 3)).toBe('running');
    expect(providerProgress(['success', 'processing'], 2)).toBe('running');
    expect(providerProgress(['success', 'failed', 'success'], 3)).toBe('partial');
    expect(providerProgress(['skipped', 'failed', 'unconfigured'], 3)).toBe('failed');
    expect(providerProgress(['success', 'success', 'success'], 3)).toBe('completed');
  });
  it('provides bilingual explanations without inventing diagnostic causes', () => {
    expect(measurementLabel('budget_blocked')).toBe('Provider-call budget reached');
    expect(measurementLabel('timeout', true)).toBe('Aikakatkaisu');
    expect(measurementLabel('failed')).toBe('Failed');
  });
});
