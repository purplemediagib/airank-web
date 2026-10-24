import type { PublicReport } from '@/lib/public-check-api';
import { C, fmt, fmtTime, safeUrl, type Loc } from './copy';
import { ProviderMark } from '../airank/provider-brand';
import { isSuccessfulMeasurement, measurementLabel } from '@/lib/measurement-status';

export function StatusBadge({ status, loc }: { status: PublicReport['status']; loc: Loc }) {
  const c = C[loc];
  const m = { queued: [c.statusQueued, 'bg-tint text-link'], running: [c.statusRunning, 'bg-tint text-link'], completed: [c.statusCompleted, 'bg-success-bg text-success'], partial: [c.statusPartial, 'bg-warning-bg text-warning'], failed: [c.statusFailed, 'bg-danger-bg text-danger'] }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${m[1]}`}>{m[0]}</span>;
}

export function ProgressBar({ report, loc }: { report: PublicReport; loc: Loc }) {
  const c = C[loc]; const { completed, expected } = report.progress;
  const pct = expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-muted-ink"><span>{c.progress}</span><span className="tabular">{fmt(c.answers, { c: completed, e: expected })}</span></div>
      <div role="progressbar" aria-label={c.progress} aria-valuemin={0} aria-valuemax={expected} aria-valuenow={completed} className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-cyan transition-[width]" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function ReportView({ report, loc, full = true }: { report: PublicReport; loc: Loc; full?: boolean }) {
  const c = C[loc]; const s = report.score; const ins = report.insight;
  const terminal = report.status === 'completed' || report.status === 'partial';
  const insText = ins.kind === 'mentions' ? fmt(c.insMentions, { m: ins.mentions, v: ins.valid_answers }) : ins.kind === 'no_mentions' ? fmt(c.insNone, { v: ins.valid_answers }) : c.insInsufficient;
  const obsFor = (pid: string) => report.observations.filter(o => o.prompt_id === pid);
  return (
    <div className="space-y-6">
      <section className="rounded-card border border-line bg-white p-5 sm:p-6" aria-labelledby="pc-score">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 id="pc-score" className="text-sm font-semibold text-muted-ink">{c.score}</h2><p className="mt-0.5 break-words text-sm text-muted-ink">{report.brand_name} · {report.domain}</p></div>
          <StatusBadge status={report.status} loc={loc} />
        </div>
        {!terminal && report.status !== 'failed' && <div className="mt-4"><ProgressBar report={report} loc={loc} /></div>}
        {report.status === 'failed' && <p className="mt-4 rounded-lg bg-danger-bg p-3 text-sm text-danger" role="alert">{c.failedNote}</p>}
        {(terminal || s.valid_answers > 0) && (
          <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="tabular rounded-lg bg-tint px-5 py-3 text-5xl font-bold text-navy">{s.value === null ? <span aria-label={c.na}>{c.na}</span> : s.value.toFixed(1)}<span className="ml-2 text-base font-medium text-muted-ink">{fmt(c.outOf, { n: s.out_of })}</span></div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-line p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">{loc === 'fi' ? 'Maininnat' : 'Mentions'}</p><p className="tabular text-2xl font-bold text-navy">{s.mentions} / {s.valid_answers}</p><p className="text-xs text-muted-ink">{loc === 'fi' ? 'kelvollista vastausta' : 'valid answers'}</p></div>
              <div className="rounded-lg border border-line p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">{loc === 'fi' ? 'Palvelut' : 'Providers'}</p><p className="tabular text-2xl font-bold text-navy">{s.providers_measured} / {s.providers_requested}</p><p className="text-xs text-muted-ink">{loc === 'fi' ? 'mitattu' : 'measured'}</p></div>
            </div>
          </div>
        )}
        {report.status === 'partial' && <p className="mt-4 rounded-lg bg-warning-bg p-3 text-sm text-warning">{c.partialNote}</p>}
        <p className="mt-4 text-xs text-muted-ink">{c.started}: {fmtTime(report.created_at, loc)} · {c.finished}: {fmtTime(report.finished_at, loc)}</p>
      </section>

      {terminal && (
        <section className="rounded-xl border border-line bg-tint/60 p-5 sm:p-6" aria-labelledby="pc-insight">
          <h2 id="pc-insight" className="font-semibold text-navy">{c.insight}</h2>
          <p className="mt-1 text-ink">{insText}</p>
          <p className="mt-2 text-sm text-muted-ink">{c.unsupported}</p>
        </section>
      )}

      {report.providers.length > 0 && (
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="pc-prov">
          <h2 id="pc-prov" className="font-semibold text-navy">{c.visByModel}</h2>
          <p className="mb-3 text-xs text-muted-ink">{c.sample}</p>
          <ul className="divide-y divide-line">
            {report.providers.map(p => (
              <li key={p.provider} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <div className="min-w-0"><p className="font-medium text-ink"><ProviderMark provider={p.provider} /></p>
                  {p.score !== null && <div className="my-1 h-2 w-40 max-w-full overflow-hidden rounded-full bg-line" aria-hidden="true"><div className="h-full bg-cyan" style={{ width: `${Math.max(0, Math.min(100, (p.score / s.out_of) * 100))}%` }} /></div>}
                  <p className="break-words text-xs text-muted-ink">{c.models}: {p.models.length ? p.models.join(', ') : c.modelUnknown}</p></div>
                <div className="text-right text-sm tabular"><p className="font-semibold text-navy">{p.score === null ? c.na : `${p.score.toFixed(1)} / ${s.out_of}`}</p>
                  <p className="text-xs text-muted-ink">{fmt(c.mentions, { m: p.mentions, v: p.valid_answers })}{p.unavailable_answers > 0 && ` · ${fmt(c.unavailableAns, { n: p.unavailable_answers })}`}</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {full && report.prompts.length > 0 && (
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="pc-full">
          <h2 id="pc-full" className="font-semibold text-navy">{c.prompts}</h2>
          <ol className="mt-3 space-y-5">
            {[...report.prompts].sort((a, b) => a.sequence - b.sequence).map(p => (
              <li key={p.id} className="min-w-0">
                <p className="break-words font-medium text-ink"><span className="tabular text-muted-ink">{p.sequence}. </span>{p.text}</p>
                <ul className="mt-2 space-y-2">
                  {obsFor(p.id).map(o => {
                    const ok = isSuccessfulMeasurement(o.status);
                    return (
                      <li key={o.id} className="rounded-lg border border-line bg-canvas p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-ink"><ProviderMark provider={o.provider} /></span><span className="text-muted-ink">{o.model ?? c.modelUnknown}</span>
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${!ok ? 'bg-warning-bg text-warning' : o.brand_mentioned ? 'bg-success-bg text-success' : 'bg-line text-muted-ink'}`}>{!ok ? measurementLabel(o.status, loc === 'fi') : o.brand_mentioned ? c.mentioned : c.notMentioned}</span></div>
                        {o.response_text && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{o.response_text}</p>}
                        {o.citations.length > 0 && (
                          <div className="mt-2 text-xs"><span className="font-semibold text-muted-ink">{c.citations}: </span>
                            {o.citations.map((ci, i) => { const u = safeUrl(ci.url); const t = ci.domain + (ci.owned ? ` (${c.owned})` : ''); return (
                              <span key={i} className="mr-2 inline-block break-all">{u ? <a href={u} target="_blank" rel="noopener noreferrer" className="text-link underline">{t}</a> : <span>{t}</span>}</span>); })}
                          </div>)}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      {terminal && report.methodology && (
        <section className="rounded-xl border border-line bg-white p-5 text-sm text-muted-ink sm:p-6"><h2 className="mb-1 font-semibold text-navy">{c.method}</h2><p className="whitespace-pre-wrap break-words">{report.methodology}</p></section>
      )}
    </div>
  );
}
