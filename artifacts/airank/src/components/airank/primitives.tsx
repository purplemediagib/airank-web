import { type ReactNode, useId } from 'react';
import { AlertTriangle, Info, RefreshCw, Inbox, Construction } from 'lucide-react';
import logoMark from '@/assets/4711e.svg';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/* ---------- Wordmark (Figma 7:14 / 21:1475: logo mark + Figtree Bold "airank" navy + ".me" cyan) ---------- */
export function Wordmark({ size = 'lg', mark = true, className }: { size?: 'lg' | 'sm'; mark?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="airank.me">
      {mark && (
        <img
          src={logoMark}
          alt=""
          aria-hidden
          className={size === 'lg' ? 'h-[27px] w-[30px]' : 'h-[20px] w-[23px]'}
        />
      )}
      <span
        aria-hidden
        className={cn('font-bold tracking-[-0.01em]', size === 'lg' ? 'text-[27px] leading-[39px]' : 'text-[22px] leading-8')}
      >
        <span className="text-navy">airank</span>
        <span className="text-cyan">.me</span>
      </span>
    </span>
  );
}

/* ---------- Status badge (Figma 5:68–5:74) ---------- */
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';
const toneClass: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-danger-bg text-danger',
  info: 'bg-tint text-link',
  neutral: 'bg-canvas text-muted-ink border border-line',
};
const toneDot: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
  info: 'bg-link',
  neutral: 'bg-muted-ink',
};
export function StatusBadge({ tone, children, dot = true, className, ...rest }: { tone: Tone; children: ReactNode; dot?: boolean; className?: string; 'data-testid'?: string }) {
  return (
    <span
      className={cn('inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium leading-5', toneClass[tone], className)}
      {...rest}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', toneDot[tone])} />}
      {children}
    </span>
  );
}

/* ---------- Card ---------- */
export function Panel({ children, className, as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string }) {
  return (
    <As className={cn('rounded-[12px] border border-line bg-white', className)} {...rest}>
      {children}
    </As>
  );
}

/* ---------- Page header (Figma 7:87) ---------- */
export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="ar-rise flex flex-col gap-4 md:flex-row md:items-start">
      <div className="min-w-0 flex-1">
        {back}
        <h1 className="text-[26px] font-semibold leading-[38px] text-ink md:text-[28px] md:leading-[41px]" data-testid="text-page-title">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-[800px] text-sm leading-5 text-muted-ink">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-start gap-2">{actions}</div>}
    </header>
  );
}

/* ---------- Disabled action with an explained reason ---------- */
export function DisabledAction({ reason, children, ...props }: ButtonProps & { reason: string }) {
  const id = useId();
  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button {...props} aria-disabled="true" aria-describedby={id} onClick={(e) => e.preventDefault()}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px] text-[12px] leading-[17px]">{reason}</TooltipContent>
      </Tooltip>
      <span id={id} className="sr-only">
        {reason}
      </span>
    </span>
  );
}

export function ReasonNote({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-[17px]',
        tone === 'info' ? 'bg-tint text-[#0a5f75]' : 'bg-warning-bg text-warning',
      )}
    >
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ---------- Loading / empty / error ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('ar-skeleton block', className)} />;
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  const { d } = useI18n();
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 p-5">
      <span className="sr-only">{d.common.loading}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-1/5" />
          <Skeleton className="ml-auto h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, icon, action, compact }: { title: string; body?: string; icon?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-center', compact ? 'px-4 py-6' : 'px-6 py-10')} data-testid="state-empty">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-canvas text-muted-ink ring-1 ring-line">
        {icon ?? <Inbox className="size-[18px]" aria-hidden />}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="max-w-[420px] text-[12px] leading-[17px] text-muted-ink">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, body, onRetry, retrying }: { title?: string; body?: string; onRetry?: () => void; retrying?: boolean }) {
  const { d } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center" data-testid="state-error">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="size-[18px]" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{title ?? d.errors.title}</p>
      <p className="max-w-[420px] text-[12px] leading-[17px] text-muted-ink">{body ?? d.errors.body}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry} loading={retrying} data-testid="button-retry">
          {!retrying && <RefreshCw aria-hidden />}
          {d.common.retry}
        </Button>
      )}
    </div>
  );
}

/* ---------- Development state for feature routes ---------- */
export function DevelopmentNotice({ batch, scope, entity, tab }: { batch: string; scope: string; entity?: string; tab?: string }) {
  const { d, t } = useI18n();
  return (
    <Panel className="ar-rise ar-rise-2 overflow-hidden" as="div">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-warning-bg text-warning">
          <Construction className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold leading-6 text-ink">{d.dev.title}</h2>
            <StatusBadge tone="warning" data-testid="status-batch">{t(d.dev.batch, { batch })}</StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-5 text-ink">{t(d.dev.body, { batch, scope })}</p>
          <p className="mt-1 text-[12px] leading-[17px] text-muted-ink">{d.dev.honesty}</p>
          {(entity || tab) && (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] leading-[17px]">
              {entity && (
                <div className="flex gap-2">
                  <dt className="text-muted-ink">{d.dev.entity}</dt>
                  <dd className="break-all font-mono text-ink" data-testid="text-entity-id">{entity}</dd>
                </div>
              )}
              {tab && (
                <div className="flex gap-2">
                  <dt className="text-muted-ink">{d.dev.tab}</dt>
                  <dd className="text-ink">{tab}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </Panel>
  );
}
