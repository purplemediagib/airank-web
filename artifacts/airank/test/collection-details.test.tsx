import {beforeEach,expect,it} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {I18nProvider} from '@/i18n';
import {CollectionDetails} from '@/components/airank/collection-details';
import type {ApiObservation} from '@workspace/api-client-react';
const collection={
 version:'consumer-evidence-v1',supplier:'scrapeless',surface:'consumer_web',requestedMarket:'GI',requestedLanguage:'en',
 locationVerification:'unverified',modelVersionVerified:false,citationObservation:'observed',searchQueries:null,
 sourceReferences:[{url:'https://example.com/',kind:'citation' as const,provenance:'answer_reference',occurrences:2},{url:'https://other.test/',kind:'retrieval' as const,provenance:'web_search_results'}],
};
beforeEach(()=>{cleanup();window.history.replaceState({},'', '/en/dashboard');});
it('shows web provenance, evidence types and location uncertainty without supplier routing labels',()=>{
 render(<I18nProvider><CollectionDetails collection={collection}/></I18nProvider>);
 expect(screen.getByTestId('collection-surface').textContent).toContain('Consumer-web answer');
 expect(screen.getByText('The physical collection location is not verified.')).toBeTruthy();
 expect(screen.getByText('Background search queries are unavailable.')).toBeTruthy();
 expect(screen.getByTestId('collection-source-summary').textContent).toContain('1 retrieved results');
 expect(screen.queryByText('scrapeless')).toBeNull();
});
it('keeps unavailable citation coverage separate from zero and reports safe failure reasons',()=>{
 render(<I18nProvider><CollectionDetails collection={{...collection,citationObservation:'unavailable'}} meta={{failure_code:'SUBMISSION_UNKNOWN'}}/></I18nProvider>);
 expect(screen.getByText(/Citation coverage is unavailable, not zero/)).toBeTruthy();
 expect(screen.getByTestId('collection-error').textContent).toContain('No replacement paid request');
});
it('renders API provenance separately and blocks unsafe source links',()=>{
 const {unmount}=render(<I18nProvider><CollectionDetails surface="model_api"/></I18nProvider>);
 expect(screen.getByTestId('collection-surface').textContent).toContain('Model API answer');unmount();
 const {container}=render(<I18nProvider><CollectionDetails collection={{...collection,sourceReferences:[{url:'javascript:alert(1)',kind:'citation',provenance:'test'}]}}/></I18nProvider>);
 expect(container.querySelectorAll('a')).toHaveLength(0);
});
const observation:ApiObservation={
 version:'api-occurrence-evidence-v1',complete:true,citationObservation:'observed',
 retrievalObservation:'unavailable',fanoutObservation:'unavailable',
 citationOccurrences:[
  {url:'https://example.test/source',provenance:'provider_annotation',blockIndex:0,start:0,end:12},
  {url:'https://example.test/source',provenance:'provider_annotation',blockIndex:1,start:4,end:16},
 ],
};
it('preserves repeated API citation occurrences and explains local spans, unavailable telemetry and versions',()=>{
 render(<I18nProvider><CollectionDetails observation={observation} collectionMethod="complete-answer-visibility-v2" metricVersion="neutral-complete-answer-weighted-v3"/></I18nProvider>);
 expect(screen.getByTestId('collection-surface').textContent).toBe('Model API answer');
 expect(screen.getByTestId('api-citation-count').textContent).toContain('2');
 expect(screen.getByTestId('api-citation-occurrences').querySelectorAll('li')).toHaveLength(2);
 expect(screen.getAllByRole('link',{hidden:true})).toHaveLength(2);
 expect(screen.getByText(/NOT global answer highlights/)).toBeTruthy();
 expect(screen.getByText('Provider-local span: Block 0 · 0–12')).toBeTruthy();
 expect(screen.getByTestId('api-retrieval-observation').textContent).toContain('no retrieval count is inferred');
 expect(screen.getByTestId('api-fanout-observation').textContent).toContain('unavailable, not zero');
 expect(screen.getByTestId('collection-method').textContent).toContain('Complete-answer visibility');
 expect(screen.getByTestId('collection-metric-version').textContent).toContain('neutral-complete-answer-weighted-v3');
});
it('does not turn incomplete or unavailable API evidence into a zero result or unsafe links',()=>{
 const {container}=render(<I18nProvider><CollectionDetails observation={{...observation,complete:false,citationObservation:'unavailable',citationOccurrences:[{url:'javascript:alert(1)',provenance:'provider_annotation'}]}}/></I18nProvider>);
 expect(screen.getByText(/Answer completion is not confirmed/)).toBeTruthy();
 expect(screen.getByText('Citation observation is unavailable, not zero.')).toBeTruthy();
 expect(screen.queryByTestId('api-citation-count')).toBeNull();
 expect(container.querySelectorAll('a, mark')).toHaveLength(0);
});
it.each(['en','fi'])('shows readable budget and output-limit reasons in %s without implying zero',locale=>{
 window.history.replaceState({},'',`/${locale}/dashboard`);
 for(const code of ['API_BUDGET_NOT_CONFIGURED','API_BUDGET_EXHAUSTED','API_BUDGET_ALREADY_RESERVED','API_BUDGET_INVALID_CONFIG','API_BUDGET_MIGRATION_REQUIRED','API_BUDGET_ROUTE_MISMATCH','API_BUDGET_UNBOUNDED_ROUTE','API_BUDGET_LIMIT_MISMATCH','API_BUDGET_RESERVATION_REQUIRED','API_BUDGET_FUTURE_REASON','OUTPUT_TOKEN_LIMIT']){
  const {unmount}=render(<I18nProvider><CollectionDetails meta={{failure_code:code}}/></I18nProvider>);
  const text=screen.getByTestId('collection-error').textContent;
  expect(text).toContain(locale==='en'?'not interpreted as a zero result':'ei tulkita nollatulokseksi');
  expect(text).toContain(locale==='en'?(code==='OUTPUT_TOKEN_LIMIT'?'output token limit':'budget'):(code==='OUTPUT_TOKEN_LIMIT'?'pituusrajan':'budjet'));
  unmount();
 }
});
