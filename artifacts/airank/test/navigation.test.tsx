import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/airank/shell';
import { I18nProvider } from '@/i18n';
import { NAV_GROUPS, currentNav, isActive, analyticsNavigationHref } from '@/lib/nav';
import { resultParamsFromSearch, resultsContextQuery } from '@/lib/sentiment';

vi.mock('@/lib/account', () => ({
  SESSION_KEY: ['session'],
  useAccount: () => ({ authenticated: false, user: null, prefs: null, writeRequest: {} }),
}));
vi.mock('@workspace/api-client-react', () => ({
  useLogoutApp: () => ({ isPending: false }),
}));
vi.mock('@/lib/project-context', () => ({
  useProjectsOptional: () => ({
    project: { id: 'project-42', brandName: 'Current project', ownedDomains: ['example.com'], status: 'active' },
    projects: [],
    activeProjects: [],
    projectHref: (path: string) => `/${window.location.pathname.split('/')[1]}${path}?project=project-42`,
  }),
}));
vi.mock('@/lib/quick-check-summary', () => ({
  useQuickCheckSummary: () => ({ label: 'No measurements yet' }),
}));
vi.mock('@/lib/use-create-project', () => ({
  useCreateProjectFlow: () => ({ pending: false }),
}));

const expectedGroups = [
  ['overview', 'prompts', 'results', 'competitors', 'sources', 'perception', 'traffic', 'reports', 'history'],
  ['content', 'opportunities', 'industries'],
  ['methodology', 'settings'],
];
const expectedPaths: Record<string, string> = {
  overview: '/dashboard',
  prompts: '/dashboard/prompts',
  results: '/dashboard/results',
  competitors: '/dashboard/competitors',
  sources: '/dashboard/sources',
  perception: '/dashboard/perception',
  traffic: '/dashboard/traffic',
  reports: '/dashboard/reports',
  history: '/dashboard/history',
  content: '/dashboard/content',
  opportunities: '/dashboard/opportunities',
  industries: '/dashboard/industries',
  methodology: '/dashboard/methodology',
  settings: '/settings',
};

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

function renderShell(locale: string, path = '/dashboard/evidence/source-1', query = '') {
  window.history.replaceState({}, '', `/${locale}${path}?project=project-42${query ? `&${query}` : ''}`);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider><AppShell><p>Page content</p></AppShell></I18nProvider>
    </QueryClientProvider>,
  );
}

function assertGroups(nav: HTMLElement, labels: string[], locale: string) {
  expect(within(nav).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(labels);
  labels.forEach((label, index) => {
    const group = within(nav).getByRole('region', { name: label });
    const links = within(group).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('data-testid'))).toEqual(
      expectedGroups[index].map((key) => `link-nav-${key}`),
    );
    links.forEach((link, linkIndex) => {
      const key = expectedGroups[index][linkIndex];
      expect(link.getAttribute('href')).toBe(`/${locale}${expectedPaths[key]}?project=project-42`);
      expect(link.getAttribute('aria-current')).toBe(key === 'sources' ? 'page' : null);
    });
  });
}

it('keeps all routes exactly once in the shared group configuration and preserves nested matching', () => {
  expect(NAV_GROUPS.map((group) => group.items.map((item) => item.key))).toEqual(expectedGroups);
  const items = NAV_GROUPS.flatMap((group) => group.items);
  expect(items.map((item) => item.path)).toEqual(expectedGroups.flat().map((key) => expectedPaths[key]));
  items.forEach((item) => {
    expect(isActive(item, item.path)).toBe(true);
    expect(isActive(item, `${item.path}/detail`)).toBe(item.key !== 'overview');
    expect(isActive(item, `${item.path}-other`)).toBe(false);
    expect(isActive(item, '/dashboard/evidence/source-1')).toBe(item.key === 'sources');
  });
  expect(isActive(items[0], '/dashboard/')).toBe(true);
  expect(currentNav('/dashboard/prompts/prompt-42')?.key).toBe('prompts');
  expect(currentNav('/dashboard/evidence/source-1')?.key).toBe('sources');
  expect(currentNav('/dashboard/traffic')?.key).toBe('traffic');
});

it.each(Object.values(expectedPaths))('keeps named main-navigation and breadcrumb landmarks on %s', (path) => {
  renderShell('en', path);
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
  expect(screen.getByTestId('text-mobile-section').textContent).toContain('Current project');
  expect(screen.getByTestId('text-breadcrumb-section').textContent).toBeTruthy();
});

it('carries only measurement context across analytics navigation and materializes preset UTC dates for results', () => {
  const tags=JSON.stringify(['pricing','research, discovery']);
  const source=new URLSearchParams({range:'7',provider:'openai',topic:'Research',tag:'legacy',tags,tagMode:'and',market:'FI',language:'en',surface:'consumer_web',promptId:'p',promptVersion:'2',group:'group-v2',page:'4',src:'drawer',answer:'answer',q:'search',state:'failed'});
  const result=analyticsNavigationHref('/en/dashboard/results?project=project-42','/dashboard',String(source),new Date('2026-04-05T19:00:00Z'));
  const p=new URL(result,'https://test.invalid').searchParams;
  expect(Object.fromEntries(p)).toEqual({project:'project-42',from:'2026-03-30',to:'2026-04-05',provider:'openai',topic:'Research',tag:'legacy',tags,tagMode:'and',market:'FI',language:'en',surface:'consumer_web',promptId:'p',promptVersion:'2',group:'group-v2'});
  expect(resultParamsFromSearch(String(p))).toMatchObject({group:'group-v2',surface:'consumer_web',tags,from:'2026-03-30',to:'2026-04-05'});
  expect(new URLSearchParams(resultsContextQuery(String(p))).get('group')).toBe('group-v2');
  for(const target of ['/dashboard','/dashboard/sources','/dashboard/competitors','/dashboard/perception']){
    const next=analyticsNavigationHref(`/en${target}?project=project-42`,'/dashboard/results/detail',String(p));
    expect(new URL(next,'https://test.invalid').searchParams.get('group')).toBe('group-v2');
    expect(new URL(next,'https://test.invalid').searchParams.get('surface')).toBe('consumer_web');
  }
  for(const target of ['/dashboard/traffic','/settings','/dashboard/methodology','/dashboard/prompts']){
    expect(analyticsNavigationHref(`/en${target}?project=project-42`,'/dashboard',String(source))).toBe(`/en${target}?project=project-42`);
  }
  expect(analyticsNavigationHref('/en/dashboard/results?project=project-42','/dashboard/traffic',String(source))).toBe('/en/dashboard/results?project=project-42');
});

it('resolves latest analytics composition on results without leaking its sentinel back to analytics',()=>{
  const result=analyticsNavigationHref('/fi/dashboard/results?project=p','/dashboard/sources','surface=consumer_web',new Date('2026-04-05T00:00:00Z'));
  const p=new URL(result,'https://test.invalid').searchParams;
  expect(p.get('group')).toBe('latest');expect(p.get('from')).toBe('2026-03-09');expect(p.get('to')).toBe('2026-04-05');
  const overview=analyticsNavigationHref('/fi/dashboard?project=p','/dashboard/results',String(p));
  expect(new URL(overview,'https://test.invalid').searchParams.has('group')).toBe(false);
});

it('desktop and mobile shared links retain analytics scope but not administration or traffic filters',async()=>{
  const user=userEvent.setup();
  renderShell('en','/dashboard','range=7&surface=consumer_web&tags=%5B%22pricing%22%5D&tagMode=and&market=FI&language=en&group=chosen&page=8&answer=old');
  const desktop=document.querySelector('aside')!;
  const check=(root:HTMLElement)=>{
    for(const key of ['overview','results','sources','competitors','perception']){
      const p=new URL(within(root).getByTestId(`link-nav-${key}`).getAttribute('href')!,'https://test.invalid').searchParams;
      expect(p.get('surface')).toBe('consumer_web');expect(p.get('group')).toBe('chosen');
      expect(p.get('tags')).toBe('["pricing"]');expect(p.get('market')).toBe('FI');expect(p.get('language')).toBe('en');
      expect(p.has('page')).toBe(false);expect(p.has('answer')).toBe(false);
      if(key==='results'){expect(p.has('from')).toBe(true);expect(p.has('to')).toBe(true);expect(p.has('range')).toBe(false);}
    }
    expect(within(root).getByTestId('link-nav-traffic').getAttribute('href')).toBe('/en/dashboard/traffic?project=project-42');
    expect(within(root).getByTestId('link-nav-settings').getAttribute('href')).toBe('/en/settings?project=project-42');
  };
  check(desktop);
  await user.click(screen.getByTestId('button-open-menu'));
  check(screen.getByRole('dialog'));
  await user.click(within(screen.getByRole('dialog')).getByTestId('link-nav-results'));
  expect(window.location.pathname).toBe('/en/dashboard/results');
  expect(new URLSearchParams(window.location.search).get('group')).toBe('chosen');
});

it.each([
  ['en', ['Analytics', 'Improvement', 'Administration']],
  ['fi', ['Analytiikka', 'Kehittäminen', 'Hallinta']],
] as const)('uses localized groups and project-aware links in desktop and mobile navigation (%s)', async (locale, labels) => {
  const user = userEvent.setup();
  renderShell(locale);
  const desktop = document.querySelector('aside')!;
  const navName = locale === 'fi' ? 'Päänavigaatio' : 'Main navigation';
  assertGroups(within(desktop).getByRole('navigation', { name: navName }), [...labels], locale);
  expect(within(desktop).getByTestId('text-active-project').textContent).toBe('Current project');
  expect(screen.getByTestId('text-mobile-section').textContent).toContain('Current project');
  expect(screen.getByTestId('text-breadcrumb-section').textContent).toBe(locale === 'fi' ? 'Lähteet' : 'Sources');

  await user.click(screen.getByTestId('button-open-menu'));
  const dialog = screen.getByRole('dialog');
  assertGroups(within(dialog).getByRole('navigation', { name: navName }), [...labels], locale);
  expect(within(dialog).getByTestId('button-project-switcher')).toBeTruthy();
  expect(within(dialog).getByTestId('text-active-project').textContent).toBe('Current project');

  await user.click(within(dialog).getByTestId('link-nav-opportunities'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(window.location.pathname).toBe(`/${locale}/dashboard/opportunities`);
  expect(window.location.search).toBe('?project=project-42');
});
