import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProjectAnalytics } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { selectedGroupRuns } from '@/lib/overview-data';
import { toMs } from '@/lib/use-analytics';
import { EmptyState, Panel } from '../primitives';
import { useL } from '../analytics';

/** Visibility vs owned citation rate, one point per run of the selected composition group only. */
export function SourceImpact({ a, runId = '' }: { a: ProjectAnalytics; runId?: string }) {
  const L = useL();
  const { pct, date } = useI18n();
  const runs = selectedGroupRuns(a).filter((r) => r.metrics.eligible > 0 && (!runId || r.id === runId));
  const data = runs.map((r) => ({ t: toMs(r.createdAt), id: r.id, visibility: r.metrics.visibility, citations: r.metrics.citationRate }));
  const fmt = (t: number) => date(new Date(t), { day: 'numeric', month: 'short' });
  return (
    <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="impact-title" data-testid="panel-source-impact">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="impact-title" className="text-[15px] font-semibold text-ink">{L('Omien lähteiden vaikutus', 'Own source impact')}</h2>
          <p className="text-[11px] text-muted-ink">{L('Näkyvyys ja oman lähteen viittausaste valitun ryhmän ajoissa.', 'Visibility and owned citation rate across selected-group runs.')}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-ink">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-navy" />{L('Näkyvyys', 'Visibility')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-cyan" />{L('Oma lähde', 'Owned citation')}</span>
        </div>
      </div>
      {data.length === 0 ? <EmptyState compact title={L('Ei kelvollisia ajoja', 'No eligible runs')} body={L('Kaavio näkyy, kun valitussa ryhmässä on kelvollisia vastauksia.', 'The chart appears once the selected group has eligible answers.')} />
        : (
          <div className="h-[180px]" role="img" aria-label={L('Näkyvyys ja viittausaste ajoittain', 'Visibility and citation rate by run')}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -14 }}>
                <CartesianGrid vertical={false} stroke="#e3e8f0" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#637087' }} />
                <YAxis yAxisId="v" domain={[0, 100]} tickFormatter={(v: number) => pct(v / 100, 0)} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#637087' }} />
                <YAxis yAxisId="c" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => pct(v / 100, 0)} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#637087' }} />
                <Tooltip labelFormatter={(t: number) => date(new Date(t), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} formatter={(v: unknown, n: string) => [typeof v === 'number' ? pct(v / 100, 1) : '–', n === 'visibility' ? L('Näkyvyys', 'Visibility') : L('Oma lähde', 'Owned citation')]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e3e8f0' }} />
                <Line yAxisId="v" dataKey="visibility" stroke="#181f6b" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="c" dataKey="citations" stroke="#00b8e4" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      <p className="text-[11px] text-muted-ink" data-testid="text-impact-runs">{L(`${data.length} ajoa · korrelaatio ei osoita syy-yhteyttä`, `${data.length} runs · correlation does not imply causation`)}</p>
    </Panel>
  );
}
