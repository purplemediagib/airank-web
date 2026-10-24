import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDocumentTitle, useI18n } from '@/i18n';
import { PageHeader, Panel, StatusBadge, DisabledAction, EmptyState, ErrorState, LoadingBlock, ReasonNote } from '@/components/airank/primitives';
import { KpiCard, TrendChart, DataTable, FilterSelect } from '@/components/airank/data';
import { TextField, ConfirmDialog } from '@/components/airank/forms';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/* DEVELOPMENT-ONLY FIXTURES. Never imported by production views. */
const FIXTURE_POINTS = [
  { date: '2025-01-06', a: 42.1, b: 31.4 },
  { date: '2025-01-13', a: 47.3, b: null },
  { date: '2025-01-20', a: null, b: 28.9 },
  { date: '2025-01-27', a: 51.6, b: 33.2 },
  { date: '2025-02-03', a: 49.8, b: 36.7 },
];
const FIXTURE_ROWS = [
  { id: 'r1', name: 'Fixture row 1', v: 0.412 },
  { id: 'r2', name: 'Fixture row 2', v: 0.287 },
  { id: 'r3', name: 'Fixture row 3', v: null as number | null },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
      {children}
    </Panel>
  );
}

export default function PlaygroundPage() {
  const { d, pct } = useI18n();
  const p = d.playground;
  useDocumentTitle(p.title);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState(FIXTURE_ROWS);
  const [dialog, setDialog] = useState(false);
  const [val, setVal] = useState('');
  const [filter, setFilter] = useState('a');
  const simulate = () => { setLoading(true); window.setTimeout(() => setLoading(false), 1200); };

  return (
    <>
      <PageHeader title={p.title} actions={<StatusBadge tone="warning">{p.badge}</StatusBadge>} />
      <ReasonNote tone="warning">{p.warning}</ReasonNote>
      <Section title={p.buttons}>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="pg-primary"><Plus aria-hidden /> Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button loading={loading} onClick={simulate}>{p.simulateLoad}</Button>
          <Button disabled>Disabled</Button>
          <DisabledAction reason={d.project.createDisabled}>{d.project.create}</DisabledAction>
          <FilterSelect label="Fixture" value={filter} onChange={setFilter} testId="pg-filter" options={[{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }]} />
        </div>
      </Section>
      <Section title={p.badges}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="success">{d.status.complete}</StatusBadge>
          <StatusBadge tone="warning">{d.status.partial}</StatusBadge>
          <StatusBadge tone="error">{d.status.failed}</StatusBadge>
          <StatusBadge tone="info">{d.status.pending}</StatusBadge>
          <StatusBadge tone="neutral">{d.status.notChecked}</StatusBadge>
        </div>
      </Section>
      <Section title={p.kpis}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard testId="pg-kpi-a" label={d.overview.visibility} definition={d.overview.visibilityDef} value={pct(0.473)} delta={{ text: '+4.2 pp', positive: true }} sample="Fixture n=38" />
          <KpiCard testId="pg-kpi-b" label={d.overview.recommendations} definition={d.overview.recommendationsDef} value={null} sample={d.overview.noAnswers} />
          <KpiCard testId="pg-kpi-c" label={d.overview.share} definition={d.overview.shareDef} value={null} sample="" loading />
        </div>
      </Section>
      <Section title={p.chart}>
        <TrendChart title={p.chart} data={FIXTURE_POINTS} emptyText={d.chart.empty}
          series={[{ key: 'a', label: p.fixtureSeries, color: '#181f6b' }, { key: 'b', label: p.fixtureSeriesB, color: '#00b8e4', dash: '5 4' }]} />
      </Section>
      <Section title={p.table}>
        <DataTable testId="pg-table" caption={p.table} rows={rows} rowKey={(r) => r.id} loading={loading} emptyTitle={d.empty.list} pageSize={2}
          columns={[
            { key: 'name', header: d.columns.brand, cell: (r) => r.name, sortValue: (r) => r.name },
            { key: 'v', header: d.columns.visibility, align: 'right', cell: (r) => (r.v === null ? <span className="text-muted-ink">{d.common.unavailable}</span> : pct(r.v)), sortValue: (r) => r.v },
            { key: 'x', header: '', align: 'right', cell: () => <Button variant="ghost" size="sm" onClick={() => setDialog(true)}>{d.common.remove}</Button> },
          ]} />
      </Section>
      <Section title={p.form}>
        <div className="grid max-w-[640px] gap-4">
          <TextField label={d.settings.domain} hint={d.settings.domainHint} value={val} onChange={setVal} testId="pg-input"
            error={val && !val.includes('.') ? d.validation.domain : undefined} success={val.includes('.') ? d.settings.validNote : undefined} />
          <TextField label={p.disabled} value="" onChange={() => undefined} disabled testId="pg-input-disabled" />
        </div>
      </Section>
      <Section title={p.states}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Panel as="div"><LoadingBlock /></Panel>
          <Panel as="div"><EmptyState title={d.empty.list} body={d.empty.listBody} /></Panel>
          <Panel as="div"><ErrorState onRetry={simulate} retrying={loading} /></Panel>
        </div>
      </Section>
      <Section title={p.dialogs}>
        <ConfirmDialog open={dialog} onOpenChange={setDialog} title={d.dialog.removeTitle} body={d.dialog.removeBody} confirmLabel={d.common.remove} destructive
          trigger={<Button variant="secondary" className="self-start" data-testid="pg-open-dialog">{p.openDialog}</Button>}
          onConfirm={() => { setRows((r) => r.slice(1)); toast({ title: p.removed }); }} />
      </Section>
    </>
  );
}
