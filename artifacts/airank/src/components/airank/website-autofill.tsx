import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Check, Globe, Info, Sparkles } from 'lucide-react';
import {
  getGetWebsiteProfileCapabilitiesQueryKey,
  getGetWebsiteProfileQueryKey,
  useCreateWebsiteProfile,
  useGetWebsiteProfile,
  useGetWebsiteProfileCapabilities,
  type ProjectInput,
  type WebsiteProfileJob,
} from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAccount } from '@/lib/account';
import { readApiError } from '@/lib/api-errors';
import { isValidDomain, normLanguage, normMarket, normaliseDomain, normaliseInput, websiteProfileErrorMessage } from '@/lib/project-validate';
import { ProviderContextNotice } from './context-select';
import { TextField } from './forms';
import { StatusBadge } from './primitives';

type Meta = { domain: string; sources: string[] };

const isActive = (j: WebsiteProfileJob | undefined) => j?.status === 'queued' || j?.status === 'running';

/** Website lookup that only ever proposes a draft; nothing is written to the form until the user applies it. */
export function WebsiteAutofill({ current, disabled, onApply }: { current: ProjectInput; disabled?: boolean; onApply: (next: ProjectInput, meta: Meta) => void }) {
  const { d, t } = useI18n();
  const a = d.autofill;
  const { user, writeRequest } = useAccount();
  const owner = user?.id ?? 'anon';

  const caps = useGetWebsiteProfileCapabilities({ query: { queryKey: [...getGetWebsiteProfileCapabilitiesQueryKey(), owner], staleTime: 60_000, retry: false } });
  const enabled = caps.data?.enabled === true;

  const [website, setWebsite] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [job, setJob] = useState<{ id: string; owner: string; market: string; promptLanguage: string } | null>(null);
  const market = normMarket(current.market);
  const promptLanguage = normLanguage(current.promptLanguage);
  const [startError, setStartError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // Identity change drops any in-flight job: a different account never sees or polls another owner's job.
  useEffect(() => {
    setJob(null);
    setStartError(null);
  }, [owner]);

  const create = useCreateWebsiteProfile({ request: writeRequest, mutation: { retry: false } });
  const jobId = job && job.owner === owner ? job.id : '';
  const poll = useGetWebsiteProfile(jobId, {
    query: {
      queryKey: [...getGetWebsiteProfileQueryKey(jobId), owner],
      enabled: !!jobId,
      retry: false,
      refetchOnWindowFocus: false,
      refetchInterval: (q) => (isActive(q.state.data as WebsiteProfileJob | undefined) ? 2000 : false),
    },
  });
  const data = jobId ? poll.data : undefined;
  // A job snapshot for another market/language is discarded, whether still pending or already completed.
  const stale = !!job && (job.market !== market || job.promptLanguage !== promptLanguage);
  const active = create.isPending || (!stale && !!jobId && (!data || isActive(data)) && !poll.isError);

  const lock = useRef(false);
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const start = () => {
    if (lock.current || active || disabled) return;
    const host = normaliseDomain(website);
    if (!host || !isValidDomain(host)) {
      setInputError(a.invalid);
      return;
    }
    setInputError(null);
    setStartError(null);
    setDismissed(null);
    lock.current = true;
    // One fresh submission id per explicit attempt; failures are never replayed automatically.
    const submissionId = crypto.randomUUID();
    const sentOwner = owner;
    const sent = { market, promptLanguage };
    create.mutate(
      { data: { website: website.trim(), submissionId, ...sent } },
      {
        onSuccess: (j) => { lock.current = false; if (sentOwner === ownerRef.current) setJob({ id: j.id, owner: sentOwner, market: normMarket(j.market ?? sent.market), promptLanguage: normLanguage(j.promptLanguage ?? sent.promptLanguage) }); },
        onError: (err) => { lock.current = false; setJob(null); setStartError(websiteProfileErrorMessage(readApiError(err).code, d)); },
      },
    );
  };

  const failure = stale ? null : startError ?? (data?.status === 'failed' ? websiteProfileErrorMessage(data.error, d) : poll.isError ? websiteProfileErrorMessage(readApiError(poll.error).code, d) : null);
  const ready = !stale && data?.status === 'completed' && data.draft && dismissed !== data.id ? data : null;

  if (caps.isPending) {
    return <div className="h-[132px] animate-pulse rounded-[12px] border border-line bg-canvas" aria-hidden data-testid="autofill-skeleton" />;
  }

  if (!enabled) {
    return (
      <div className="flex items-start gap-3 rounded-[12px] border border-line bg-canvas px-4 py-3" role="note" data-testid="text-autofill-unavailable">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-ink" aria-hidden />
        <p className="text-[13px] leading-[19px] text-muted-ink">{a.unavailable}</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-line bg-canvas p-4 md:p-5" aria-labelledby="autofill-title" data-testid="section-autofill">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-navy ring-1 ring-line"><Sparkles className="size-4" aria-hidden /></span>
        <div className="flex flex-col gap-1">
          <h3 id="autofill-title" className="text-[15px] font-semibold leading-[22px] text-ink">{a.title}</h3>
          <p className="text-[13px] leading-[19px] text-muted-ink">{a.lead}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <TextField
            label={a.website}
            hint={a.websiteHint}
            value={website}
            onChange={(v) => { setWebsite(v); if (inputError) setInputError(null); }}
            error={inputError ?? undefined}
            placeholder="https://www.yritys.fi"
            inputMode="url"
            autoComplete="url"
            disabled={disabled || active}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); start(); } }}
            testId="input-autofill-website"
          />
        </div>
        <Button type="button" variant="secondary" className="md:mt-[27px] md:h-11" onClick={start} loading={active} disabled={disabled || active || !website.trim()} data-testid="button-autofill-run">
          {active ? (data?.status === 'queued' ? a.queued : a.running) : failure ? a.retry : a.run}
        </Button>
      </div>

      {stale && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2.5 text-[13px] text-warning" role="status" data-testid="text-autofill-stale">
          <AlertCircle className="size-4 shrink-0" aria-hidden />{d.auth.autofillStale}
        </p>
      )}

      {active && !stale && (
        <p className="flex items-center gap-2 text-[13px] text-muted-ink" role="status" aria-live="polite" data-testid="status-autofill">
          <Globe className="size-4 shrink-0" aria-hidden />
          {data?.domain ? `${data.domain} – ${data.status === 'queued' ? a.queued : a.running}` : a.running}
        </p>
      )}

      {failure && !active && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-white px-3 py-2.5" role="alert" data-testid="text-autofill-error">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div className="flex flex-col gap-0.5 text-[13px] leading-[19px]">
            <p className="font-medium text-danger">{failure}</p>
            <p className="text-muted-ink">{a.manual}</p>
          </div>
        </div>
      )}

      {ready && ready.draft && (
        <DraftCompare
          job={ready}
          draft={ready.draft}
          current={current}
          disabled={disabled}
          onDiscard={() => setDismissed(ready.id)}
          onApply={(next) => {
            setDismissed(ready.id);
            onApply(next, { domain: ready.domain, sources: ready.sources ?? [] });
          }}
          t={t}
        />
      )}
    </section>
  );
}

function DraftCompare({ job, draft, current, disabled, onApply, onDiscard, t }: {
  job: WebsiteProfileJob; draft: ProjectInput; current: ProjectInput; disabled?: boolean; onApply: (next: ProjectInput) => void; onDiscard: () => void; t: (s: string, v?: Record<string, string | number>) => string;
}) {
  const { d } = useI18n();
  const a = d.autofill;
  const s = d.settings;
  const proposed = normaliseInput({ ...draft, ownedDomains: draft.ownedDomains.length ? draft.ownedDomains : [job.domain] });
  const now = normaliseInput(current);
  const rows: { key: string; label: string; now: string; next: string; lang?: string }[] = [
    { key: 'brand', label: s.brandName, now: now.brandName, next: proposed.brandName },
    { key: 'domains', label: d.auth.domains, now: now.ownedDomains.join(', '), next: proposed.ownedDomains.join(', ') },
    { key: 'category', label: s.category, now: now.categoryFi, next: proposed.categoryFi, lang: normLanguage(current.promptLanguage) },
    { key: 'aliases', label: s.aliases, now: now.aliases.join(', '), next: proposed.aliases.join(', ') },
  ];
  const hasExisting = rows.some((r) => r.now);
  return (
    <div className="ar-rise flex flex-col gap-3 rounded-lg border border-line bg-white p-4" data-testid="panel-autofill-draft">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="info">{a.draftReady}</StatusBadge>
        <span className="text-[13px] text-muted-ink" data-testid="text-autofill-domain">{t(a.draftFrom, { domain: job.domain })}</span>
      </div>
      {hasExisting && <p className="text-[13px] leading-[19px] text-muted-ink">{a.draftCompare}</p>}
      <dl className="flex flex-col divide-y divide-line">
        {rows.map((r) => {
          const changed = r.now !== r.next;
          return (
            <div key={r.key} className="grid grid-cols-1 gap-1 py-2.5 md:grid-cols-[160px_1fr] md:gap-4">
              <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-ink">{r.label}</dt>
              <dd className="flex flex-col gap-1 text-sm">
                {hasExisting && changed && (
                  <span className="text-muted-ink line-through decoration-muted-ink/50" lang={r.lang}><span className="sr-only">{a.current}: </span>{r.now || a.empty}</span>
                )}
                <span className={cn('font-medium', changed ? 'text-ink' : 'text-muted-ink')} lang={r.lang} data-testid={`text-autofill-${r.key}`}>
                  {hasExisting && <span className="sr-only">{a.proposed}: </span>}{r.next || a.empty}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onApply({ ...proposed, ownedDomains: proposed.ownedDomains.length ? proposed.ownedDomains : [''] })} disabled={disabled} data-testid="button-autofill-apply">
          <Check aria-hidden /> {a.apply}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDiscard} disabled={disabled} data-testid="button-autofill-discard">{a.discard}</Button>
      </div>
    </div>
  );
}

/** Provenance of an applied AI draft plus the mandatory review confirmation. */
export function AiProvenance({ domain, sources, confirmed, onConfirm, error, disabled }: { domain: string; sources: string[]; confirmed: boolean; onConfirm: (v: boolean) => void; error: boolean; disabled?: boolean }) {
  const { d, t } = useI18n();
  const a = d.autofill;
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-3 rounded-[12px] border bg-canvas p-4', error ? 'border-danger' : 'border-line')} data-testid="panel-ai-provenance">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="info" dot={false}><Sparkles className="size-3.5" aria-hidden /> {a.applied}</StatusBadge>
        <span className="text-[13px] text-muted-ink">{t(a.draftFrom, { domain })}</span>
      </div>
      {sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-ink">{a.sources}</p>
          <ul className="flex flex-col gap-0.5">
            {sources.slice(0, 8).map((src, i) => (
              <li key={src + i} className="truncate font-mono text-[12px] text-ink" title={src} data-testid={`text-ai-source-${i}`}>{src}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-start gap-3">
        <Checkbox id={id} checked={confirmed} disabled={disabled} onCheckedChange={(v) => onConfirm(v === true)} aria-invalid={error || undefined} aria-describedby={error ? `${id}-err` : undefined} className="mt-0.5" data-testid="checkbox-ai-confirm" />
        <label htmlFor={id} className="text-[13px] leading-[19px] text-ink">{a.confirm}</label>
      </div>
      {error && <p id={`${id}-err`} role="alert" className="flex items-center gap-1.5 text-[12px] font-medium text-danger"><AlertCircle className="size-3.5 shrink-0" aria-hidden />{a.confirmRequired}</p>}
      <ProviderContextNotice />
    </div>
  );
}
