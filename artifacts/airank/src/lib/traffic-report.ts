/** Pure helpers shared by the Settings connection report viewer and the Traffic destination. */
export type GoogleService = 'ga4' | 'gsc';
export type ReportFlags = { truncated: boolean; sampling: boolean; threshold: boolean };

export function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
export function defaultRange(now = Date.now()) {
  const end = new Date(now - 86400000);
  return { from: isoDay(new Date(end.getTime() - 27 * 86400000)), to: isoDay(end) };
}
export function rangeOk(from: string, to: string) {
  const exactDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && isoDay(new Date(value)) === value;
  if (!exactDay(from) || !exactDay(to)) return false;
  const a = Date.parse(from), b = Date.parse(to);
  return !isNaN(a) && !isNaN(b) && b >= a && (b - a) / 86400000 <= 365;
}
function hasValue(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v > 0;
  if (typeof v === 'string') { const x = v.trim().toLowerCase(); return !!x && !['false', '0', 'none', 'no', 'null', 'unspecified'].includes(x) && !/^0+(\.0+)?$/.test(x); }
  if (Array.isArray(v)) return v.some(hasValue);
  if (v && typeof v === 'object') return Object.values(v).some(hasValue);
  return false;
}
function scan(v: unknown, out: ReportFlags) {
  if (Array.isArray(v)) { v.forEach((x) => scan(x, out)); return; }
  if (!v || typeof v !== 'object') return;
  for (const [k, val] of Object.entries(v)) {
    const key = k.toLowerCase();
    if (/truncat/.test(key) && hasValue(val)) out.truncated = true;
    else if (/sampl/.test(key) && hasValue(val)) out.sampling = true;
    else if (/threshold/.test(key) && hasValue(val)) out.threshold = true;
    else scan(val, out);
  }
}
export function reportFlags(meta: unknown): ReportFlags { const o = { truncated: false, sampling: false, threshold: false }; scan(meta, o); return o; }
export function cell(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Coverage state of a cached report. "missing" (nothing imported for the range) is never
 * presented as zero traffic; "zero" means imported days exist but no matching rows
 * were reported. It does not prove exact zero traffic (e.g. under thresholding).
 */
export type Coverage = 'missing' | 'partial-zero' | 'zero' | 'partial' | 'complete';
export function coverage(r: { totalRows: number; availableDates: string[]; missingDates: string[] }): Coverage {
  const hasRows = r.totalRows > 0;
  if (r.availableDates.length === 0) return hasRows ? 'partial' : 'missing';
  const partial = r.missingDates.length > 0;
  if (!hasRows) return partial ? 'partial-zero' : 'zero';
  return partial ? 'partial' : 'complete';
}
