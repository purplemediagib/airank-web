import type { PublicCapabilities, PublicReport } from '@/lib/public-check-api';

/**
 * Report email is an optional delivery feature, not a prerequisite for a scan.
 * Keep its availability rule separate so the UI gate can be regression-tested.
 */
export function canEmailPublicReport(
  capabilities: Pick<PublicCapabilities, 'emailEnabled'>,
  report: Pick<PublicReport, 'status' | 'score'>,
): boolean {
  return capabilities.emailEnabled
    && (report.status === 'completed' || report.status === 'partial')
    && report.score.valid_answers > 0;
}
