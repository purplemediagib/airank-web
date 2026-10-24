import * as Dialog from '@radix-ui/react-dialog';
import { ChevronsUpDown, Menu, X, LogIn, LogOut, FolderPlus, Wrench, Check, UserRound, Archive as ArchiveIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLogoutApp } from '@workspace/api-client-react';
import { useAccount, SESSION_KEY } from '@/lib/account';
import { markSignedOut } from '@/lib/session-state';
import { useProjectsOptional } from '@/lib/project-context';
import { useCreateProjectFlow } from '@/lib/use-create-project';
import { readApiError, writeErrorMessage } from '@/lib/api-errors';
import { useToast } from '@/hooks/use-toast';
import { fi as fiDict } from '@/i18n/fi';
import { en as enDict } from '@/i18n/en';
import { CreateProjectForm } from './project-form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useI18n, splitLocalePath, LOCALES, type Locale } from '@/i18n';
import { NAV_GROUPS, isActive, currentNav, analyticsNavigationHref, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Wordmark, StatusBadge } from './primitives';
import { useQuickCheckSummary } from '@/lib/quick-check-summary';
import { WebsiteFavicon } from './website-favicon';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearch } from 'wouter';

function MeasurementState() {
  return <>{useQuickCheckSummary().label}</>;
}

const DICT_LOCALE_FAIL: Record<Locale, string> = { fi: fiDict.auth.localeFailed, en: enDict.auth.localeFailed };

function useProjectHref() {
  const { href } = useI18n();
  return useProjectsOptional()?.projectHref ?? href;
}

/* ---------- Language switch (Figma top bar "FI / EN") ---------- */
export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { locale, d, t, setLocale } = useI18n();
  const { authenticated, prefs, savePrefs } = useAccount();
  const { toast } = useToast();
  const choose = (l: Locale) => {
    setLocale(l);
    if (authenticated && prefs && prefs.locale !== l) {
      savePrefs({ locale: l }).catch((err) => toast({ variant: 'destructive', title: DICT_LOCALE_FAIL[l], description: writeErrorMessage(err, d) }));
    }
  };
  return (
    <div role="group" aria-label={d.lang.label} className={cn('inline-flex h-11 items-center rounded-lg border border-line bg-white p-1 md:h-10', compact ? 'w-[86px]' : 'w-[100px]')}>
      {LOCALES.map((l: Locale) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            aria-label={t(d.lang.switchTo, { language: d.lang[l] })}
            onClick={() => !active && choose(l)}
            className={cn(
              'h-full flex-1 rounded-md text-[13px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan',
              active ? 'bg-navy text-white' : 'text-muted-ink hover:bg-canvas hover:text-ink',
            )}
            data-testid={`button-locale-${l}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Project switcher: owner-scoped list, selection persisted to account ---------- */
export function ProjectSwitcher({ className }: { className?: string }) {
  const { d } = useI18n();
  const ctx = useProjectsOptional();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const project = ctx?.project ?? null;
  const archived = ctx?.projects.filter((p) => p.status === 'archived') ?? [];
  const title = ctx?.pending ? d.common.loading : project ? project.brandName : d.project.none;
  const sub = project ? (project.status === 'archived' ? d.auth.archivedBadge : project.ownedDomains[0] ?? '') : d.project.noneSub;
  const pick = (id: string) => { setOpen(false); ctx?.select(id); };
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'group flex h-[68px] w-full flex-col items-start justify-center gap-0.5 rounded-[12px] border border-line bg-white px-3 text-left transition-colors hover:border-[#c9d2e0] hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan data-[state=open]:border-navy',
              className,
            )}
            aria-label={`${d.project.label}: ${title}`}
            data-testid="button-project-switcher"
          >
            <span className="flex w-full min-w-0 items-center gap-2">
              {project && <WebsiteFavicon domain={project.ownedDomains[0]} brand={project.brandName} className="size-6 rounded-md text-[11px]" />}
              <span className="truncate text-sm font-semibold leading-5 text-ink" data-testid="text-active-project">{title}</span>
            </span>
            <span className="flex w-full items-center justify-between gap-2 text-[12px] leading-[17px] text-muted-ink">
              <span className="truncate">{sub}</span>
              <ChevronsUpDown className="size-3.5 shrink-0" aria-hidden />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[300px] rounded-[12px] border-line p-0">
          {!ctx ? (
            <p className="p-4 text-[12px] text-muted-ink">{d.shell.signedOutHint}</p>
          ) : (
            <div className="flex max-h-[420px] flex-col overflow-y-auto">
              <p className="border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-ink">{d.auth.switcherActive}</p>
              {ctx.activeProjects.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-muted-ink">{d.auth.noActive}</p>
              ) : (
                <ul className="p-1.5" role="listbox" aria-label={d.auth.selectProject}>
                  {ctx.activeProjects.map((p) => (
                    <li key={p.id}>
                      <button type="button" role="option" aria-selected={p.id === project?.id} onClick={() => pick(p.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan', p.id === project?.id && 'bg-tint text-navy')} data-testid={`option-project-${p.id}`}>
                        <WebsiteFavicon domain={p.ownedDomains[0]} brand={p.brandName} className="size-8 rounded-md text-[12px]" />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.brandName}</span><span className="block truncate text-[11px] text-muted-ink">{p.ownedDomains.join(', ')}</span></span>
                        {p.id === project?.id && <Check className="size-4 shrink-0" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {archived.length > 0 && (
                <>
                  <p className="border-y border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-ink">{d.auth.switcherArchived}</p>
                  <ul className="p-1.5">
                    {archived.map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => pick(p.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan', p.id === project?.id && 'bg-canvas text-ink')} data-testid={`option-project-${p.id}`}>
                          <ArchiveIcon className="size-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{p.brandName}</span>
                          {p.id === project?.id && <Check className="size-4 shrink-0" aria-hidden />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(
                <div className="border-t border-line p-2">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-link" onClick={() => { setOpen(false); setCreating(true); }} data-testid="button-create-project">
                    <FolderPlus aria-hidden /> {d.auth.newProject}
                  </Button>
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {ctx && <CreateProjectDialog open={creating} onOpenChange={setCreating} />}
    </>
  );
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { d } = useI18n();
  const ctx = useProjectsOptional();
  const flow = useCreateProjectFlow((p) => { onOpenChange(false); ctx?.select(p.id); });
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !flow.pending && onOpenChange(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[12px] border border-line bg-white p-5 shadow-xl focus:outline-none md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Dialog.Title className="text-[20px] font-semibold text-ink">{d.auth.newProject}</Dialog.Title>
              <Dialog.Description className="text-[12px] text-muted-ink">{d.auth.newProjectBody}</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label={d.common.close} disabled={flow.pending}><X aria-hidden /></Button></Dialog.Close>
          </div>
          {flow.message && <p role="alert" className="text-[13px] font-medium text-danger">{flow.message}</p>}
          <CreateProjectForm onSubmit={flow.submit} pending={flow.pending} serverErrors={flow.serverErrors} footer={<Dialog.Close asChild><Button variant="ghost" disabled={flow.pending}>{d.common.cancel}</Button></Dialog.Close>} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---------- Account menu: real session user + logout ---------- */
function AccountMenu() {
  const { d, href } = useI18n();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, writeRequest } = useAccount();
  const phref = useProjectHref();
  const logout = useLogoutApp({ request: { ...writeRequest, body: '{}' }, mutation: { retry: false } });
  const initials = user ? (user.name || user.email).split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase() : '–';
  const doLogout = () =>
    logout.mutate(undefined, {
      onSuccess: async () => {
        await qc.cancelQueries();
        markSignedOut(qc,SESSION_KEY);
        navigate(href('/sign-in'), { replace: true });
      },
      onError: (err) => {
        if (readApiError(err).status === 401) { markSignedOut(qc,SESSION_KEY); navigate(href('/sign-in'), { replace: true }); return; }
        toast({ variant: 'destructive', title: d.auth.logoutFailed, description: writeErrorMessage(err, d) });
      },
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center gap-2.5 rounded-lg px-1 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan"
          aria-label={d.shell.accountMenu}
          data-testid="button-account-menu"
        >
          <span className="grid h-7 w-8 shrink-0 place-items-center rounded-lg bg-tint text-[12px] font-semibold text-link" aria-hidden>{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium leading-4 text-ink" data-testid="text-user-name">{user ? user.name || user.email : d.shell.notSignedIn}</span>
            {user && <span className="block truncate text-[11px] leading-4 text-muted-ink" data-testid="text-user-email">{user.email}</span>}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-[240px] rounded-lg border-line">
        {user ? (
          <>
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-ink">{d.auth.signedInAs}<span className="block truncate text-[13px] font-medium text-ink">{user.email}</span></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { const sh = phref('/settings'); navigate(`${sh}${sh.includes('?') ? '&' : '?'}tab=account`); }} data-testid="menu-account-settings">
              <UserRound className="mr-2 size-4" aria-hidden /> {d.auth.account}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-[12px] font-medium text-muted-ink">{d.shell.guest}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(href('/sign-in'))} data-testid="menu-sign-in">
              <LogIn className="mr-2 size-4" aria-hidden /> {d.shell.signIn}
            </DropdownMenuItem>
          </>
        )}
        {import.meta.env.DEV && (
          <DropdownMenuItem onSelect={() => navigate(href('/dev/components'))} data-testid="menu-dev-playground">
            <Wrench className="mr-2 size-4" aria-hidden /> {d.shell.devPlayground}
          </DropdownMenuItem>
        )}
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={logout.isPending} onSelect={(e) => { e.preventDefault(); doLogout(); }} data-testid="menu-logout">
              <LogOut className="mr-2 size-4" aria-hidden /> {logout.isPending ? d.auth.loggingOut : d.auth.logout}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLink({ item, rest, onNavigate, mobile }: { item: NavItem; rest: string; onNavigate?: () => void; mobile?: boolean }) {
  const { d } = useI18n();
  const href = useProjectHref();
  const search = useSearch();
  const active = isActive(item, rest);
  return (
    <Link
      href={analyticsNavigationHref(href(item.path), rest, search)}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg text-sm font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan',
        mobile ? 'h-11 border px-3' : 'h-[42px] px-3',
        active
          ? 'bg-tint text-navy ' + (mobile ? 'border-[#bfe9f6]' : '')
          : 'text-muted-ink hover:bg-canvas hover:text-ink ' + (mobile ? 'border-line bg-white' : ''),
      )}
      data-testid={`link-nav-${item.key}`}
    >
      {item.icon ? (
        <img src={item.icon} alt="" aria-hidden className={cn('size-[18px] shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100')} />
      ) : item.lucide ? (
        <item.lucide aria-hidden strokeWidth={1.75} className={cn('size-[18px] shrink-0 transition-colors', active ? 'text-navy' : 'text-muted-ink group-hover:text-ink')} />
      ) : (
        <span className="w-[18px] shrink-0" aria-hidden />
      )}
      <span className="truncate">{d.nav[item.key]}</span>
    </Link>
  );
}
function FreeCard() {
  const { d } = useI18n();
  return (
    <div className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-canvas p-3">
      <p className="text-sm font-semibold leading-5 text-navy">{d.shell.freeTitle}</p>
      <p className="text-[12px] leading-[17px] text-muted-ink">{d.shell.freeLine1}</p>
      <p className="text-[12px] leading-[17px] text-muted-ink">{d.shell.freeLine2}</p>
    </div>
  );
}

function NavGroups({ rest, onNavigate, mobile }: { rest: string; onNavigate?: () => void; mobile?: boolean }) {
  const { d } = useI18n();
  const id = useId();
  return (
    <nav aria-label={d.nav.mainNav} className={cn('flex flex-col', mobile ? 'gap-5' : 'gap-2.5')}>
      {NAV_GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`${id}-${group.key}`} className={cn('flex flex-col', mobile ? 'gap-2.5' : 'gap-1.5')}>
          <h2 id={`${id}-${group.key}`} className="text-[10px] font-semibold uppercase leading-[15px] text-muted-ink">{d.nav.groups[group.key]}</h2>
          <ul className={cn('flex flex-col', mobile ? 'gap-1.5' : 'gap-0.5')}>
            {group.items.map((item) => (
              <li key={item.key}><NavLink item={item} rest={rest} onNavigate={onNavigate} mobile={mobile} /></li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/* ---------- Desktop sidebar (Figma 7:13, 232px) ---------- */
function Sidebar({ rest }: { rest: string }) {
  const { d } = useI18n();
  const href = useProjectHref();
  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[232px] shrink-0 flex-col gap-2.5 overflow-y-auto border-r border-line bg-white p-4 lg:flex">
      <Link href={href('/dashboard')} className="flex h-[42px] items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan" aria-label={d.nav.homeLink} data-testid="link-home">
        <Wordmark />
      </Link>
      <ProjectSwitcher />
      <div className="h-3" />
      <NavGroups rest={rest} />
      <div className="min-h-4 flex-1" />
      <FreeCard />
      <AccountMenu />
    </aside>
  );
}

/* ---------- Mobile header + drawer (Figma 11:466 / 16:5698) ---------- */
function MobileHeader({ rest }: { rest: string }) {
  const { d } = useI18n();
  const href = useProjectHref();
  const projectName = useProjectsOptional()?.project?.brandName;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="sticky top-0 z-30 flex h-[70px] items-center gap-3 border-b border-line bg-white px-5 lg:hidden">
      <Link href={href('/dashboard')} aria-label={d.nav.homeLink} className="rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan" data-testid="link-home-mobile">
        <Wordmark size="sm" mark={false} />
      </Link>
      <MobileSection rest={rest} />
      <LanguageSwitch compact />
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button variant="secondary" size="icon" className="w-11" aria-label={d.nav.openMenu} data-testid="button-open-menu">
            <Menu aria-hidden />
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[430px] flex-col overflow-y-auto bg-canvas shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right">
            <div className="sticky top-0 z-10 flex h-[70px] shrink-0 items-center gap-3 border-b border-line bg-white px-5">
              <Wordmark size="sm" mark={false} />
              <div className="flex-1" />
              <LanguageSwitch compact />
              <Dialog.Close asChild>
                <Button variant="secondary" size="icon" className="w-11" aria-label={d.nav.closeMenu} data-testid="button-close-menu">
                  <X aria-hidden />
                </Button>
              </Dialog.Close>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div>
                <Dialog.Title className="text-[26px] font-semibold leading-[38px] text-ink">{d.nav.menu}</Dialog.Title>
                <Dialog.Description className="text-[12px] leading-[17px] text-muted-ink">
                  {projectName ?? d.shell.noProject} · <MeasurementState />
                </Dialog.Description>
              </div>
              <ProjectSwitcher />
              <NavGroups rest={rest} onNavigate={close} mobile />
              <StatusBadge tone="success" className="self-start">{d.shell.freeTitle}</StatusBadge>
              <div className="rounded-[12px] border border-line bg-white p-2">
                <AccountMenu />
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

function MobileSection({ rest }: { rest: string }) {
  const { d } = useI18n();
  const section = currentNav(rest);
  const project = useProjectsOptional()?.project;
  return (
    <div className="flex min-w-0 flex-1 flex-col border-l border-line pl-3 leading-tight" data-testid="text-mobile-section">
      <span className="truncate text-[13px] font-semibold text-ink">{section ? d.nav[section.key] : d.shell.breadcrumbRoot}</span>
      <span className="truncate text-[11px] text-muted-ink">{project?.brandName ?? d.shell.noProject}</span>
    </div>
  );
}

/* ---------- Desktop top bar (Figma 7:78, 64px) ---------- */
function TopBar({ rest }: { rest: string }) {
  const { d } = useI18n();
  const ctx = useProjectsOptional();
  const href = useProjectHref();
  const section = currentNav(rest);
  const deeper = !!section && rest.replace(/\/$/, '') !== section.path;
  return (
    <div className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:flex">
      <nav aria-label={d.nav.breadcrumb} className="min-w-0">
        <ol className="flex items-center gap-2 text-[13px] leading-[19px] text-muted-ink">
          <li>{d.shell.breadcrumbRoot}</li>
          <li aria-hidden>/</li>
          <li className="flex min-w-0 items-center gap-2" aria-current={section ? undefined : 'page'} data-testid="text-breadcrumb-project">
            {ctx?.project && <WebsiteFavicon domain={ctx.project.ownedDomains[0]} brand={ctx.project.brandName} className="size-5 rounded-md text-[10px]" />}
            <span className="truncate">{ctx?.project?.brandName ?? d.shell.noProject}</span>
          </li>
          {section && <li aria-hidden>/</li>}
          {section && (
            <li className="min-w-0" data-testid="text-breadcrumb-section">
              {deeper
                ? <Link href={href(section.path)} className="truncate rounded text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan">{d.nav[section.key]}</Link>
                : <span aria-current="page" className="truncate font-semibold text-ink">{d.nav[section.key]}</span>}
            </li>
          )}
          {deeper && <li aria-hidden>/</li>}
          {deeper && <li aria-current="page" className="text-ink">{d.shell.detail}</li>}
          {ctx?.project?.status === 'archived' && <li><StatusBadge tone="neutral" dot={false}>{d.auth.archivedBadge}</StatusBadge></li>}
        </ol>
      </nav>
      <div className="flex-1" />
      <p className="text-[12px] leading-[17px] text-muted-ink" data-testid="text-data-state"><MeasurementState /></p>
      <LanguageSwitch />
      <StatusBadge tone="success" dot={false} className="w-[92px] justify-center">{d.shell.free}</StatusBadge>
    </div>
  );
}

/** One shell instance persists across every app route and locale change. */
export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { rest } = splitLocalePath(location);
  const { d } = useI18n();

  useEffect(() => {
    const main = document.getElementById('main');
    if (main && document.activeElement === document.body) main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [rest]);

  return (
    <div className="flex min-h-[100dvh] bg-canvas">
      <a href="#main" className="sr-only z-50 rounded-md bg-navy px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {d.nav.skipToContent}
      </a>
      <Sidebar rest={rest} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader rest={rest} />
        <TopBar rest={rest} />
        <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-4 py-6 focus:outline-none sm:px-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
