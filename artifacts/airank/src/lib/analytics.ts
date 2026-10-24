/** Safe analytics wrapper: fixed event names, no PII/tokens/domains/text. Terminal/lifecycle events are deduped per page load. */
export type AnalyticsEvent = 'checker_view' | 'checker_started' | 'checker_completed' | 'checker_partial' | 'report_email_requested' | 'report_email_sent' | 'report_opened' | 'account_signup';
const sent = new Set<string>();
type Umami = { track?: (name: string, data?: Record<string, string>) => void };
export function track(event: AnalyticsEvent, locale?: 'fi' | 'en', dedupeKey?: string) {
  const key = `${event}:${dedupeKey ?? ''}`;
  if (dedupeKey !== undefined) { if (sent.has(key)) return; sent.add(key); }
  try { (window as unknown as { umami?: Umami }).umami?.track?.(event, locale ? { locale } : undefined); } catch { /* analytics must never break UI */ }
}
