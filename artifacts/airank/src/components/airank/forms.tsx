import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/i18n';
import { useQueryParam } from '@/lib/use-query-param';
import { cn } from '@/lib/utils';

/* ---------- Field (Figma 20:1551: 13px label, 44px input) ---------- */
export function TextField({
  label,
  hint,
  error,
  success,
  optional,
  multiline,
  value,
  onChange,
  testId,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  hint?: string;
  error?: string;
  success?: string;
  optional?: boolean;
  multiline?: boolean;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  const { d } = useI18n();
  const id = useId();
  const msgId = `${id}-msg`;
  const hintId = `${id}-hint`;
  const base = cn(
    'w-full rounded-lg border bg-white px-3 text-sm font-medium text-ink placeholder:font-normal placeholder:text-muted-ink transition-colors focus-visible:outline-none focus-visible:ring-[3px] disabled:bg-canvas disabled:text-muted-ink',
    error ? 'border-danger focus-visible:ring-danger/25' : success ? 'border-success focus-visible:ring-cyan/60' : 'border-line hover:border-[#c9d2e0] focus-visible:border-navy focus-visible:ring-cyan/60',
  );
  const describedBy = [hint ? hintId : null, error || success ? msgId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium leading-[19px] text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-ink">({d.common.optional})</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(base, 'min-h-[88px] py-2.5 leading-5')}
          data-testid={testId}
          placeholder={rest.placeholder}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(base, 'h-11')}
          data-testid={testId}
          {...rest}
        />
      )}
      {hint && !error && (
        <p id={hintId} className="text-[12px] leading-[17px] text-muted-ink">
          {hint}
        </p>
      )}
      {error && (
        <p id={msgId} className="flex items-center gap-1.5 text-[12px] leading-[17px] text-danger" role="alert">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {!error && success && (
        <p id={msgId} className="flex items-center gap-1.5 text-[12px] leading-[17px] text-success">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          {success}
        </p>
      )}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, disabled, testId }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; testId: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium leading-[19px] text-ink">{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink transition-colors hover:border-[#c9d2e0] focus-visible:border-navy focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan/60 disabled:bg-canvas disabled:text-muted-ink"
        data-testid={testId}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ---------- Confirmation dialog (Radix: focus trap, escape, restore focus) ---------- */
export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel, onConfirm, destructive, trigger }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; body: string; confirmLabel: string; onConfirm: () => void; destructive?: boolean; trigger: ReactNode }) {
  const { d } = useI18n();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-[440px] rounded-[12px] border-line">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[18px] font-semibold text-ink">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-ink">{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-10 rounded-lg border-line" data-testid="button-dialog-cancel">{d.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn('h-10 rounded-lg', destructive ? 'bg-danger hover:bg-[#9e3340]' : 'bg-navy hover:bg-ink')}
            data-testid="button-dialog-confirm"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------- Sub-tabs bound to ?tab= so deep links / back / locale switch keep the tab ---------- */
export function SubTabs({ tabs, fallback, label, children }: { tabs: { value: string; label: string }[]; fallback: string; label: string; children: (tab: string) => ReactNode }) {
  const [raw, setTab] = useQueryParam('tab', fallback);
  const tab = tabs.some((t) => t.value === raw) ? raw : fallback;
  return (
    <TabsPrimitive.Root value={tab} onValueChange={setTab} className="flex flex-col gap-4">
      <TabsPrimitive.List aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {tabs.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className="relative -mb-px h-11 shrink-0 whitespace-nowrap rounded-t-md px-3 text-sm font-medium text-muted-ink transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-cyan data-[state=active]:text-navy after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-navy"
            data-testid={`tab-${t.value}`}
          >
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      <TabsPrimitive.Content value={tab} className="focus-visible:outline-none">
        {children(tab)}
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}
