import type { OverviewInsights } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { EmptyState, Panel } from '../primitives';
import { useL } from '../analytics';

/** Topic × tag visibility. A missing pair is shown as "not measured", never zero. */
export function TopicMatrix({ overview }: { overview: OverviewInsights | undefined }) {
  const L = useL();
  const { pct } = useI18n();
  const storedCells = overview?.matrix ?? [];
  // An unlabelled catch-all bucket is not a measured topic breakdown.
  const cells = storedCells.some(c => c.topic || c.tag) ? storedCells : [];
  const topics = [...new Set(cells.map((c) => c.topic))];
  const tags = [...new Set(cells.map((c) => c.tag))];
  const at = new Map(cells.map((c) => [`${c.topic}\u0000${c.tag}`, c.metrics]));
  const topicName = (t: string) => t || L('Ei aihetta', 'No topic');
  const tagName = (t: string) => t || L('Ei tunnisteita', 'No tags');
  return (
    <Panel className="flex min-w-0 flex-col gap-3 p-4" aria-labelledby="matrix-title" data-testid="panel-topic-matrix">
      <div>
        <h2 id="matrix-title" className="text-[15px] font-semibold text-ink">{L('Aiheet ja tunnisteet', 'Topics vs tags')}</h2>
        <p className="text-[11px] text-muted-ink">{L('Näkyvyys jokaisessa aihe–tunniste-parissa koko valitusta datasta. Tyhjä solu = ei mitattu.', 'Visibility for each topic–tag pair from the complete selection. Blank cell = not measured.')}</p>
      </div>
      {overview === undefined ? <EmptyState compact title={L('Vaatii taustapalvelun päivityksen', 'Backend upgrade needed')} body={L('Tämä palvelin ei palauta aihematriisia.', 'This server does not return the topic matrix.')} />
        : cells.length === 0 ? <EmptyState compact title={L('Ei mitattuja aiheita', 'No measured topics')} body={L('Valituissa mittauksissa ei ole aihe- tai tunnistetietoja. Lisää ne kysymyksiin tulevia mittauksia varten; vanhoja tuloksia ei luokitella jälkikäteen.', 'Selected measurements have no topic or tag metadata. Add these to prompts for future measurements; old results are not relabelled.')} />
        : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-[12px]" data-testid="table-topic-matrix">
              <caption className="sr-only">{L('Näkyvyys aiheittain ja tunnisteittain', 'Visibility by topic and tag')}</caption>
              <thead><tr><th scope="col" className="text-left text-[11px] font-medium text-muted-ink">{L('Tunniste \\ aihe', 'Tag \\ topic')}</th>{topics.map((t) => <th key={t} scope="col" className="max-w-[140px] truncate px-1 text-center text-[11px] font-medium text-muted-ink" title={topicName(t)}>{topicName(t)}</th>)}</tr></thead>
              <tbody>{tags.map((tag) => (
                <tr key={tag}><th scope="row" className="whitespace-nowrap pr-2 text-left font-medium text-ink">{tagName(tag)}</th>
                  {topics.map((t) => {
                    const m = at.get(`${t}\u0000${tag}`);
                    const v = m?.visibility ?? null;
                    const alpha = v === null ? 0 : 0.12 + (v / 100) * 0.78;
                    return (
                      <td key={t} className="h-8 min-w-[72px] rounded-md text-center tabular" style={m && v !== null ? { background: `rgba(0,184,228,${alpha})`, color: v > 55 ? '#fff' : '#101c32' } : { background: '#f7f9fc', color: '#9aa6b8' }}
                        title={m ? `${m.mentions}/${m.eligible}` : L('Ei mitattu', 'Not measured')} data-testid={`cell-matrix-${t}-${tag}`}>
                        {m ? (v === null ? '–' : pct(v / 100, 1)) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
    </Panel>
  );
}
