import { type ReactNode } from 'react';
import { Link, Redirect, useLocation, useSearch } from 'wouter';
import { Check } from 'lucide-react';
import { useDocumentTitle, useI18n } from '@/i18n';
import { useAccount } from '@/lib/account';
import { useProjects } from '@/lib/project-context';
import { googleStartUrl, safeReturnPath, localizedReturnPath } from '@/lib/return-path';
import { readApiError } from '@/lib/api-errors';
import { useCreateProjectFlow } from '@/lib/use-create-project';
import { Panel, DisabledAction, ReasonNote, StatusBadge, Wordmark, Skeleton, ErrorState, PageHeader } from '@/components/airank/primitives';
import { CreateProjectForm } from '@/components/airank/project-form';
import { LanguageSwitch } from '@/components/airank/shell';
import { Button } from '@/components/ui/button';
import { EmailAuthForm } from '@/components/airank/email-auth-form';

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  const { d, href } = useI18n();
  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="flex h-[70px] items-center gap-3 border-b border-line bg-white px-5">
        <Link href={href('/dashboard')} aria-label={d.nav.homeLink}><Wordmark size="sm" /></Link>
        <div className="flex-1" />
        <LanguageSwitch compact />
      </header>
      <main id="main" className="grid flex-1 place-items-center p-5">{children}</main>
    </div>
  );
}

/** Full-screen skeleton while the session resolves; never flashes protected content. */
export function SessionPending() {
  const { d } = useI18n();
  return (
    <div className="flex min-h-[100dvh] bg-canvas" aria-busy="true">
      <div className="hidden w-[232px] shrink-0 flex-col gap-3 border-r border-line bg-white p-4 lg:flex">
        <Skeleton className="h-[42px] w-32" />
        <Skeleton className="h-[68px] w-full rounded-[12px]" />
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[34px] w-full" />)}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-8">
        <p className="sr-only" role="status">{d.auth.checking}</p>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="mt-4 h-48 w-full rounded-[12px]" />
      </div>
    </div>
  );
}

function SessionUnavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { d } = useI18n();
  const code = readApiError(error).code;
  return (
    <AuthFrame>
      <Panel className="w-full max-w-[460px]">
        <ErrorState title={d.auth.unavailableTitle} body={code === 'APP_NOT_CONFIGURED' ? d.auth.notConfigured : d.auth.unavailableBody} onRetry={onRetry} />
        <div className="px-6 pb-6">
          <DisabledAction reason={d.auth.unavailableBody} className="w-full" data-testid="button-google-sign-in"><GoogleMark /> {d.auth.google}</DisabledAction>
        </div>
      </Panel>
    </AuthFrame>
  );
}

function currentReturnPath(location: string) {
  const search = window.location.search;
  return safeReturnPath(`${location}${search}${window.location.hash}`) ?? null;
}

/** Guards dashboard/start/settings. Unauthenticated users go to sign-in with a safe return path. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { sessionPending, sessionError, authenticated, refetchSession } = useAccount();
  const { href } = useI18n();
  const [location] = useLocation();
  if (sessionPending) return <SessionPending />;
  if (sessionError) return <SessionUnavailable error={sessionError} onRetry={refetchSession} />;
  if (!authenticated) {
    const rt = currentReturnPath(location);
    return <Redirect to={`${href('/sign-in')}${rt ? `?return_to=${encodeURIComponent(rt)}` : ''}`} replace />;
  }
  return <>{children}</>;
}

export function SignInPage() {
  const { d, href, locale } = useI18n();
  const a = d.auth;
  useDocumentTitle(d.signin.title);
  const { session, sessionPending, sessionError, authenticated, refetchSession } = useAccount();
  const params = new URLSearchParams(useSearch());
  const returnTo = localizedReturnPath(params.get('return_to'),locale);
  const oauthFailed = params.get('error') === 'oauth_failed';

  if (authenticated) return <Redirect to={returnTo} replace />;

  const unavailable = !!sessionError;
  const code = readApiError(sessionError).code;
  const loginAvailable = !!session?.loginAvailable && !unavailable;

  return (
    <div className="flex min-h-[100dvh] flex-col gap-6 bg-canvas p-5 md:p-10 xl:p-16">
      <Link href={href('/dashboard')} aria-label={d.nav.homeLink} className="self-start rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan"><Wordmark /></Link>
      <div><LanguageSwitch /></div>
      <main id="main" className="grid flex-1 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,600px)_minmax(0,560px)] lg:gap-16">
        <section className="ar-rise flex flex-col gap-6 lg:p-10" aria-labelledby="signin-benefits">
          <h2 id="signin-benefits" className="text-[30px] font-semibold leading-[42px] text-navy md:text-[38px] md:leading-[55px]">
            <span className="block">{a.signinHeadline1}</span>
            <span className="block">{a.signinHeadline2}</span>
          </h2>
          <p className="max-w-[500px] text-[18px] leading-[26px] text-muted-ink">{a.signinLead}</p>
          <ul className="flex flex-col text-[18px] leading-[26px] text-ink">
            {a.signinBenefits.map((b) => (
              <li key={b} className="flex items-center gap-3"><Check className="size-[18px] shrink-0 text-success" aria-hidden />{b}</li>
            ))}
          </ul>
        </section>
        <section className="ar-rise flex w-full flex-col gap-5 rounded-[12px] border border-line bg-white p-6 md:p-10" aria-labelledby="signin-title">
          <h1 id="signin-title" className="text-[28px] font-semibold leading-[41px] text-ink" data-testid="text-page-title">{a.signinTitle}</h1>
          <p className="text-[15px] leading-[22px] text-muted-ink">{a.signinSubtitle}</p>
          {!sessionPending && !unavailable && <EmailAuthForm available={session?.emailLoginAvailable === true} returnTo={returnTo} />}
          {oauthFailed && !unavailable && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] font-medium text-danger" data-testid="text-oauth-error">{a.oauthFailed}</p>}
          {sessionPending ? (
            <Skeleton className="h-10 w-full" />
          ) : unavailable ? (
            <>
              <div role="alert" className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2.5 text-[13px] text-warning" data-testid="text-session-unavailable">
                <p className="font-semibold">{a.unavailableTitle}</p>
                <p>{code === 'APP_NOT_CONFIGURED' ? a.notConfigured : a.unavailableBody}</p>
              </div>
              <DisabledAction reason={a.unavailableBody} className="w-full" data-testid="button-google-sign-in"><GoogleMark /> {a.google}</DisabledAction>
              <Button variant="secondary" className="w-full" onClick={refetchSession} data-testid="button-retry-session">{d.common.retry}</Button>
            </>
          ) : loginAvailable ? (
            <Button asChild className="w-full gap-2.5">
              <a href={googleStartUrl(returnTo)} data-testid="button-google-sign-in"><span className="grid size-6 place-items-center rounded bg-white"><GoogleMark /></span> {a.google}</a>
            </Button>
          ) : (
            <>
              <DisabledAction reason={a.loginUnavailable} className="w-full" data-testid="button-google-sign-in"><GoogleMark /> {a.google}</DisabledAction>
              <ReasonNote>{a.loginUnavailable}</ReasonNote>
            </>
          )}
          <p className="text-[13px] leading-[19px] text-muted-ink">{a.signinHelper}</p>
          <div className="h-px w-full bg-line" />
          <p className="text-[13px] leading-[19px] text-muted-ink">{a.signinTerms}</p>
          <p className="text-[12px] leading-[17px] text-muted-ink">{a.signinMarketing}</p>
        </section>
      </main>
    </div>
  );
}

/** First-run (or all-archived) state, composed as the Figma empty dashboard; persists via one POST before the dashboard opens. */
export function OnboardingPage() {
  const { d, href } = useI18n();
  const a = d.auth;
  const { projects, select } = useProjects();
  const [, navigate] = useLocation();
  useDocumentTitle(a.onboardTitle);
  const flow = useCreateProjectFlow((p) => {
    select(p.id);
    navigate(`${href('/dashboard')}?project=${encodeURIComponent(p.id)}`, { replace: true });
  });
  const allArchived = projects.length > 0;
  return (
    <>
      <PageHeader title={d.nav.overview} subtitle={a.gettingStarted} />
      <section className="ar-rise flex flex-col gap-6 rounded-[12px] border border-line bg-white p-6 md:p-12" aria-labelledby="onboard-title">
        <StatusBadge tone="info" dot={false} className="self-start uppercase tracking-wide">{a.readyBadge}</StatusBadge>
        <h2 id="onboard-title" className="max-w-[840px] text-[30px] font-semibold leading-[42px] text-navy md:text-[38px] md:leading-[55px]">
          {allArchived ? a.noActive : (<><span className="block">{a.readyHeadline1}</span><span className="block">{a.readyHeadline2}</span></>)}
        </h2>
        <p className="max-w-[720px] text-[18px] leading-[26px] text-muted-ink">{allArchived ? a.noActiveBody : a.readyBody}</p>
        <div className="max-w-[860px]">
          {flow.message && <p role="alert" className="mb-4 text-[13px] font-medium text-danger" data-testid="text-create-error">{flow.message}</p>}
          <CreateProjectForm onSubmit={flow.submit} pending={flow.pending} serverErrors={flow.serverErrors} />
        </div>
        <div className="h-px w-full bg-line" />
        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {a.steps.map(([title, body]) => (
            <li key={title} className="flex flex-col gap-3">
              <p className="whitespace-pre text-[18px] font-semibold leading-[26px] text-ink">{title}</p>
              <p className="text-sm text-muted-ink">{body}</p>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-[13px] leading-[19px] text-muted-ink">{a.historyNote}</p>
    </>
  );
}
