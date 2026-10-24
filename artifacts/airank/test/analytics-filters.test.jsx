import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,renderHook} from '@testing-library/react';
import {useAnalyticsFilters} from '../src/lib/use-analytics';
import {scopeEvidence} from '../src/lib/overview-data';
import {analyticsFixture} from './overview-fixtures.js';
import {resultParamsFromSearch,resultsContextQuery} from '../src/lib/sentiment';
import {readPresets} from '../src/components/airank/analytics-filters';
import {getProjectAnalytics,listProjectResults} from '@workspace/api-client-react';
const url = query => window.history.replaceState({}, '', `/en/dashboard?project=project-test&${query}`);
beforeEach(()=>url(''));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('measurement filter URL contract',()=>{
 it('generated analytics and results requests preserve encoded tag names and locale filters',async()=>{
  const fetch=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({}),{status:200,headers:{'Content-Type':'application/json'}}));
  vi.stubGlobal('fetch',fetch);
  const params={tags:JSON.stringify(['research, discovery','pricing & cost']),tagMode:'and',market:'FI',language:'en'};
  await getProjectAnalytics('project-test',params);
  await listProjectResults('project-test',params);
  expect(fetch).toHaveBeenCalledTimes(2);
  for(const [input] of fetch.mock.calls){
   const p=new URL(typeof input==='string'?input:input.url,window.location.origin).searchParams;
   expect(p.get('tags')).toBe(params.tags);expect(p.get('tagMode')).toBe('and');
   expect(p.get('market')).toBe('FI');expect(p.get('language')).toBe('en');
  }
 });
 it('honours API-named runId drilldowns and clears them on a new measurement filter',()=>{
  url('runId=frozen&market=FI');
  const {result}=renderHook(()=>useAnalyticsFilters());
  expect(result.current.params.runId).toBe('frozen');
  act(()=>result.current.setLanguage('en'));
  expect(result.current.params.runId).toBeUndefined();
 });
 it('re-resolves a selected results composition when its measurement filters change',()=>{
  window.history.replaceState({},'','/en/dashboard/results?project=project-test&group=old&surface=model_api');
  const {result}=renderHook(()=>useAnalyticsFilters());
  act(()=>result.current.setSurface('consumer_web'));
  expect(new URLSearchParams(window.location.search).get('group')).toBe('latest');
  expect(result.current.params.group).toBeUndefined();
  expect(resultParamsFromSearch(window.location.search).group).toBe('latest');
 });
 it('sends bounded multi-tag selection, mode and independent market/language and clears stale context',()=>{
  url('tag=pricing&group=old&run=old&answer=old&evidence=old&src=old&page=3');
  const {result}=renderHook(()=>useAnalyticsFilters());
  act(()=>result.current.setTags(['pricing','research, discovery']));
  act(()=>result.current.setTagMode('and'));
  act(()=>result.current.setMarket('FI'));
  act(()=>result.current.setLanguage('en'));
  expect(result.current.params).toMatchObject({tags:'["pricing","research, discovery"]',tagMode:'and',market:'FI',language:'en'});
  expect(result.current.params.tag).toBeUndefined();
  expect(result.current.tags).toEqual(['pricing','research, discovery']);
  const p=new URLSearchParams(window.location.search);
  for(const key of ['tag','group','run','answer','evidence','src','page'])expect(p.has(key)).toBe(false);
  const results=resultParamsFromSearch(window.location.search);
  expect(results).toMatchObject({tags:result.current.params.tags,tagMode:'and',market:'FI',language:'en'});
  expect(new URLSearchParams(resultsContextQuery(window.location.search)).get('tags')).toBe(result.current.params.tags);
  act(()=>result.current.reset());
  expect(window.location.search).toBe('?project=project-test');
 });
 it('keeps complete multi-tag selections in saved presets instead of truncating JSON',()=>{
  const tags=JSON.stringify(Array.from({length:12},(_,i)=>`tag-${i}-`+'x'.repeat(30)));
  const query={tags,tagMode:'and',market:'FI',language:'en',notAllowed:'ignored'};
  const [preset]=readPresets(JSON.stringify([{name:'Research',query}]));
  expect(preset.query).toEqual({tags,tagMode:'and',market:'FI',language:'en'});
 });
 it('guards evidence with OR/AND tags and frozen independent locale constraints',()=>{
  const a=analyticsFixture(),base=a.evidence.find(e=>!e.exclusion);
  a.evidence=[{...base,id:'both',tags:['a','b'],market:'FI',language:'en'},
   {...base,id:'one',tags:['a'],market:'FI',language:'en'},
   {...base,id:'different-language',tags:['a','b'],market:'FI',language:'fi'}];
  const filters={from:'2026-01-01',to:'2026-12-31',provider:'all',topic:'all',tags:['a','b'],market:'FI',language:'en'};
  expect(scopeEvidence(a,{...filters,tagMode:'and'}).map(e=>e.id)).toEqual(['both']);
  expect(scopeEvidence(a,{...filters,tagMode:'or'}).map(e=>e.id)).toEqual(['both','one']);
 });
 it('honours inclusive UTC dates from evidence deep links instead of silently replacing them',()=>{
  url('from=2026-01-02&to=2026-01-03');
  const {result}=renderHook(()=>useAnalyticsFilters());
  expect(result.current.range).toBe('custom');
  expect(result.current.params).toMatchObject({from:'2026-01-02',to:'2026-01-03'});
  expect(result.current.days).toBe(2);
 });
 it('scopes tag and collection method and discards stale group, drawer and pagination IDs',()=>{
  url('provider=openai&group=old&run=old&answer=old&src=old&page=4&answersPage=3');
  const {result}=renderHook(()=>useAnalyticsFilters());
  act(()=>result.current.setTag('pricing'));
  act(()=>result.current.setSurface('consumer_web'));
  expect(result.current.params).toMatchObject({provider:'openai',tag:'pricing',surface:'consumer_web'});
  const p=new URLSearchParams(window.location.search);
  expect(p.get('project')).toBe('project-test');
  for(const key of ['group','run','answer','src','page','answersPage'])expect(p.has(key)).toBe(false);
 });
 it('clears a previous prompt version when selecting a different tracked prompt',()=>{
  url('promptId=old&promptVersion=2');
  const {result}=renderHook(()=>useAnalyticsFilters());
  act(()=>result.current.setPromptId('new'));
  expect(result.current.params.promptId).toBe('new');expect(result.current.params.promptVersion).toBeUndefined();
  act(()=>result.current.setPromptVersion('3'));
  expect(result.current.params.promptVersion).toBe(3);
 });
 it('rejects rolled-over and inverted dates then applies a valid pair atomically',()=>{
  const {result}=renderHook(()=>useAnalyticsFilters());
  const before=window.location.search;
  act(()=>{expect(result.current.setDates('2026-02-30','2026-03-01')).toBe(false);});
  act(()=>{expect(result.current.setDates('2026-03-02','2026-03-01')).toBe(false);});
  expect(window.location.search).toBe(before);
  act(()=>result.current.setDates('2026-02-01','2026-02-28'));
  expect(result.current.params).toMatchObject({from:'2026-02-01',to:'2026-02-28'});
 });
 it('preset ranges clear custom dates and resetting keeps the selected workspace',()=>{
  url('from=2000-01-01&to=2000-01-10&range=custom&tag=pricing&surface=consumer_web');
  const {result}=renderHook(()=>useAnalyticsFilters());
  act(()=>result.current.setRange('7'));
  expect(result.current.range).toBe('7');expect(new URLSearchParams(window.location.search).has('from')).toBe(false);
  act(()=>result.current.reset());
  expect(window.location.search).toBe('?project=project-test');
 });
 it('defensive evidence guards enforce all selected prompt/tag/method constraints',()=>{
  const a=analyticsFixture(),base=a.evidence.find(e=>!e.exclusion);
  a.evidence=[{...base,id:'match',tags:['pricing'],measurementSurface:'consumer_web',promptId:'p',promptVersion:2},
   {...base,id:'wrong-method',tags:['pricing'],measurementSurface:'model_api',promptId:'p',promptVersion:2},
   {...base,id:'wrong-version',tags:['pricing'],measurementSurface:'consumer_web',promptId:'p',promptVersion:1}];
  const rows=scopeEvidence(a,{from:'2026-01-01',to:'2026-12-31',provider:'all',topic:'all',tag:'pricing',surface:'consumer_web',promptId:'p',promptVersion:'2'});
  expect(rows.map(e=>e.id)).toEqual(['match']);
 });
});
