/** Only the backend's explicit success status is eligible for measurement. */
export const isSuccessfulMeasurement = (status: string) => status === 'success';
export const activeMeasurement = (status: string) => ['pending', 'queued', 'running', 'processing'].includes(status);

export function measurementLabel(status: string, fi = false): string {
  const labels: Record<string, [string, string]> = {
    pending: ['Odottaa', 'Pending'], queued: ['Jonossa', 'Queued'], running: ['Käsitellään', 'Running'],
    processing: ['Käsitellään', 'Running'],
    success: ['Onnistui', 'Successful'], failed: ['Epäonnistui', 'Failed'],
    error: ['Epäonnistui', 'Failed'], timeout: ['Aikakatkaisu', 'Timed out'],
    rate_limited: ['Palvelun pyyntöraja saavutettu', 'Provider rate limit reached'],
    unconfigured: ['Palvelun tunnistetietoja ei ole määritetty', 'Provider credentials not configured'],
    unavailable: ['Palvelu ei ole saatavilla', 'Provider unavailable'],
    skipped: ['Ohitettu', 'Skipped'], budget_blocked: ['Kutsuraja saavutettu', 'Provider-call budget reached'],
    no_overview: ['AI-yhteenvetoa ei palautettu', 'No AI Overview returned'],
    no_grounding: ['Vahvistavat lähteet puuttuvat', 'Required source evidence missing'],
    unsupported_context: ['Markkina tai kieli ei ole tuettu', 'Market or language not supported'],
    truncated: ['Vastaus katkesi', 'Response truncated'],
  };
  return labels[status]?.[fi ? 0 : 1] ?? status.replaceAll('_', ' ');
}

export function providerProgress(statuses: string[], expected: number): string {
  if (!statuses.length) return 'pending';
  if (statuses.some(activeMeasurement) || statuses.length < expected) return 'running';
  const valid = statuses.filter(isSuccessfulMeasurement).length;
  return valid === expected ? 'completed' : valid ? 'partial' : 'failed';
}
