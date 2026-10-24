import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { useI18n } from '@/i18n';
import { useOpportunities } from '@/lib/use-opportunities';
import { EmptyState, ErrorState, Panel, StatusBadge } from '../primitives';
import { useL } from '../analytics';

/** Read-only, project-wide opportunity digest. Never triggers refresh or other writes. */
export function OpportunitiesCompact({ projectId }: { projectId: string }) {
  const L = useL();
  const { href, locale } = useI18n();
  const q = useOpportunities(projectId);
  const open = (q.data ?? []).filter((o) => o.status !== 'completed').sort((a, b) => (a.priority === b.priority ? b.updatedAt - a.updatedAt : a.priority === 'high' ? -1 : 1));
  return (
    <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="opp-title" data-testid="panel-opportunities">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="opp-title" className="text-[15px] font-semibold text-ink">{L('Mahdollisuudet', 'Opportunities')}</h2>
          <p className="text-[11px] text-muted-ink" data-testid="text-opportunities-scope">{L('Koko projekti · ei rajattu yllä olevilla suodattimilla', 'Project-wide · not scoped by the filters above')}</p>
        </div>
        <Link href={`${href('/dashboard/opportunities')}?project=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-link hover:underline" data-testid="link-opportunities">{L('Kaikki', 'View all')} <ArrowUpRight className="size-3.5" aria-hidden /></Link>
      </div>
      {q.isPending ? <div className="space-y-2" aria-busy="true"><span className="ar-skeleton block h-4 w-3/4" /><span className="ar-skeleton block h-4 w-1/2" /></div>
        : q.isError ? (q.unavailable ? <EmptyState compact title={L('Ei saatavilla tällä palvelimella', 'Not available on this server')} /> : <ErrorState onRetry={() => void q.refetch()} />)
        : open.length === 0 ? <EmptyState compact title={L('Ei avoimia mahdollisuuksia', 'No open opportunities')} body={L('Näytetään vain todisteisiin perustuvia havaintoja.', 'Only evidence-backed findings are listed.')} />
        : (
          <ul className="divide-y divide-line" data-testid="list-opportunities">
            {open.slice(0, 4).map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0" data-testid={`row-opportunity-${o.id}`}>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{locale === 'fi' ? o.titleFi : o.titleEn}</p>
                  <p className="line-clamp-1 text-[12px] text-muted-ink">{locale === 'fi' ? o.rationaleFi : o.rationaleEn}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge tone={o.priority === 'high' ? 'warning' : 'neutral'}>{o.priority === 'high' ? L('Korkea', 'High') : L('Keskitaso', 'Medium')}</StatusBadge>
                  <span className="tabular text-[11px] text-muted-ink">{L(`${o.evidenceIds.length} todistetta`, `${o.evidenceIds.length} evidence`)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}
