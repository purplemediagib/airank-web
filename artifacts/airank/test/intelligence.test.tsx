import {describe,it,expect} from 'vitest';
import {analyseCandidates,splitBrands,jobsBlocked,fanoutPage} from '@/lib/use-intelligence';
describe('evidence intelligence controls',()=>{
 it('unanalysed answers with null errors can actually be queued, never existing failed or unknown paid jobs',()=>{
  const i={jobs:['not_analysed','queued','running','done','failed','interrupted_unknown','skipped','ineligible_answer_too_long'].map((state,n)=>({evidenceId:String(n),state,error:null}))};
  expect(analyseCandidates(['0','1','2','3','4','5','6','7','new'],i as any)).toEqual(['0','new']);
 });
 it('caps one request at 50 and stops polling on budget/credential problems',()=>{
  expect(analyseCandidates(Array.from({length:70},(_,n)=>String(n)),{jobs:[]} as any)).toHaveLength(50);
  expect(jobsBlocked({jobs:[{state:'queued',error:'BUDGET_WAIT'}]} as any)).toBe(true);
 });
 it('keeps rejected and unconfirmed ambiguous entities out of ranked brands',()=>{
  const ranked={name:'Clear',review:'unreviewed',ambiguous:false},ambiguous={name:'Ambiguous',review:'unreviewed',ambiguous:true};
  expect(splitBrands([ranked,ambiguous,{...ranked,name:'Rejected',review:'rejected'}] as any).ranked).toEqual([ranked]);
 });
 it('filters query text and clamps stale pagination without inventing queries',()=>{
  const q={query:'Cafe marketing',evidenceIds:['e'],answers:1,variants:[],provenances:[],providers:[]};
  expect(fanoutPage([q],'cafe',90)).toMatchObject({total:1,page:1});
  expect(fanoutPage([q],'absent',1)).toMatchObject({total:0,page:1,rows:[]});
 });
});
