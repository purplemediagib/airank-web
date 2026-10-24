import { ArrowUpRight, History, ListChecks } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { DailyStatusStrip } from '../schedule-settings';
import { WebsiteFavicon } from '../website-favicon';
import { useL } from '../analytics';

/** One daily-workflow header: identity, prompt management, truthful schedule status, history entry. */
export function WorkflowHeader({ projectId, brand, domain, archived, title }: { projectId: string; brand: string; domain?: string; archived: boolean; title: string }) {
  const L = useL();
  const { href } = useI18n();
  const q = `?project=${encodeURIComponent(projectId)}`;
  return (
    <header className="flex flex-col gap-3" data-testid="header-daily-workflow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <WebsiteFavicon domain={domain} brand={brand || '?'} className="size-10" />
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-7 tracking-tight text-ink">{title}</h1>
            <p className="truncate text-[13px] text-muted-ink" data-testid="text-project-brand">{brand}{domain ? <span className="text-[#9aa6b8]"> · {domain}</span> : null}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projectId && <Button asChild variant="ghost" size="sm" data-testid="link-history"><Link href={`${href('/dashboard/history')}${q}`}><History aria-hidden /> {L('Historia', 'History')}</Link></Button>}
          {projectId && <Button asChild variant="ghost" size="sm" data-testid="link-quick-check-history"><Link href={`${href('/start')}${q}`}>{L('Aiemmat vastaukset', 'Earlier answers')} <ArrowUpRight aria-hidden /></Link></Button>}
          {projectId && (archived
            ? <Button size="sm" disabled data-testid="button-manage-prompts"><ListChecks aria-hidden /> {L('Hallitse kysymyksiä', 'Manage prompts')}</Button>
            : <Button asChild size="sm" data-testid="button-manage-prompts"><Link href={`${href('/dashboard/prompts')}${q}`}><ListChecks aria-hidden /> {L('Hallitse kysymyksiä', 'Manage prompts')}</Link></Button>)}
        </div>
      </div>
      {projectId && <DailyStatusStrip projectId={projectId} testId="strip-overview-daily" />}
    </header>
  );
}
