import { describe, expect, it } from 'vitest';
import { coverageFor, domainRows, filterRows, matchedEvidence, sourceReferences, urlRows } from '@/lib/source-workbench';
import { readPresets, validDates } from '@/components/airank/analytics-filters';

const item = (url: string, kind: any, ids: string[], extra = {}) => ({ url, domain: new URL(url).hostname, kind, category: 'other', answers: ids.length, evidenceIds: ids, reportedOccurrences: null, occurrenceAnswers: 0, providers: [], surfaces: [], provenances: [], ...extra });
const items = [item('https://a.com/1', 'citation', ['e1', 'e2']), item('https://a.com/2', 'citation', ['e2', 'e3'], { reportedOccurrences: 4 }), item('https://a.com/1', 'retrieval', ['e9'])];

describe('source workbench', () => {
  it('keeps citation and retrieval separate', () => {
    expect(urlRows(items as any, 'citation')).toHaveLength(2);
    expect(domainRows(items as any, 'retrieval')[0].evidenceIds).toEqual(['e9']);
  });
  it('unions evidence ids per domain without summing', () => {
    const [d] = domainRows(items as any, 'citation');
    expect(d.answers).toBe(3);
    expect(d.urls).toBe(2);
    expect(d.reportedOccurrences).toBeNull();
  });
  it('treats unknown coverage as null, not zero', () => {
    const c = coverageFor({ version: '1', eligibleAnswers: 3, items: [], coverage: [{ kind: 'citation', answers: 0, urls: 0, observableAnswers: null }] } as any, 'citation');
    expect(c?.observable).toBeNull();
    expect(coverageFor({ coverage: [] } as any, 'retrieval')).toBeNull();
  });
  it('limits drawer evidence to matched, loaded answers', () => {
    const m = matchedEvidence(['e1', 'zz'], new Map([['e1', { id: 'e1' } as any]]));
    expect(m.found).toHaveLength(1);
    expect(m.missing).toBe(1);
  });
  it('filters and sorts rows', () => {
    const rows = domainRows(items as any, 'citation');
    expect(filterRows(rows, 'nomatch', 'all', 'answers')).toHaveLength(0);
    expect(filterRows(rows, 'A.COM', 'all', 'name')).toHaveLength(1);
  });
  it('never attributes another domain passage to the selected domain', () => {
    const row = domainRows(items as any, 'citation')[0];
    const e = {citations:[],collection:{sourceReferences:[
      {url:'https://a.com/1',kind:'citation',provenance:'matching'},
      {url:'https://unrelated.test/1',kind:'citation',provenance:'wrong'},
      {url:'https://a.com/1',kind:'retrieval',provenance:'wrong-kind'},
    ]}};
    expect(sourceReferences(e as any,row).map(r=>r.provenance)).toEqual(['matching']);
  });
  it('exposes genuine legacy citation provenance without inventing passage counts', () => {
    const row = domainRows(items as any,'citation')[0];
    const refs = sourceReferences({citations:['https://a.com/1','https://other.test/']} as any,row);
    expect(refs).toHaveLength(1);expect(refs[0].provenance).toBe('stored_citation');expect(refs[0].occurrences).toBeUndefined();
  });
});

describe('filter helpers', () => {
  it('validates custom dates', () => {
    expect(validDates('2025-01-02', '2025-01-01')).toBe('inverted');
    expect(validDates('x', '2025-01-01')).toBe('invalid');
    expect(validDates('2026-02-30','2026-03-02')).toBe('invalid');
    expect(validDates('2025-01-01', '2025-01-01')).toBe('ok');
  });
  it('bounds presets and strips disallowed keys', () => {
    const raw = JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ name: `p${i}`, query: { range: '7', evil: 'http://x' } })));
    const p = readPresets(raw);
    expect(p).toHaveLength(5);
    expect(p[0].query).toEqual({ range: '7' });
    expect(readPresets('not json')).toEqual([]);
    expect(readPresets(JSON.stringify([{name:'Scoped',query:{promptId:'p',prompt:'wrong',answer:'private',ownerId:'other'}}]))[0].query).toEqual({promptId:'p'});
  });
});

import { splitBrands, fanoutPage, analyseCandidates, canAnalyse, jobsBlocked } from '@/lib/use-intelligence';
import { typeCounts } from '@/lib/source-workbench';

describe('intelligence helpers', () => {
  const b = (key: string, extra = {}) => ({ key, name: key, review: 'unreviewed', ambiguous: false, answers: 1, evidenceIds: [], mentions: [], averagePosition: null, firstAnswers: 0, visibility: null, winRate: null, ...extra });
  it('does not rank rejected or unconfirmed ambiguous brands', () => {
    const { ranked, review } = splitBrands([b('a'), b('r', { review: 'rejected' }), b('m', { ambiguous: true }), b('c', { ambiguous: true, review: 'confirmed' })] as any);
    expect(ranked.map((x) => x.key)).toEqual(['a', 'c']);
    expect(review.map((x) => x.key)).toEqual(['r', 'm']);
  });
  it('requires available and enabled, caps and skips queued answers', () => {
    expect(canAnalyse({ available: true, enabled: false } as any)).toBe(false);
    const ids = Array.from({ length: 80 }, (_, i) => `e${i}`);
    const c = analyseCandidates(ids, { jobs: [{ evidenceId: 'e0', state: 'queued', error: null }] } as any);
    expect(c).toHaveLength(50);
    expect(c).not.toContain('e0');
    expect(jobsBlocked({ jobs: [{ evidenceId: 'x', state: 'failed', error: 'BUDGET_WAIT' }] } as any)).toBe(true);
  });
  it('pages and searches fanout queries', () => {
    const qs = Array.from({ length: 20 }, (_, i) => ({ query: `q${i}` })) as any;
    expect(fanoutPage(qs, '', 2).rows).toHaveLength(5);
    expect(fanoutPage(qs, 'q19', 9).rows).toHaveLength(1);
  });
  it('counts source types over unique URLs, unknown stays unknown', () => {
    const it = (url: string, sourceType?: string) => ({ url, domain: 'a.com', kind: 'citation', sourceType, evidenceIds: [] }) as any;
    const t = typeCounts([it('u1', 'editorial'), it('u2'), it('u1', 'editorial')], 'citation');
    expect(t.urls).toBe(2);
    expect(t.counts).toEqual({ editorial: 1, unknown: 1 });
  });
});
