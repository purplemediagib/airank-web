import { lazy, Suspense, type ReactNode } from 'react';
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary, type ErrorFallbackProps } from '@/components/error-boundary';
import { ErrorState, Panel, LoadingBlock } from '@/components/airank/primitives';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider, getStoredLocale, isLocale, splitLocalePath, DEFAULT_LOCALE, useI18n } from '@/i18n';
import { AppShell } from '@/components/airank/shell';
import { AccountProvider, useAccount, SESSION_KEY } from '@/lib/account';
import { ProjectProvider, useProjects } from '@/lib/project-context';
import { readApiError } from '@/lib/api-errors';
import { markSignedOut } from '@/lib/session-state';
import { PublicEmbedPage, PublicReportPage } from '@/pages/public-check';
import OverviewPage from '@/pages/overview';
import PromptsPage from '@/pages/prompts';
import PromptDetailPage from '@/pages/prompt-detail';
import ResultsPage from '@/pages/results';
import ResultDetailPage from '@/pages/result-detail';
import PerceptionPage from '@/pages/perception';
import CompetitorsPage from '@/pages/competitors';
import CompetitorDetailPage from '@/pages/competitor-detail';
import SourcesPage from '@/pages/sources';
import TrafficPage from '@/pages/traffic';
import EvidencePage from '@/pages/evidence';
import { IndustriesPage, IndustryDetailPage } from '@/pages/industries';
import { OpportunitiesPage, OpportunityDetailPage } from '@/pages/opportunities';
import { ReportsPage, ReportDetailPage } from '@/pages/reports';
const ContentStudio = lazy(() => import('@/features/content'));
function ContentStudioPage() {
  return <Suspense fallback={<Panel className="p-6" aria-busy="true"><LoadingBlock rows={5} /></Panel>}><ContentStudio /></Suspense>;
}
import HistoryPage from '@/pages/history';
import MethodologyPage from '@/pages/methodology';
import PlaygroundPage from '@/pages/playground';
import { SettingsPage, StartPage, NotFoundPage } from '@/pages/forms-pages';
import { SignInPage, RequireAuth, OnboardingPage, SessionPending } from '@/pages/auth-pages';

/** A 401 anywhere expires the session locally and drops all account-scoped cache (no stale cross-owner data). */
function onAuthError(err: unknown) {
  if (readApiError(err).status !== 401) return;
  markSignedOut(queryClient,SESSION_KEY);
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({ onError: onAuthError }),
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: (n, err) => { const s = readApiError(err).status; return s !== null && s >= 500 && n < 1; } },
    mutations: { retry: false },
  },
});

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location} FallbackComponent={AppFallback}>{children}</ErrorBoundary>;
}

/** Localized in-shell fallback; internal error messages are never shown. */
function AppFallback({ resetError }: ErrorFallbackProps) {
  return <ErrorState onRetry={resetError} />;
}

function LocaleRoot() {
  const { locale } = useParams<{ locale: string }>();
  return <Redirect to={`/${isLocale(locale) ? locale : DEFAULT_LOCALE}/dashboard`} replace />;
}

/** Owner-scoped project gate: pending, error and first-run onboarding are distinct states. */
function ProjectGate({ children }: { children: ReactNode }) {
  const { d } = useI18n();
  const { pending, error, project, projects, refetch, contentProject, contentPending, contentError } = useProjects();
  const [location] = useLocation();
  // Published benchmarks are account-wide, not project-scoped: users without a project may still browse them.
  const projectless = /^\/(fi|en)\/dashboard\/industries(\/|$)/.test(location);
  const content = /^\/(fi|en)\/dashboard\/content(?:\/|$)/.test(location);
  if (content) {
    if (contentPending) return <Panel className="p-6" aria-busy="true"><LoadingBlock rows={5} /></Panel>;
    if (contentError) return <Panel><ErrorState body={d.auth.loadFailed} onRetry={refetch} /></Panel>;
    if (!contentProject) return new URLSearchParams(window.location.search).has('project') ? <NotFoundPage /> : <OnboardingPage />;
    return <>{children}</>;
  }
  if (pending && !projectless) return <Panel className="p-6" aria-busy="true"><LoadingBlock rows={5} /></Panel>;
  if (error && !projectless) return <Panel><ErrorState body={d.auth.loadFailed} onRetry={refetch} /></Panel>;
  const requestedProject=new URLSearchParams(window.location.search).get('project');
  if(!pending&&!projectless&&requestedProject&&!projects.some(p=>p.id===requestedProject))return <NotFoundPage />;
  if (!project && !projectless) return <OnboardingPage />;
  return <>{children}</>;
}

/** Route patterns are locale-parameterised, so a locale switch re-renders the same components (no remount). */
function AppRoutes() {
  return (
    <RequireAuth>
      <ProjectProvider>
        <AppShell>
          <RoutedErrorBoundary>
            <ProjectGate>
              <Switch>
                <Route path="/:locale/dashboard" component={OverviewPage} />
                <Route path="/:locale/dashboard/content" component={ContentStudioPage} />
                <Route path="/:locale/dashboard/content/*?" component={ContentStudioPage} />
                <Route path="/:locale/dashboard/prompts" component={PromptsPage} />
                <Route path="/:locale/dashboard/prompts/:id" component={PromptDetailPage} />
                <Route path="/:locale/dashboard/results" component={ResultsPage} />
                <Route path="/:locale/dashboard/results/:id" component={ResultDetailPage} />
                <Route path="/:locale/dashboard/perception" component={PerceptionPage} />
                <Route path="/:locale/dashboard/competitors" component={CompetitorsPage} />
                <Route path="/:locale/dashboard/competitors/:id" component={CompetitorDetailPage} />
                <Route path="/:locale/dashboard/sources" component={SourcesPage} />
                <Route path="/:locale/dashboard/traffic" component={TrafficPage} />
                <Route path="/:locale/dashboard/evidence/:id" component={EvidencePage} />
                <Route path="/:locale/dashboard/industries" component={IndustriesPage} />
                <Route path="/:locale/dashboard/industries/:id" component={IndustryDetailPage} />
                <Route path="/:locale/dashboard/opportunities" component={OpportunitiesPage} />
                <Route path="/:locale/dashboard/opportunities/:id" component={OpportunityDetailPage} />
                <Route path="/:locale/dashboard/history" component={HistoryPage} />
                <Route path="/:locale/dashboard/reports" component={ReportsPage} />
                <Route path="/:locale/dashboard/reports/:id" component={ReportDetailPage} />
                <Route path="/:locale/dashboard/traffic" component={TrafficPage} />
                <Route path="/:locale/dashboard/methodology" component={MethodologyPage} />
                <Route path="/:locale/settings" component={SettingsPage} />
                <Route path="/:locale/start" component={StartPage} />
                {import.meta.env.DEV && <Route path="/:locale/dev/components" component={PlaygroundPage} />}
                <Route path="/:locale" component={LocaleRoot} />
                <Route component={NotFoundPage} />
              </Switch>
            </ProjectGate>
          </RoutedErrorBoundary>
        </AppShell>
      </ProjectProvider>
    </RequireAuth>
  );
}

/** Bare root: explicit URL locale always wins elsewhere; here the saved account locale resolves when signed in. */
function RootRedirect() {
  const { sessionPending, authenticated, prefs, prefsPending } = useAccount();
  if (sessionPending || (authenticated && prefsPending)) return <SessionPending />;
  const locale = (authenticated && prefs?.locale) || getStoredLocale() || DEFAULT_LOCALE;
  return <Redirect to={`/${locale}/dashboard`} replace />;
}

function Root() {
  const [location] = useLocation();
  const { locale, rest } = splitLocalePath(location);
  if (location === '/' || location === '') return <RootRedirect />;
  if (locale && (rest === '/sign-in' || rest === '/sign-up')) return <SignInPage />;
  if (!locale) return <AppShell><NotFoundPage /></AppShell>;
  return <AppRoutes />;
}

/** Public checker routes are isolated: no account session fetch, no shell. */
function PublicOrApp() {
  const [location] = useLocation();
  const m = location.match(/^\/(fi|en)\/(?:(free-check\/embed)|report\/([^/]+))\/?$/);
  if (m) return m[2] ? <PublicEmbedPage locale={m[1] as 'fi' | 'en'} /> : <PublicReportPage locale={m[1] as 'fi' | 'en'} token={m[3]} />;
  return <AccountProvider><Root /></AccountProvider>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <I18nProvider>
            <PublicOrApp />
          </I18nProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
