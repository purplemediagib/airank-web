import overviewIcon from '@/assets/753ce.svg';
import promptsIcon from '@/assets/2667d.svg';
import competitorsIcon from '@/assets/8ed4b.svg';
import sourcesIcon from '@/assets/c83cf.svg';
import industriesIcon from '@/assets/401fb.svg';
import opportunitiesIcon from '@/assets/01670.svg';
import historyIcon from '@/assets/45e74.svg';
import reportsIcon from '@/assets/5c9db.svg';
import type { Dict } from '@/i18n';
import { MessageSquareText, Sparkles, LineChart, BookOpen, PenLine, Settings, type LucideIcon } from 'lucide-react';

export type NavKey = keyof Pick<
  Dict['nav'],
  'overview' | 'content' | 'traffic' | 'prompts' | 'results' | 'perception' | 'competitors' | 'sources' | 'industries' | 'opportunities' | 'history' | 'reports' | 'methodology' | 'settings'
>;

export interface NavItem {
  key: NavKey;
  path: string;
  icon?: string;
  lucide?: LucideIcon;
}

export interface NavGroup {
  key: keyof Dict['nav']['groups'];
  items: NavItem[];
}

/** Icons are the actual Figma vector frames from the overview sidebar (5:82). */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'analytics',
    items: [
      { key: 'overview', path: '/dashboard', icon: overviewIcon },
      { key: 'prompts', path: '/dashboard/prompts', icon: promptsIcon },
      { key: 'results', path: '/dashboard/results', lucide: MessageSquareText },
      { key: 'competitors', path: '/dashboard/competitors', icon: competitorsIcon },
      { key: 'sources', path: '/dashboard/sources', icon: sourcesIcon },
      { key: 'perception', path: '/dashboard/perception', lucide: Sparkles },
      { key: 'traffic', path: '/dashboard/traffic', lucide: LineChart },
      { key: 'reports', path: '/dashboard/reports', icon: reportsIcon },
      { key: 'history', path: '/dashboard/history', icon: historyIcon },
    ],
  },
  {
    key: 'improvement',
    items: [
      { key: 'content', path: '/dashboard/content', lucide: PenLine },
      { key: 'opportunities', path: '/dashboard/opportunities', icon: opportunitiesIcon },
      { key: 'industries', path: '/dashboard/industries', icon: industriesIcon },
    ],
  },
  {
    key: 'administration',
    items: [
      { key: 'methodology', path: '/dashboard/methodology', lucide: BookOpen },
      { key: 'settings', path: '/settings', lucide: Settings },
    ],
  },
];

/** Active when the remainder path equals item path or is nested below (overview matches exactly, plus evidence). */
export function isActive(item: NavItem, rest: string): boolean {
  if (item.key === 'overview') return rest === '/dashboard' || rest === '/dashboard/';
  if (item.key === 'sources' && rest.startsWith('/dashboard/evidence')) return true;
  return rest === item.path || rest.startsWith(item.path + '/');
}

const ANALYTICS_PATHS = ['/dashboard', '/dashboard/results', '/dashboard/sources', '/dashboard/competitors', '/dashboard/perception'];

export const PRIMARY_NAV: NavItem[] = NAV_GROUPS.filter((group) => group.key !== 'administration').flatMap((group) => group.items);
export const SECONDARY_NAV: NavItem[] = NAV_GROUPS.find((group) => group.key === 'administration')!.items;
export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
/** Current section for breadcrumbs and the mobile header. */
export function currentNav(rest: string): NavItem | null {
  return ALL_NAV.find((i) => isActive(i, rest)) ?? null;
}

const MEASUREMENT_KEYS = ['range', 'from', 'to', 'provider', 'topic', 'tag', 'tags', 'tagMode', 'market', 'language', 'surface', 'promptId', 'promptVersion', 'group', 'run', 'runId'] as const;

/** Cross-screen measurement context only: never carry drawers, source searches or administration state. */
export function analyticsNavigationHref(targetHref: string, sourcePath: string, search: string, now = new Date()): string {
  const target = new URL(targetHref, 'https://navigation.invalid');
  const targetPath = target.pathname.replace(/^\/(fi|en)(?=\/)/, '');
  const source = sourcePath.replace(/^\/(fi|en)(?=\/)/, '').replace(/\/$/, '');
  if (!analyticsPath(source) || !ANALYTICS_PATHS.includes(targetPath)) return targetHref;
  const current = new URLSearchParams(search);
  for (const key of MEASUREMENT_KEYS) {
    const value = current.get(key);
    if (value && value !== 'all') target.searchParams.set(key, value);
  }
  // Results historically calls the prompt selector "prompt"; analytics uses promptId.
  if (!target.searchParams.has('promptId') && current.get('prompt')) target.searchParams.set('promptId', current.get('prompt')!);
  if (targetPath === '/dashboard/results') {
    const range = current.get('range') ?? '28';
    const days = ['7', '28', '90'].includes(range) ? Number(range) : 28;
    const day = (d: Date) => d.toISOString().slice(0, 10);
    if (!target.searchParams.has('to')) target.searchParams.set('to', day(now));
    if (!target.searchParams.has('from')) target.searchParams.set('from', day(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1))));
    target.searchParams.delete('range');
    // Resolve the same latest compatible composition server-side, not every historical version.
    if (!target.searchParams.has('group')) target.searchParams.set('group', 'latest');
  } else if (target.searchParams.get('group') === 'latest') {
    target.searchParams.delete('group');
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

const analyticsPath = (path: string) => ANALYTICS_PATHS.find(p => path === p || (p !== '/dashboard' && path.startsWith(`${p}/`)));
