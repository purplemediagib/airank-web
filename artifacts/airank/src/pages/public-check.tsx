import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';
import {
  PublicCheckError, usePreparePublicProfile, usePreviewPublicScan, usePublicCapabilities, usePublicReport, usePublicScan, useStartPublicScan,
  type PublicPreview, type PublicProfile,
} from '@/lib/public-check-api';
import { C, errText, normalizeDomain, validDomain, fmt, providerName, type Loc } from '@/components/public/copy';
import { ReportView } from '@/components/public/report-view';
import { EmailPanel } from '@/components/public/email-panel';
import { canEmailPublicReport } from '@/components/public/report-policy';

/** Isolated client: no account-error handlers, no shared cache with signed-in app. */
export const publicQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });

const STORE = 'airank.public-scan';
const readStore = (): { id: string; token: string } | null => { try { const v = JSON.parse(sessionStorage.getItem(STORE) ?? 'null'); return v?.id && v?.token ? v : null; } catch { return null; } };
const writeStore = (v: { id: string; token: string } | null) => { try { v ? sessionStorage.setItem(STORE, JSON.stringify(v)) : sessionStorage.removeItem(STORE); } catch { /* storage unavailable */ } };
const uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};

function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'warn' }) {
  return <p role="alert" className={`rounded-lg p-3 text-sm ${tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'}`}>{children}</p>;
}
function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-ink">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-muted-ink">{hint}</span>}{error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}</label>;
}
const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink" />;

/** Posts height only to the verified embedding origin; never any user data. */
function useEmbedResize(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let origin: string | null = null;
    try { const o = new URL(document.referrer).origin; if (o === 'https://airank.me' || o === 'https://www.airank.me') origin = o; } catch { /* no referrer */ }
    if (!origin || window.parent === window || !ref.current) return;
    let last = 0, raf = 0; const target = origin;
    const post = () => { raf = 0; const h = Math.ceil(ref.current!.getBoundingClientRect().height); if (h === last) return; last = h; window.parent.postMessage({ type: 'airank:resize', height: Math.max(300, h) }, target); };
    const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(post); });
    ro.observe(ref.current); post();
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [ref]);
}
function postScroll() {
  try { const o = new URL(document.referrer).origin; if ((o === 'https://airank.me' || o === 'https://www.airank.me') && window.parent !== window) window.parent.postMessage({ type: 'airank:scroll-to-widget' }, o); } catch { /* ignore */ }
}

function Checker({ loc }: { loc: Loc }) {
  const c = C[loc];
  const qc = useQueryClient();
  const caps = usePublicCapabilities();
  const prepare = usePreparePublicProfile(); const previewM = usePreviewPublicScan(); const startM = useStartPublicScan();
  const [stage, setStage] = useState<'form' | 'review' | 'preview'>('form');
  const [website, setWebsite] = useState(''); const [market, setMarket] = useState('FI'); const [lang, setLang] = useState<string>(loc);
  const [brand, setBrand] = useState(''); const [aliases, setAliases] = useState(''); const [category, setCategory] = useState(''); const [domain, setDomain] = useState('');
  const [touched, setTouched] = useState(false);
  const editRevision = useRef(0);
  const contextKey = [domain, market, lang].join('|');
  const latestContext = useRef(contextKey); latestContext.current = contextKey;
  const scrolledScan = useRef<string | null>(null);
  useEffect(() => { setSug(null); }, [domain, market, lang]);
  const [sug, setSug] = useState<PublicProfile | null>(null);
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [guest, setGuest] = useState(readStore);
  const submission = useRef<{ hash: string; id: string } | null>(null);
  const scan = usePublicScan(guest?.id ?? null, guest?.token ?? null);

  useEffect(() => { track('checker_view', loc, 'view'); }, [loc]);
  // Defaults from capabilities: market FI if offered, else first; language matches route if offered.
  const capsInit = useRef(false);
  useEffect(() => {
    if (!caps.data || capsInit.current) return; capsInit.current = true;
        const l = caps.data.languages; if (l.length && !l.some(x => x.code === loc)) setLang(l[0].code);
  }, [caps.data, loc]);

  const report = scan.data;
  const terminal = report && (report.status === 'completed' || report.status === 'partial' || report.status === 'failed');
  useEffect(() => {
    if (!report || !guest) return;
    if (report.status === 'completed') track('checker_completed', loc, guest.id);
    if (report.status === 'partial') track('checker_partial', loc, guest.id);
    if ((report.status === 'completed' || report.status === 'partial') && scrolledScan.current !== guest.id) { scrolledScan.current = guest.id; postScroll(); }
  }, [report, guest, loc]);
  useEffect(() => { if (scan.error instanceof PublicCheckError && scan.error.status === 404 && guest) { writeStore(null); } }, [scan.error, guest]);

  const rootRef = useRef<HTMLDivElement>(null);
  void rootRef;

  const edit = (set: (v: string) => void) => (v: string) => { editRevision.current++; setTouched(true); set(v); };
  const aliasList = useMemo(() => aliases.split(/[\n,]/).map(a => a.trim()).filter(Boolean).slice(0, 10), [aliases]);
  const nd = normalizeDomain(website);
  const profile = (): PublicProfile => ({ domain: domain.trim(), brand_name: brand.trim(), aliases: aliasList, category_fi: category.trim(), market, language: lang });

  const toReview = (e: React.FormEvent) => { e.preventDefault(); if (!validDomain(nd)) return; setDomain(nd); setStage('review'); setPreview(null); };
  const autofill = () => {
    if (prepare.isPending) return;
    const revision = editRevision.current, key = contextKey;
    prepare.mutate({ website: domain || nd, market, language: lang }, { onSuccess: r => {
      if (revision === editRevision.current && key === latestContext.current) setSug(r.draft);
    } });
  };
  const applySug = () => { if (!sug) return; setBrand(sug.brand_name); setAliases(sug.aliases.join(', ')); setCategory(sug.category_fi); setSug(null); setTouched(true); };
  const doPreview = (e: React.FormEvent) => {
    e.preventDefault(); if (previewM.isPending) return;
    previewM.mutate(profile(), { onSuccess: p => { setPreview(p); setConfirmed(false); setStage('preview'); if (submission.current?.hash !== p.preview_hash) submission.current = null; } });
  };
  const doStart = () => {
    if (!preview || !confirmed || startM.isPending) return;
    if (!submission.current || submission.current.hash !== preview.preview_hash) submission.current = { hash: preview.preview_hash, id: uid() };
    startM.mutate({ ...preview.profile, preview_hash: preview.preview_hash, methodology: preview.methodology, profile_confirmed: true, submission_id: submission.current.id }, {
      onSuccess: r => { const g = { id: r.id, token: r.scan_token }; writeStore(g); setGuest(g); track('checker_started', loc, r.id); },
    });
  };
  const reset = useCallback(() => {
    writeStore(null); setGuest(null); setPreview(null); setStage('form'); setConfirmed(false); setSug(null); submission.current = null;
    prepare.reset(); previewM.reset(); startM.reset();
    qc.removeQueries({ queryKey: ['public-check', 'scan'] }); qc.removeQueries({ queryKey: ['public-check', 'delivery'] });
  }, [qc, prepare, previewM, startM]);

  if (caps.isPending) return <div aria-busy="true" role="status" className="space-y-3"><div className="ar-skeleton h-10" /><div className="ar-skeleton h-10" /><div className="ar-skeleton h-24" /><span className="sr-only">{c.loading}</span></div>;
  if (caps.isError) return <div className="space-y-3"><Alert>{caps.error instanceof PublicCheckError && caps.error.status === 429 ? c.eLimit : c.capsError}</Alert><Button variant="secondary" onClick={() => void caps.refetch()}>{c.retryBtn}</Button></div>;
  if (!caps.data.enabled) return <Alert tone="warn">{c.disabled}</Alert>;
  const cp = caps.data;
  if (!cp.markets.some(m => m.code === 'FI')) return <Alert tone="warn">{c.noFinland}</Alert>;

  // Active or restored scan
  if (guest) {
    if (scan.isError && (!report || (scan.error instanceof PublicCheckError && [401, 403, 404].includes(scan.error.status)))) return <div className="space-y-3"><Alert>{scan.error instanceof PublicCheckError && scan.error.status === 429 ? c.eLimit : scan.error instanceof PublicCheckError && [401, 403, 404].includes(scan.error.status) ? c.eExpired : errText(scan.error, c)}</Alert><Button variant="secondary" onClick={() => void scan.refetch()}>{c.retryBtn}</Button><Button onClick={reset}>{c.newCheck}</Button></div>;
    if (!report) return <div aria-busy="true" role="status"><div className="ar-skeleton h-40" /><span className="sr-only">{c.loading}</span></div>;
    const canEmail = canEmailPublicReport(cp, report);
    return (
      <div className="space-y-6">
        <div role="status" aria-live="polite" className="sr-only">{report.status}</div>
        <ReportView report={report} loc={loc} />
        {canEmail && <EmailPanel id={guest.id} token={guest.token} loc={loc} caps={cp} />}
        {terminal && <section className="rounded-xl border border-line bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-6"><div><h2 className="font-semibold text-navy">{c.ctaTitle}</h2><p className="text-sm text-muted-ink">{c.ctaBody}</p></div>
          <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${loc}/sign-up`} target="_top" className="mt-3 inline-flex h-10 items-center rounded-md bg-navy px-4 text-sm font-semibold text-white sm:mt-0">{c.signup}</a></section>}
        {terminal && <Button variant="secondary" onClick={reset}>{c.newCheck}</Button>}
      </div>
    );
  }

  const startErr = startM.error;
  return (
    <div className="rounded-xl border border-line bg-white p-5 sm:p-8">
      <h1 className="text-2xl font-bold text-navy">{c.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-ink">{c.lead}</p>

      {stage === 'form' && (
        <form onSubmit={toReview} className="mt-5 max-w-xl space-y-4 rounded-card border border-line bg-white p-4 sm:p-5" noValidate>
          <Field label={c.website.toUpperCase()} hint={c.websiteHint} error={website && !validDomain(nd) ? c.domainBad : undefined}>
            <Input value={website} onChange={e => setWebsite(e.target.value)} inputMode="url" autoComplete="url" placeholder="https://example.fi" required maxLength={300} aria-invalid={Boolean(website) && !validDomain(nd)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={c.market}><Select value={market} onChange={e => setMarket(e.target.value)}>{cp.markets.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</Select></Field>
            <Field label={c.language}><Select value={lang} onChange={e => setLang(e.target.value)}>{cp.languages.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</Select></Field>
          </div>
          <Button type="submit" className="w-full" disabled={!validDomain(nd)}>{c.checkBtn} →</Button>
          <p className="text-xs text-muted-ink">{c.formNote}</p>
        </form>
      )}

      {stage === 'review' && (
        <form onSubmit={doPreview} className="mt-5 space-y-4">
          <h2 className="font-semibold text-ink">{c.reviewTitle}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={c.brand} hint={c.brandHint}><Input value={brand} onChange={e => edit(setBrand)(e.target.value)} required maxLength={120} /></Field>
            <Field label={c.domain}><Input value={domain} onChange={e => edit(setDomain)(e.target.value)} onBlur={() => setDomain(normalizeDomain(domain))} required maxLength={253} /></Field>
            <Field label={c.category} hint={c.categoryHint}><Input value={category} onChange={e => edit(setCategory)(e.target.value)} required maxLength={160} /></Field>
            <Field label={c.aliases} hint={c.aliasesHint}><textarea value={aliases} onChange={e => edit(setAliases)(e.target.value)} rows={2} maxLength={500} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm" /></Field>
          </div>
          {cp.autofillEnabled && (
            <div className="rounded-lg border border-line bg-canvas p-3">
              <Button type="button" variant="secondary" onClick={autofill} disabled={prepare.isPending}>{prepare.isPending ? c.autofilling : c.autofill}</Button>
              <p className="mt-2 text-xs text-muted-ink">{c.autofillNote}</p>
              {prepare.isError && <div className="mt-2"><Alert>{errText(prepare.error, c)}</Alert></div>}
              {sug && (
                <div role="status" className="mt-3 rounded-md bg-tint p-3 text-sm"><p className="font-semibold text-navy">{c.suggestions}</p>
                  <dl className="mt-1 space-y-0.5 break-words"><div><dt className="inline font-medium">{c.brand}: </dt><dd className="inline">{sug.brand_name}</dd></div><div><dt className="inline font-medium">{c.category}: </dt><dd className="inline">{sug.category_fi}</dd></div>{sug.aliases.length > 0 && <div><dt className="inline font-medium">{c.aliases}: </dt><dd className="inline">{sug.aliases.join(', ')}</dd></div>}</dl>
                  <div className="mt-2 flex gap-2"><Button type="button" size="sm" onClick={applySug}>{c.apply}</Button><Button type="button" size="sm" variant="secondary" onClick={() => setSug(null)}>{c.dismiss}</Button></div>
                </div>)}
            </div>
          )}
          {previewM.isError && <Alert>{errText(previewM.error, c)}</Alert>}
          <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => setStage('form')}>{c.back}</Button>
            <Button type="submit" disabled={previewM.isPending || !validDomain(normalizeDomain(domain)) || !brand.trim() || !category.trim()}>{previewM.isPending ? c.previewing : c.preview}</Button></div>
          {touched && null}
        </form>
      )}

      {stage === 'preview' && preview && (
        <div className="mt-5 space-y-4">
          <h2 className="font-semibold text-ink">{c.previewTitle}</h2>
          <p className="text-sm text-muted-ink">{c.previewLead}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">{preview.prompts.map((p, i) => <li key={i} className="break-words">{p}</li>)}</ol>
          <p className="text-sm"><span className="font-medium">{c.providers}: </span>{preview.providers.map(p => providerName(p)).join(', ')}</p>
          <p className="text-xs text-muted-ink">{fmt(c.paidCalls, { n: preview.paid_calls })}</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#181f6b]" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>{c.confirm}</span></label>
          {startErr && <Alert>{errText(startErr, c)} {startErr instanceof PublicCheckError && startErr.status !== 429 && startErr.status < 400 + 100 && c.retryStart}</Alert>}
          <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => setStage('review')} disabled={startM.isPending}>{c.back}</Button>
            <Button type="button" onClick={doStart} disabled={!confirmed || startM.isPending}>{startM.isPending ? c.starting : startM.isError ? c.retryBtn : c.start}</Button></div>
        </div>
      )}
    </div>
  );
}

export function PublicEmbedPage({ locale }: { locale: Loc }) {
  const ref = useRef<HTMLDivElement>(null);
  useEmbedResize(ref);
  useEffect(() => { document.title = C[locale].title; document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; }, [locale]);
  return (
    <div ref={ref} className="mx-auto w-full max-w-[1260px] p-1 text-ink">
      <QueryClientProvider client={publicQueryClient}><Checker loc={locale} /></QueryClientProvider>
    </div>
  );
}

function ReportBody({ loc, token }: { loc: Loc; token: string }) {
  const c = C[loc]; const q = usePublicReport(token);
  useEffect(() => { document.title = c.reportTitle; }, [c]);
  useEffect(() => { if (q.data) track('report_opened', loc, 'opened'); }, [q.data, loc]);
  const valid = /^[A-Za-z0-9_-]{40,100}$/.test(token);
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3"><span className="font-bold text-navy">AI Rank</span><span className="text-xs text-muted-ink">{c.reportBy}</span></div></header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div><h1 className="text-2xl font-bold text-navy">{c.reportTitle}</h1><p className="text-sm text-muted-ink">{c.reportLead}</p></div>
        {!valid || (q.isError && q.error instanceof PublicCheckError && [400, 401, 403, 404, 410].includes(q.error.status)) ? <Alert>{c.invalidLink}</Alert>
          : q.isError ? <div className="space-y-3"><Alert>{errText(q.error, c)}</Alert><Button variant="secondary" onClick={() => void q.refetch()}>{c.retryBtn}</Button></div>
          : q.isPending ? <div aria-busy="true" role="status" className="space-y-3"><div className="ar-skeleton h-40" /><div className="ar-skeleton h-24" /><span className="sr-only">{c.loading}</span></div>
          : <><ReportView report={q.data} loc={loc} />
            <section className="rounded-xl border border-line bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-6"><div><h2 className="font-semibold text-navy">{c.ctaTitle}</h2><p className="text-sm text-muted-ink">{c.ctaBody}</p></div>
              <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${loc}/sign-up`} className="mt-3 inline-flex h-10 items-center rounded-md bg-navy px-4 text-sm font-semibold text-white sm:mt-0">{c.signup}</a></section></>}
      </main>
    </div>
  );
}
export function PublicReportPage({ locale, token }: { locale: Loc; token: string }) {
  return <QueryClientProvider client={publicQueryClient}><ReportBody loc={locale} token={token} /></QueryClientProvider>;
}
