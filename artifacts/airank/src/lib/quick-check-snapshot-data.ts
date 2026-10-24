import type { QuickCheckAccepted, QuickCheckReport } from '@workspace/api-client-react';

export const isQuickCheckPending = (status: string) => ['pending', 'queued', 'running', 'processing'].includes(status);
export const quickCheckTime = (n: number) => n < 1e12 ? n * 1000 : n;

export function sortedQuickChecks(checks: QuickCheckAccepted[]) {
  return [...checks].sort((a, b) => quickCheckTime(b.created_at) - quickCheckTime(a.created_at));
}

export function nextSnapshotCandidate(checks: QuickCheckAccepted[], skippedIds: string[] = []) {
  return sortedQuickChecks(checks).find((check) => ['completed', 'partial'].includes(check.status) && !skippedIds.includes(check.id));
}

export function hasUsefulQuickCheckResults(report: QuickCheckReport) {
  return ['completed', 'partial'].includes(report.status) && report.score.valid_answers > 0;
}

/** Missing answers are not zero visibility. Score is supplied by the API, in 0–10 units. */
export function quickCheckVisibility(report: QuickCheckReport) {
  return report.score.valid_answers > 0 ? report.score.mentions / report.score.valid_answers : null;
}
