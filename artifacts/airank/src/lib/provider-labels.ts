export const MEASUREMENT_PROVIDERS = ['openai', 'claude', 'gemini', 'grok', 'perplexity', 'google_aio'] as const;
const labels: Record<string, string> = {
  openai: 'OpenAI', claude: 'Claude', gemini: 'Gemini',
  grok: 'Grok', perplexity: 'Perplexity', google_aio: 'Google AI Overviews',
};
export const measurementProviderLabel = (provider: string) => labels[provider] ?? provider;
