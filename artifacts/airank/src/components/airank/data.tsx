import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, Search, X, Info } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { EmptyState, LoadingBlock, Panel, ErrorState } from './primitives';

/* ---------- KPI card (Figma 7:106). null value => neutral unavailable state, never zero. ---------- */
export function KpiCard({
  label,
  definition,
  value,
  delta,
  sample,
  loading,
  testId,
}: {
  label: string;
  definition: string;
  value: string | null;
  delta?: { text: string; positive: boolean } | null;
  sample: string;
  loading?: boolean;
  testId: string;
}) {
  const { d } = useI18n();
  return (
    <Panel as="article" className="flex min-w-0 flex-col gap-1 p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-[19px] text-muted-ink">{label}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="-m-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
              aria-label={`${d.common.definition}: ${label}`}
              data-testid={`button-definition-${testId}`}
            >
              <Info className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-[12px] leading-[17px]">{definition}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex min-h-[46px] items-start gap-3">
        {loading ? (
          <span className="ar-skeleton mt-2 h-8 w-28" aria-hidden />
        ) : value === null ? (
          <p className="text-[32px] font-semibold leading-[46px] text-[#b4bdcb]" data-testid={`value-${testId}`} aria-label={d.common.unavailable}>
            –
          </p>
        ) : (
          <p className="tabular text-[32px] font-semibold leading-[46px] text-ink" data-testid={`value-${testId}`}>{value}</p>
        )}
        {delta && value !== null && (
          <p className={cn('mt-1 text-[12px] font-medium leading-[17px]', delta.positive ? 'text-success' : 'text-danger')}>{delta.text}</p>
        )}
      </div>
      <p className="text-[12px] leading-[17px] text-muted-ink">{value === null ? `${d.common.unavailable} · ${sample}` : sample}</p>
    </Panel>
  );
}

/* ---------- Trend chart: zero-based %, distinct dash patterns, null gaps, table alternative ---------- */
export interface Series {
  key: string;
  label: string;
  color: string;
  dash?: string;
}
export type Point = { date: string } & Record<string, number | null | string>;

export function TrendChart({ title, series, data, height = 180, emptyText, withTime, onPointSelect, valueFormat = 'percent', sampleKey, valueDomain }: { title: string; series: Series[]; data: Point[]; height?: number; emptyText: string; withTime?: boolean; onPointSelect?: (point: Point) => void; valueFormat?: 'percent' | 'number'; sampleKey?: string; valueDomain?: [number, number] }) {
  const { d, t, pct, date, locale } = useI18n();
  const [asTable, setAsTable] = useState(false);
  const empty = data.length === 0;
  const rowLabel = (row: Point) => (withTime && !row.gap ? date(row.date, { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : date(row.date));
  const numberFormat = new Intl.NumberFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { maximumFractionDigits: 1 });
  const fmt = (v: unknown) => (typeof v === 'number' ? valueFormat === 'percent' ? pct(v / 100) : numberFormat.format(v) : d.chart.noValue);
  const tooltipContent = sampleKey ? ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as Point | undefined;
    return (
      <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-md" style={{ fontFamily: 'Figtree', fontSize: 12 }}>
        <p className="mb-1 text-muted-ink">{date(String(label), withTime ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        {payload.map((item) => {
          const value = item.value;
          const sample = point?.[sampleKey];
          return <p key={String(item.dataKey)} style={{ color: item.color }}>{series.find((s) => s.key === item.dataKey)?.label ?? item.name}: {fmt(value)}{typeof sample === 'number' ? ` · n = ${sample}` : ''}</p>;
        })}
      </div>
    );
  } : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative" style={{ height }}>
        {!asTable && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={empty ? [{ date: '' }] : data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} onClick={state => { const point = state?.activePayload?.[0]?.payload as Point | undefined; if (point?.runId) onPointSelect?.(point); }}>
              <CartesianGrid vertical={false} stroke="#e3e8f0" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#637087', fontFamily: 'Figtree' }}
                tickFormatter={(v: string) => (v ? date(v) : '')}
              />
              <YAxis
                domain={valueDomain ?? (valueFormat === 'percent' ? [0, 100] : ['auto', 'auto'])}
                ticks={valueFormat === 'percent' ? [0, 25, 50, 75, 100] : undefined}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#637087', fontFamily: 'Figtree' }}
                tickFormatter={(v: number) => valueFormat === 'percent' ? pct(v / 100, 0) : numberFormat.format(v)}
              />
              {!empty && (
                <RTooltip
                  content={tooltipContent}
                  formatter={(v: unknown, name: string) => [fmt(v), series.find((s) => s.key === name)?.label ?? name]}
                  labelFormatter={(v: string) => date(v, withTime ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'long', year: 'numeric' })}
                  contentStyle={{ fontFamily: 'Figtree', fontSize: 12, borderRadius: 8, border: '1px solid #e3e8f0' }}
                />
              )}
              {!empty &&
                series.map((s) => (
                  <Line
                    key={s.key}
                    type="linear"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray={s.dash}
                    dot={{ r: 2.5, strokeWidth: 0, fill: s.color }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {empty && !asTable && (
          <div className="absolute inset-0 grid place-items-center pl-10">
            <p className="ar-hatch max-w-[360px] rounded-lg border border-dashed border-line bg-white/80 px-4 py-3 text-center text-[12px] leading-[17px] text-muted-ink" data-testid="text-chart-empty">
              {emptyText}
            </p>
          </div>
        )}
        {asTable && (
          <div className="h-full overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-[12px]">
              <caption className="sr-only">{t(d.chart.tableCaption, { title })}</caption>
              <thead className="sticky top-0 bg-canvas text-muted-ink">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{d.chart.date}</th>
                  {series.map((s) => (
                    <th key={s.key} scope="col" className="px-3 py-2 font-medium">{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empty ? (
                  <tr>
                    <td colSpan={series.length + 1} className="px-3 py-6 text-center text-muted-ink">{emptyText}</td>
                  </tr>
                ) : (
                  data.map((row, i) => (
                    <tr key={`${row.date}-${i}`} className="border-t border-line">
                      <th scope="row" className="px-3 py-1.5 font-normal text-ink">{onPointSelect && row.runId ? <button className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2" onClick={() => onPointSelect(row)}>{rowLabel(row)}</button> : rowLabel(row)}</th>
                      {series.map((s) => (
                        <td key={s.key} className={cn('tabular px-3 py-1.5', typeof row[s.key] === 'number' ? 'text-ink' : 'italic text-muted-ink')}>
                          {fmt(row[s.key])}{sampleKey && typeof row[sampleKey] === 'number' ? ` · n = ${row[sampleKey]}` : ''}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label={title}>
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[12px] leading-[17px] text-ink">
              <svg width="18" height="8" aria-hidden>
                <line x1="0" y1="4" x2="18" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
        <span className="hidden text-[11px] text-muted-ink sm:inline">{d.chart.gapNote}</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} data-testid="button-toggle-chart-table">
          {asTable ? d.common.showChart : d.common.showTable}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Filter select styled as Figma secondary button ---------- */
export function FilterSelect({ label, value, onChange, options, disabled, testId, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; testId: string; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={label}
        data-testid={testId}
        className={cn(
          'h-11 w-auto min-w-[134px] gap-2 rounded-lg border-line bg-white px-3 text-sm font-medium text-ink shadow-none transition-colors hover:bg-canvas focus:ring-[3px] focus:ring-cyan focus:ring-offset-0 disabled:opacity-100 disabled:text-muted-ink md:h-10',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-lg border-line">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-sm">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SearchInput({ value, onChange, label, testId }: { value: string; onChange: (v: string) => void; label: string; testId: string }) {
  const { d } = useI18n();
  return (
    <div className="relative w-full sm:w-[280px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={d.common.searchPlaceholder}
        className="h-11 w-full rounded-lg border border-line bg-white pl-9 pr-9 text-sm text-ink placeholder:text-muted-ink transition-colors hover:border-[#c9d2e0] focus-visible:border-navy focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan/60 md:h-10"
        data-testid={testId}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label={d.common.clearSearch} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-ink hover:bg-canvas hover:text-ink">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/* ---------- Data table: sort, pagination, loading/empty/error, mobile card stacking ---------- */
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  align?: 'left' | 'right';
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyBody,
  pageSize = 10,
  caption,
  testId,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  emptyTitle: string;
  emptyBody?: string;
  pageSize?: number;
  caption: string;
  testId: string;
}) {
  const { d, t, plural } = useI18n();
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const r = av < bv ? -1 : 1;
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggle = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  return (
    <div data-testid={testId}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-line">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                return (
                  <th key={c.key} scope="col" aria-sort={c.sortValue ? ariaSort : undefined} className={cn('h-10 px-4 text-[12px] font-medium text-muted-ink', c.align === 'right' && 'text-right', c.className)}>
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={cn('-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:bg-canvas hover:text-ink', active && 'text-ink')}
                        aria-label={t(d.common.sortBy, { column: c.header })}
                        data-testid={`button-sort-${c.key}`}
                      >
                        {c.header}
                        {active ? sort!.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ChevronsUpDown className="size-3 opacity-50" aria-hidden />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          {!loading && !error && visible.length > 0 && (
            <tbody>
              {visible.map((row) => (
                <tr key={rowKey(row)} className="grid grid-cols-1 gap-1 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-canvas/70 md:table-row md:p-0">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('flex justify-between gap-4 md:table-cell md:h-12 md:px-4', c.align === 'right' && 'md:text-right', c.className)}>
                      <span className="text-[12px] text-muted-ink md:hidden">{c.header}</span>
                      <span className="tabular text-ink">{c.cell(row)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {loading && <LoadingBlock />}
      {!loading && error && <ErrorState onRetry={onRetry} />}
      {!loading && !error && rows.length === 0 && <EmptyState title={emptyTitle} body={emptyBody} compact />}
      {!loading && !error && rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12px] text-muted-ink">
          <span>{plural(d.common.rows, rows.length)}</span>
          <div className="flex items-center gap-1">
            <span className="mr-2" aria-live="polite">{t(d.common.page, { page: current, total: totalPages })}</span>
            <Button variant="ghost" size="icon" className="size-9 md:size-8" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label={d.common.previous} data-testid="button-page-prev">
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="size-9 md:size-8" disabled={current >= totalPages} onClick={() => setPage(current + 1)} aria-label={d.common.next} data-testid="button-page-next">
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
