import type { AnalyticsEvidence, SourceEvidenceItem, SourceAnalytics } from '@workspace/api-client-react';

export const SOURCE_KINDS = ['citation', 'source_reference', 'retrieval', 'answer_link'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const PAGE = 25;

export const asKind = (v: string): SourceKind => (SOURCE_KINDS as readonly string[]).includes(v) ? (v as SourceKind) : 'citation';

export interface SourceRow {
  key: string; label: string; domain: string; kind: SourceKind; category: string; urls: number; answers: number;
  sourceType?: string; sourceTypeProvenance?: string; sourceTypeReviewedAt?: number | null;
  evidenceIds: string[]; reportedOccurrences: number | null; occurrenceAnswers: number; providers: string[]; surfaces: string[]; provenances: string[];
}

const uniq = (a: string[]) => [...new Set(a)].sort();

/** Per-URL rows for one kind. Occurrences stay per URL. */
export function urlRows(items: SourceEvidenceItem[], kind: SourceKind): SourceRow[] {
  return items.filter((i) => i.kind === kind).map((i) => ({
    sourceType: i.sourceType, sourceTypeProvenance: i.sourceTypeProvenance, sourceTypeReviewedAt: i.sourceTypeReviewedAt,
    key: i.url, label: i.url, domain: i.domain, kind, category: i.category, urls: 1, answers: new Set(i.evidenceIds).size,
    evidenceIds: [...new Set(i.evidenceIds)], reportedOccurrences: i.reportedOccurrences, occurrenceAnswers: i.occurrenceAnswers,
    providers: i.providers, surfaces: i.surfaces, provenances: i.provenances,
  }));
}

/** Domain rows: evidence ids are unioned (never summed); occurrences are not aggregated across URLs. */
export function domainRows(items: SourceEvidenceItem[], kind: SourceKind): SourceRow[] {
  const m = new Map<string, SourceEvidenceItem[]>();
  for (const i of items) if (i.kind === kind) {
    const bucket = m.get(i.domain) ?? [];
    bucket.push(i); m.set(i.domain, bucket);
  }
  return [...m.entries()].map(([domain, list]) => {
    const ids = uniq(list.flatMap((i) => i.evidenceIds));
    const cats = new Set(list.map((i) => i.category));
    return {
      sourceType: list[0].sourceType, sourceTypeProvenance: list[0].sourceTypeProvenance, sourceTypeReviewedAt: list[0].sourceTypeReviewedAt,
      key: domain, label: domain, domain, kind, category: cats.size === 1 ? [...cats][0] : 'mixed', urls: new Set(list.map((i) => i.url)).size,
      answers: ids.length, evidenceIds: ids, reportedOccurrences: null, occurrenceAnswers: 0,
      providers: uniq(list.flatMap((i) => i.providers)), surfaces: uniq(list.flatMap((i) => i.surfaces)), provenances: uniq(list.flatMap((i) => i.provenances)),
    };
  });
}

export function filterRows(rows: SourceRow[], q: string, cat: string, sort: string, type = 'all'): SourceRow[] {
  const n = q.trim().toLocaleLowerCase();
  return rows.filter((r) => cat === 'all' || r.category === cat).filter((r) => type === 'all' || (r.sourceType ?? 'unknown') === type).filter((r) => !n || r.label.toLocaleLowerCase().includes(n))
    .sort((a, b) => sort === 'name' ? a.label.localeCompare(b.label) : b.answers - a.answers || a.label.localeCompare(b.label));
}

/** Unknown observable coverage stays null; it is never converted to zero. */
export function coverageFor(s: SourceAnalytics, kind: string) {
  const c = s.coverage.find((x) => x.kind === kind);
  return c ? { answers: c.answers, urls: c.urls, observable: c.observableAnswers } : null;
}

/** Evidence matched by a row, in table order; ids absent from the loaded evidence are counted separately. */
export function matchedEvidence(ids: string[], map: Map<string, AnalyticsEvidence>) {
  const found = ids.map((id) => map.get(id)).filter((e): e is AnalyticsEvidence => !!e);
  return { found, missing: ids.length - found.length };
}

/** A domain sheet must never display another domain's passage associations. */
export function sourceReferences(e: AnalyticsEvidence, row: SourceRow) {
  const canonical = (value: string) => {
    try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u : null; }
    catch { return null; }
  };
  const matches = (value: string) => {
    const url = canonical(value);
    return !!url && (row.label === row.domain
      ? url.hostname.replace(/^www\./,'').replace(/\.$/,'') === row.domain
      : url.href === canonical(row.label)?.href);
  };
  const refs = (e.collection?.sourceReferences ?? []).filter(s => s.kind === row.kind && matches(s.url));
  if (row.kind !== 'citation') return refs;
  const richer = new Set(refs.map(s => canonical(s.url)?.href));
  return [...refs, ...e.citations.filter(url => matches(url) && !richer.has(canonical(url)?.href))
    .map(url => ({url, kind:'citation' as const, provenance:'stored_citation', title:undefined, snippet:undefined, passage:undefined, occurrences:undefined}))];
}

/** Source-type counts with an explicit URL denominator (unique URLs of the kind). Absent type counts as unknown. */
export function typeCounts(items: SourceEvidenceItem[], kind: SourceKind) {
  const urls = new Set<string>();
  const by = new Map<string, Set<string>>();
  for (const i of items) {
    if (i.kind !== kind) continue;
    urls.add(i.url);
    const t = i.sourceType ?? 'unknown';
    by.set(t, new Set([...(by.get(t) ?? []), i.url]));
  }
  return { urls: urls.size, counts: Object.fromEntries([...by.entries()].map(([k, v]) => [k, v.size])) as Record<string, number>, supported: items.some((i) => i.sourceType !== undefined) };
}
