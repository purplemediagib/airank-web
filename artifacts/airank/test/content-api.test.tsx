import {describe,it,expect,vi,afterEach} from 'vitest';
import {contentClient,ContentError,contentPermissions,createJobSubmitter} from '../src/lib/content-api';
const make=()=>contentClient('project',()=> 'synthetic-csrf','/api/airank/v1');
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
describe('Content Studio authenticated client',()=>{
 it('uses same-origin proxy and version-aware saves',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({id:'doc',version:3}));vi.stubGlobal('fetch',fetch);
  expect((await make().save('doc',2,{markdown:'Synthetic article'})).version).toBe(3);
  expect(fetch.mock.calls[0][0]).toBe('/api/airank/v1/projects/project/content/documents/doc');
  const options=fetch.mock.calls[0][1];
  expect(options.credentials).toBe('same-origin');expect(options.headers['X-CSRF-Token']).toBe('synthetic-csrf');
  expect(JSON.parse(options.body)).toMatchObject({expectedVersion:2,markdown:'Synthetic article'});
 });
 it('rejects writes without CSRF before making a request',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await expect(contentClient('project',()=> '').submit('audit',{},'intent')).rejects.toMatchObject({code:'AUTH_REQUIRED'});
  expect(fetch).not.toHaveBeenCalled();
 });
 it('preserves conflicts and budget/configuration codes instead of reporting success',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:{code:'VERSION_CONFLICT'}},{status:409})));
  await expect(make().save('doc',1,{markdown:'keep my buffer'})).rejects.toMatchObject({status:409,code:'VERSION_CONFLICT'});
 });
 it('classifies transport errors as uncertain and never retries a mutation automatically',async()=>{
  const fetch=vi.fn().mockRejectedValue(new TypeError('network'));vi.stubGlobal('fetch',fetch);
  await expect(make().submit('publish',{documentId:'doc',documentVersion:2},'intent')).rejects.toMatchObject({status:0,code:'CONNECTION_UNCERTAIN'});
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('GETs do not carry mutation headers or body',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json([]));vi.stubGlobal('fetch',fetch);await make().documents();
  expect(fetch.mock.calls[0][1].body).toBeUndefined();expect(fetch.mock.calls[0][1].headers['X-CSRF-Token']).toBeUndefined();
 });
 it('rejects paths escaping the content scope',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await expect(make().request('GET','/../settings')).rejects.toMatchObject({code:'INVALID_PATH'});
  expect(fetch).not.toHaveBeenCalled();
 });
 it('submits only selected rewrite changes with exact current revision',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({version:5}));vi.stubGlobal('fetch',fetch);
  await make().apply('doc',4,'job',['change-two']);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({expectedVersion:4,jobId:'job',changeIds:['change-two']});
 });
 it('approval carries the explicit fact confirmation and exact revision',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({version:5,status:'approved'}));vi.stubGlobal('fetch',fetch);
  await make().review('doc',4,'approved',true,'Reviewed');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({expectedVersion:4,status:'approved',factsChecked:true});
 });
 it('exports real returned strings without starting generation or publishing',async()=>{
  const data={title:'Synthetic',markdown:'# Synthetic',html:'<h1>Synthetic</h1>',plainText:'Synthetic'};
  const fetch=vi.fn().mockResolvedValue(Response.json(data));vi.stubGlobal('fetch',fetch);
  expect(await make().export('doc')).toMatchObject(data);expect(fetch.mock.calls[0][1].method).toBe('GET');
 });
});
describe('persistent intentional job submissions',()=>{
 it('reuses an id after lost acknowledgement, including after remount',async()=>{
  const ids:string[]=[];let fail=true;
  const client={...make(),submit:vi.fn(async(_kind:any,_input:any,id:string)=>{ids.push(id);if(fail)throw new ContentError(0,'CONNECTION_UNCERTAIN');return{id:'job'}as any;})};
  const first=createJobSubmitter(client,'user:project',sessionStorage);
  await expect(first.submit('audit',{documentId:'doc',documentVersion:1})).rejects.toMatchObject({status:0});
  fail=false;
  const remount=createJobSubmitter(client,'user:project',sessionStorage);
  await remount.submit('audit',{documentVersion:1,documentId:'doc'});
  expect(ids[0]).toBe(ids[1]);expect(remount.pending()).toBeUndefined();
 });
 it('never reuses an intent id for changed inputs',async()=>{
  const ids:string[]=[];
  const client={...make(),submit:vi.fn(async(_kind:any,_input:any,id:string)=>{ids.push(id);throw new ContentError(503,'UPSTREAM_UNAVAILABLE');})};
  const submitter=createJobSubmitter(client,'user:project',sessionStorage);
  await submitter.submit('audit',{documentVersion:1}).catch(()=>{});
  await submitter.submit('audit',{documentVersion:2}).catch(()=>{});
  expect(ids[0]).not.toBe(ids[1]);
 });
 it('blocks a new publication while an earlier write is uncertain',async()=>{
  const client={...make(),submit:vi.fn(async()=>{throw new ContentError(0,'CONNECTION_UNCERTAIN');})};
  const submitter=createJobSubmitter(client,'user:project',sessionStorage);
  await submitter.submit('publish',{documentId:'doc',documentVersion:1}).catch(()=>{});
  await expect(submitter.submit('publish',{documentId:'doc',documentVersion:2})).rejects.toMatchObject({code:'PUBLICATION_RECONCILIATION_REQUIRED'});
  expect(client.submit).toHaveBeenCalledTimes(1);
 });
 it('separates users and projects',async()=>{
  const client={...make(),submit:vi.fn(async()=>{throw new ContentError(0,'CONNECTION_UNCERTAIN');})};
  await createJobSubmitter(client,'alice:one',sessionStorage).submit('audit',{documentId:'doc'}).catch(()=>{});
  expect(createJobSubmitter(client,'bob:one',sessionStorage).pending()).toBeUndefined();
  expect(createJobSubmitter(client,'alice:two',sessionStorage).pending()).toBeUndefined();
 });
 it('does not retain a known validation rejection as an uncertain publication',async()=>{
  const client={...make(),submit:vi.fn(async()=>{throw new ContentError(422,'PUBLISH_STATUS_REQUIRED');})};
  const submitter=createJobSubmitter(client,'user:project',sessionStorage);
  await submitter.submit('publish',{}).catch(()=>{});expect(submitter.pending()).toBeUndefined();
 });
});
describe('role affordances match deployed server rules',()=>{
 it.each([
  ['owner',true,true,true],['editor',true,false,false],['reviewer',false,true,false],['viewer',false,false,false],
 ]as const)('%s has exact edit/review/manage permissions',(role,edit,review,manage)=>{
  expect(contentPermissions(role)).toEqual({read:true,edit,review,manage});
 });
});
