import type { EvidenceMetric, ProjectAnalytics, PromptAnalyticsSummary } from '@workspace/api-client-react';

/** Scoped detail metrics are only trustworthy when the backend echoes the exact requested prompt scope. Old (0.11) backends ignore prompt filters. */
export type ScopeCheck = 'match' | 'missing' | 'mismatch';
export function checkPromptScope(a: ProjectAnalytics | undefined, promptId: string, version: number): ScopeCheck {
  const s = a?.promptScope;
  if (!s) return 'missing';
  return s.promptId === promptId && s.promptVersion === version ? 'match' : 'mismatch';
}

/** null = backend omits summaries (update required); undefined = no measurements for this prompt version. */
export function findPromptSummary(a: ProjectAnalytics | undefined, promptId: string, version: number): PromptAnalyticsSummary | null | undefined {
  if (!a || !Array.isArray(a.promptSummaries)) return null;
  return a.promptSummaries.find((s) => s.promptId === promptId && s.version === version);
}

export const hasMeasurements = (m: EvidenceMetric) => m.eligible > 0 || m.expected > 0;
