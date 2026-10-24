import openaiLogo from '@/assets/provider-logos/openai.svg';
import claudeLogo from '@/assets/provider-logos/claude.svg';
import geminiLogo from '@/assets/provider-logos/gemini.svg';
import grokLogo from '@/assets/provider-logos/grok.svg';
import perplexityLogo from '@/assets/provider-logos/perplexity.svg';
import googleAioLogo from '@/assets/provider-logos/google_aio.svg';
import { measurementProviderLabel } from '@/lib/provider-labels';

const logos: Record<string, string> = {
  openai: openaiLogo, chatgpt: openaiLogo, claude: claudeLogo, anthropic: claudeLogo,
  gemini: geminiLogo, grok: grokLogo, perplexity: perplexityLogo,
  google_aio: googleAioLogo,
};

/** Bundled brand assets use a consistent 24px box and retain accessible text labels. */
export function ProviderMark({ provider, className = '' }: { provider: string; className?: string }) {
  const logo = logos[provider.toLowerCase()];
  return <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
    {logo ? <img src={logo} alt="" aria-hidden="true" width={24} height={24} className="size-6 shrink-0 object-contain" /> : <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[10px] font-bold text-muted-ink ring-1 ring-line" aria-hidden="true">{measurementProviderLabel(provider).slice(0, 1)}</span>}
    <span className="truncate">{measurementProviderLabel(provider)}</span>
  </span>;
}

export function ProviderLogo({ provider, className = '' }: { provider: string; className?: string }) {
  return <ProviderMark provider={provider} className={className} />;
}
