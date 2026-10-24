import { useId, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronsUpDown, Globe2, Info, Languages } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { projectContext, useMeasurementCatalog, useContextLabels, type ContextOption } from '@/lib/measurement-context';
import { normLanguage, normMarket } from '@/lib/project-validate';

function SearchSelect({ label, hint, value, valueLabel, options, onChange, disabled, placeholder, testId, icon, error }: {
  label: string; hint?: string; value: string; valueLabel: string; options: ContextOption[]; onChange: (code: string) => void; disabled?: boolean; placeholder: string; testId: string; icon: React.ReactNode; error?: string;
}) {
  const { d } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const list = useMemo(() => (options.some((o) => o.code === value) ? options : [{ code: value, label: valueLabel, search: `${valueLabel} ${value}`.toLowerCase() }, ...options]), [options, value, valueLabel]);
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-l`} className="text-[13px] font-medium leading-[19px] text-ink">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-labelledby={`${id}-l`}
            aria-describedby={hint ? `${id}-h` : undefined}
            aria-invalid={!!error || undefined}
            disabled={disabled}
            className={cn('flex h-11 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm font-medium text-ink transition-colors focus-visible:outline-none focus-visible:ring-[3px] disabled:bg-canvas disabled:text-muted-ink', error ? 'border-danger' : 'border-line hover:border-[#c9d2e0] focus-visible:border-navy focus-visible:ring-cyan/60')}
            data-testid={testId}
          >
            <span className="shrink-0 text-muted-ink">{icon}</span>
            <span className="min-w-0 flex-1 truncate">{valueLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-ink" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0">
          <Command filter={(v, s) => (v.includes(s.toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder={placeholder} aria-label={placeholder} data-testid={`${testId}-search`} />
            <CommandList>
              <CommandEmpty>{d.auth.noMatches}</CommandEmpty>
              {list.map((o) => (
                <CommandItem key={o.code} value={o.search} onSelect={() => { onChange(o.code); setOpen(false); }} data-testid={`${testId}-option-${o.code}`}>
                  <Check className={cn('size-4', o.code === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="font-mono text-[11px] text-muted-ink">{o.code}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hint && !error && <p id={`${id}-h`} className="text-[12px] leading-[17px] text-muted-ink">{hint}</p>}
      {error && <p role="alert" className="flex items-center gap-1.5 text-[12px] font-medium text-danger"><AlertCircle className="size-3.5 shrink-0" aria-hidden />{error}</p>}
    </div>
  );
}

/** Independent market + prompt-language selectors; values persist on the project, never follow the UI locale. */
export function MeasurementContextFields({ market, language, onChange, disabled, errors, changed, compact }: {
  market: string; language: string; onChange: (next: { market: string; promptLanguage: string }) => void; disabled?: boolean; errors?: { market?: string; promptLanguage?: string }; changed?: boolean; compact?: boolean;
}) {
  const { d } = useI18n();
  const a = d.auth;
  const cat = useMeasurementCatalog();
  const labels = useContextLabels();
  return (
    <div className="flex flex-col gap-3" data-testid="fields-measurement-context">
      {!compact && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-[22px] text-ink">{a.contextTitle}</span>
          <span className="text-[13px] leading-[19px] text-muted-ink">{a.contextLead}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SearchSelect label={a.trackingMarket} hint={a.marketHint} value={market} valueLabel={labels.market(market)} options={cat.markets} onChange={(m) => onChange({ market: m, promptLanguage: language })} disabled={disabled || cat.isPending} placeholder={a.searchMarket} testId="select-market" icon={<Globe2 className="size-4" aria-hidden />} error={errors?.market} />
        <SearchSelect label={a.promptLanguage} hint={a.languageHint} value={language} valueLabel={labels.language(language)} options={cat.languages} onChange={(l) => onChange({ market, promptLanguage: l })} disabled={disabled || cat.isPending} placeholder={a.searchLanguage} testId="select-prompt-language" icon={<Languages className="size-4" aria-hidden />} error={errors?.promptLanguage} />
      </div>
      {cat.isError && <p role="status" className="text-[12px] text-warning" data-testid="text-context-load-failed">{a.contextLoadFailed}</p>}
      {changed && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2.5 text-[13px] leading-[19px] text-warning" data-testid="text-context-change-note">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />{a.contextChangeNote}
        </p>
      )}
    </div>
  );
}

/** Model-based context disclaimer shown wherever a measurement profile is confirmed. */
export function ProviderContextNotice({ className }: { className?: string }) {
  const { d, locale } = useI18n();
  const cat = useMeasurementCatalog();
  return (
    <p className={cn('flex items-start gap-2 text-[12px] leading-[17px] text-muted-ink', className)} role="note" data-testid="text-provider-context-notice">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{d.auth.providerNotice}{cat.notice && locale === 'en' ? ` ${cat.notice}` : ''}</span>
    </p>
  );
}

/** Shown when a saved prompt's market/language snapshot differs from the project's current context. */
export function PromptContextMismatch({ prompt, project, detailed }: { prompt: { market?: string; language?: string; id: string }; project: { market?: string; promptLanguage?: string } | null | undefined; detailed?: boolean }) {
  const { d, t } = useI18n();
  const labels = useContextLabels();
  if (!prompt.market && !prompt.language) return null;
  const cur = projectContext(project);
  const savedM = prompt.market ? normMarket(prompt.market) : cur.market;
  const savedL = prompt.language ? normLanguage(prompt.language) : cur.language;
  if (savedM === cur.market && savedL === cur.language) return null;
  const msg = t(d.auth.promptMismatch, { saved: `${labels.market(savedM)} · ${labels.language(savedL)}`, current: `${labels.market(cur.market)} · ${labels.language(cur.language)}` });
  if (!detailed) return <span title={msg} className="inline-flex items-center gap-1 rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-medium text-warning" data-testid={`status-prompt-context-${prompt.id}`}><AlertCircle className="size-3" aria-hidden />{d.auth.promptMismatchShort}<span className="sr-only">: {msg}</span></span>;
  return <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2.5 text-[13px] leading-[19px] text-warning" data-testid="text-prompt-context-mismatch"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{msg}</p>;
}
