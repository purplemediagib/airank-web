import { Link, useLocation } from 'wouter';
import { useProjects } from '@/lib/project-context';
import { splitLocalePath } from '@/i18n';
import { ErrorState, LoadingBlock, Panel, PageHeader } from '@/components/airank/primitives';
import { cn } from '@/lib/utils';
import { StudioProvider, useContentProjectId, useStudio } from './studio';
import { useErr, useTx } from './ui';
import { OverviewView } from './overview';
import { OpportunitiesView } from './opportunities';
import { LibraryView } from './library';
import { NewContentView } from './new-content';
import { EditorView } from './editor';
import { DocJobView } from './doc-job';
import { PerceptionView } from './perception';
import { SourcesView } from './sources';
import { ImpactView } from './impact';
import { SettingsView } from './settings';
import { JobsView, JobDetailView } from './jobs';

const TABS = [
  ['', 'Overview', 'Yleiskatsaus'], ['/opportunities', 'Opportunities', 'Mahdollisuudet'], ['/library', 'Content library', 'Sisältökirjasto'],
  ['/perception', 'AI perception', 'Tekoälyn brändikuva'], ['/sources', 'Sources', 'Lähteet'], ['/impact', 'Impact', 'Vaikutus'], ['/jobs', 'Jobs', 'Työt'], ['/settings', 'Settings', 'Asetukset'],
] as const;

function Tabs({ sub }: { sub: string }) {
  const s = useStudio(); const tx = useTx();
  const active = (p: string) => (p === '' ? sub === '' : sub === p || sub.startsWith(p + '/'));
  return (
    <nav aria-label={tx('Content Studio sections', 'Sisältöstudion osiot')} className="-mx-1 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.map(([p, en, fi]) => (
          <li key={p}>
            <Link href={s.ph('/dashboard/content' + p)} aria-current={active(p) ? 'page' : undefined} data-testid={`tab-content-${p.slice(1) || 'overview'}`}
              className={cn('inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan', active(p) ? 'border-navy text-navy' : 'border-transparent text-muted-ink hover:text-ink')}>{tx(en, fi)}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Body({ sub }: { sub: string }) {
  const seg = sub.split('/').filter(Boolean);
  const [a, b, c] = seg;
  if (!a) return <OverviewView />;
  if (a === 'opportunities') return <OpportunitiesView />;
  if (a === 'library') return <LibraryView />;
  if (a === 'new') return <NewContentView />;
  if (a === 'documents' && b) return c ? <DocJobView id={b} mode={c} /> : <EditorView id={b} />;
  if (a === 'perception') return <PerceptionView />;
  if (a === 'sources') return <SourcesView />;
  if (a === 'impact') return <ImpactView />;
  if (a === 'jobs') return b ? <JobDetailView id={b} /> : <JobsView />;
  if (a === 'settings') return <SettingsView />;
  return <NotFoundInner />;
}
function NotFoundInner() { const tx = useTx(); return <ErrorState title={tx('Page not found', 'Sivua ei löytynyt')} />; }

export default function ContentStudioPage() {
  const tx = useTx(); const err = useErr();
  const pid = useContentProjectId();
  const [location] = useLocation();
  const { rest } = splitLocalePath(location);
  const sub = rest.replace(/^\/dashboard\/content/, '').replace(/\/$/, '');
  if (!pid) return <Panel className="p-6"><ErrorState title={tx('No project selected', 'Projektia ei ole valittu')} /></Panel>;
  return (
    <StudioProvider key={pid} projectId={pid} fallback={({ pending, error, retry }) => pending
      ? <Panel className="p-6" aria-busy="true"><LoadingBlock rows={5} /></Panel>
      : <Panel><ErrorState title={tx('Content Studio could not load', 'Sisältöstudiota ei voitu ladata')} body={err(error)} onRetry={retry} /></Panel>}>
      <StudioFrame sub={sub} />
    </StudioProvider>
  );
}
function StudioFrame({ sub }: { sub: string }) {
  const tx = useTx(); const s = useStudio();
  const roleLabel = { owner: tx('Owner', 'Omistaja'), editor: tx('Editor', 'Muokkaaja'), reviewer: tx('Reviewer', 'Tarkastaja'), viewer: tx('Viewer', 'Katselija') }[s.role];
  const isDoc = sub.startsWith('/documents/');
  const pr = useProjects() as any;
  const list: any[] = pr.contentProjects ?? [];
  return (
    <div className="flex flex-col gap-5">
      {!isDoc && <PageHeader title={tx('Content Studio', 'Sisältöstudio')} subtitle={`${s.overview.project?.brandName ?? ''} · ${tx('Your role', 'Roolisi')}: ${roleLabel}`} />}
      {list.length > 1 && !isDoc && (
        <div className="flex items-center gap-2 text-sm"><label htmlFor="cs-project" className="text-muted-ink">{tx('Workspace', 'Työtila')}</label>
          <select id="cs-project" className="h-10 rounded-lg border border-line bg-white px-3 text-sm" value={s.projectId} onChange={(e) => pr.select(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{p.brandName}</option>)}</select></div>
      )}
      <Tabs sub={sub} />
      <Body sub={sub} />
    </div>
  );
}
