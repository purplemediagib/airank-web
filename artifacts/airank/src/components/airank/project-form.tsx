import { useId, useState, type ReactNode } from 'react';
import { AlertCircle, Plus, X } from 'lucide-react';
import type { ProjectInput } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { emptyProjectInput, normLanguage, normMarket, normaliseInput, validateProject, type ProjectErrors } from '@/lib/project-validate';
import { TextField } from './forms';
import { AiProvenance, WebsiteAutofill } from './website-autofill';
import { MeasurementContextFields } from './context-select';

/* ---------- Editable list (aliases, owned domains) ---------- */
function ListField({ label, hint, optional, values, onChange, error, addLabel, max, min = 0, placeholder, testId, disabled, inputMode }: {
  label: string; hint?: string; optional?: boolean; values: string[]; onChange: (v: string[]) => void; error?: string; addLabel: string; max: number; min?: number; placeholder?: string; testId: string; disabled?: boolean; inputMode?: 'url' | 'text';
}) {
  const { d, t } = useI18n();
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={[hint && !error ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined} className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-[13px] font-medium leading-[19px] text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-ink">({d.common.optional})</span>}
      </span>
      <ul className="flex flex-col gap-2">
        {values.map((v, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={v}
              disabled={disabled}
              inputMode={inputMode}
              placeholder={placeholder}
              aria-label={`${label} ${i + 1}`}
              aria-invalid={!!error || undefined}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
              className={cn(
                'h-11 w-full rounded-lg border bg-white px-3 text-sm font-medium text-ink placeholder:font-normal placeholder:text-muted-ink transition-colors focus-visible:outline-none focus-visible:ring-[3px] disabled:bg-canvas disabled:text-muted-ink',
                error ? 'border-danger focus-visible:ring-danger/25' : 'border-line hover:border-[#c9d2e0] focus-visible:border-navy focus-visible:ring-cyan/60',
              )}
              data-testid={`${testId}-${i}`}
            />
            {!disabled && values.length > min && (
              <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t(d.auth.removeItem, { item: v || `${label} ${i + 1}` })} onClick={() => onChange(values.filter((_, j) => j !== i))} data-testid={`${testId}-remove-${i}`}>
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {hint && !error && <p id={`${id}-hint`} className="text-[12px] leading-[17px] text-muted-ink">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="flex items-center gap-1.5 text-[12px] font-medium leading-[17px] text-danger"><AlertCircle className="size-3.5 shrink-0" aria-hidden />{error}</p>}
      {!disabled && values.length < max && (
        <Button type="button" variant="ghost" size="sm" className="self-start text-link" onClick={() => onChange([...values, ''])} data-testid={`${testId}-add`}>
          <Plus aria-hidden /> {addLabel}
        </Button>
      )}
    </div>
  );
}

export function ProjectFields({ draft, setDraft, errors, disabled, stacked }: { draft: ProjectInput; setDraft: (d: ProjectInput) => void; errors: ProjectErrors; disabled?: boolean; stacked?: boolean }) {
  const { d } = useI18n();
  const s = d.settings;
  return (
    <div className={cn('grid grid-cols-1', stacked ? 'gap-4' : 'gap-5 md:grid-cols-2 md:items-start')}>
      <TextField label={s.brandName} hint={s.brandHint} value={draft.brandName} onChange={(v) => setDraft({ ...draft, brandName: v })} error={errors.brandName} testId="input-brand" autoComplete="organization" disabled={disabled} />
      <ListField label={d.auth.domains} hint={d.auth.domainsHint} values={draft.ownedDomains} onChange={(v) => setDraft({ ...draft, ownedDomains: v })} error={errors.ownedDomains} addLabel={d.auth.addDomain} max={8} min={1} placeholder="yritys.fi" inputMode="url" testId="input-domain" disabled={disabled} />
      <div className="md:col-span-2">
        <TextField multiline label={s.category} hint={s.categoryHint} value={draft.categoryFi} onChange={(v) => setDraft({ ...draft, categoryFi: v, category: v })} error={errors.categoryFi} testId="input-category" disabled={disabled} lang={normLanguage(draft.promptLanguage)} />
      </div>
      <div className="md:col-span-2">
        <ListField optional label={s.aliases} hint={s.aliasesHint} values={draft.aliases} onChange={(v) => setDraft({ ...draft, aliases: v })} error={errors.aliases} addLabel={d.auth.addAlias} max={8} testId="input-alias" disabled={disabled} />
      </div>
    </div>
  );
}

/** Self-contained create form; optional AI website autofill proposes a draft that must be applied and confirmed explicitly. */
export function CreateProjectForm({ onSubmit, pending, serverErrors, footer, submitLabel }: { onSubmit: (input: ProjectInput) => void; pending: boolean; serverErrors: ProjectErrors; footer?: ReactNode; submitLabel?: string }) {
  const { d, t, plural } = useI18n();
  const [draft, setDraft] = useState<ProjectInput>(emptyProjectInput);
  const [submitted, setSubmitted] = useState(false);
  const [aiSource, setAiSource] = useState<{ domain: string; sources: string[]; market: string; promptLanguage: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const local = submitted ? validateProject(draft, d, t) : {};
  const errors = { ...serverErrors, ...local };
  const aiStale = !!aiSource && (aiSource.market !== normMarket(draft.market) || aiSource.promptLanguage !== normLanguage(draft.promptLanguage));
  const needsConfirm = !!aiSource && (!confirmed || aiStale);
  const count = Object.keys(local).length + (submitted && needsConfirm ? 1 : 0);
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (pending) return;
        if (Object.keys(validateProject(draft, d, t)).length || needsConfirm) return;
        onSubmit(normaliseInput(draft));
      }}
    >
      <MeasurementContextFields
        market={normMarket(draft.market)}
        language={normLanguage(draft.promptLanguage)}
        disabled={pending}
        errors={{ market: errors.market, promptLanguage: errors.promptLanguage }}
        onChange={(ctx) => {
          setDraft({ ...draft, ...ctx });
          // An applied AI draft was reviewed for another context: require a fresh confirmation.
          if (aiSource && (aiSource.market !== ctx.market || aiSource.promptLanguage !== ctx.promptLanguage)) setConfirmed(false);
        }}
      />
      <WebsiteAutofill
        current={draft}
        disabled={pending}
        onApply={(next, meta) => {
          setDraft({ ...next, market: normMarket(draft.market), promptLanguage: normLanguage(draft.promptLanguage) });
          setAiSource({ ...meta, market: normMarket(draft.market), promptLanguage: normLanguage(draft.promptLanguage) });
          setConfirmed(false);
        }}
      />
      <ProjectFields draft={draft} setDraft={setDraft} errors={errors} disabled={pending} />
      {aiSource && (
        <AiProvenance domain={aiSource.domain} sources={aiSource.sources} confirmed={confirmed && !aiStale} onConfirm={setConfirmed} error={submitted && needsConfirm} disabled={pending} />
      )}
      {count > 0 && <p role="alert" className="text-[13px] font-medium text-danger">{plural(d.validation.summary, count)}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="submit" loading={pending} data-testid="button-create-project-submit">{pending ? d.auth.creating : submitLabel ?? d.auth.create}</Button>
        {footer}
      </div>
    </form>
  );
}
