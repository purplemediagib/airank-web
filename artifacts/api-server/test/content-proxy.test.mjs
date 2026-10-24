import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createAirankRouter} from '../src/routes/airank.ts';
import {isContentRoute} from '../src/routes/content-paths.ts';
const origin='https://preview.example.test';
const prefix='/v1/projects/fixture-project/content';
const headers={origin,'content-type':'application/json','x-csrf-token':'synthetic-csrf',cookie:'__Host-airank_session=synthetic-session; unrelated=drop'};
async function fixture(transport,run){
 const app=express();app.use(createAirankRouter({origin,upstream:'https://api.example.test',clientId:'fixture',transport}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(r=>server.close(r));}
}
test('all and only documented Content Studio operations are allowlisted',()=>{
 for(const [method,suffix]of [
  ['GET',''],['GET','/documents'],['POST','/documents'],['GET','/documents/doc'],['PATCH','/documents/doc'],
  ...['revisions','export'].map(x=>['GET','/documents/doc/'+x]),
  ...['restore','review','apply','published'].map(x=>['POST','/documents/doc/'+x]),
  ...['brand','settings','access','cms'].flatMap(x=>[['GET','/'+x],['PUT','/'+x]]),
  ['GET','/cms/items'],['GET','/jobs'],['POST','/jobs'],['GET','/jobs/job'],
  ['POST','/jobs/job/cancel'],['POST','/jobs/job/retry'],['POST','/bulk'],
  ['GET','/comments'],['POST','/comments'],['PATCH','/comments/comment'],
  ...['sources','opportunities','publications','assessments'].flatMap(x=>[['GET','/'+x],['GET','/'+x+'/record']]),
  ['PATCH','/opportunities/opportunity'],['POST','/publications/publication/reconcile'],['GET','/usage'],['GET','/events'],
 ])assert.equal(isContentRoute(method,prefix+suffix),true,method+suffix);
 assert.equal(isContentRoute('GET','/v1/app/content-projects'),true);
 for(const [method,suffix]of [['DELETE','/documents/doc'],['POST','/sources'],['GET','/jobs/job/retry'],['POST','/cms/items'],['GET','/arbitrary'],['POST','/documents/doc/publish'],['GET','/documents/doc/extra'],['PUT','/jobs'],['PATCH','/access/member']])
  assert.equal(isContentRoute(method,prefix+suffix),false,method+suffix);
});
test('content proxy forwards only session, registered client, CSRF and supported query keys',async()=>{
 const seen=[];
 await fixture(async(url,options)=>{seen.push({url,options});return Response.json({ok:true});},async base=>{
  await fetch(base+prefix+'/cms/items?page=2&search=article&type=pages&workspaceId=evil&token=notforwarded',{headers});
  assert.equal(seen[0].url.search,'?page=2&search=article&type=pages');
  assert.equal(seen[0].options.headers.cookie,'__Host-airank_session=synthetic-session');
  assert.equal(seen[0].options.headers['x-airank-client'],'fixture');
  await fetch(base+prefix+'/comments?documentId=doc&userId=someone',{headers});
  assert.equal(seen[1].url.search,'?documentId=doc');
  await fetch(base+prefix+'/documents/doc',{method:'PATCH',headers,body:JSON.stringify({expectedVersion:4,markdown:'Private synthetic text'})});
  assert.equal(seen[2].options.headers.origin,origin);
  assert.equal(seen[2].options.headers['x-csrf-token'],'synthetic-csrf');
  assert.equal(JSON.parse(seen[2].options.body).expectedVersion,4);
 });
});
test('content mutations retain origin and CSRF protection before reaching upstream',async()=>{
 let calls=0;
 await fixture(async()=>{calls++;return Response.json({});},async base=>{
  for(const bad of [{...headers,origin:'https://hostile.example.test'},{origin,'content-type':'application/json'}]){
   assert.equal((await fetch(base+prefix+'/jobs',{method:'POST',headers:bad,body:'{}'})).status,403);
  }
  assert.equal(calls,0);
 });
});
test('512 KiB content limit does not increase unrelated 64 KiB limits',async()=>{
 await fixture(async()=>Response.json({ok:true}),async base=>{
  const request=(path,n)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify({markdown:'x'.repeat(n)})});
  assert.equal((await request(prefix+'/documents',100000)).status,200);
  assert.equal((await request('/v1/projects',100000)).status,413);
  assert.equal((await request(prefix+'/documents',530000)).status,413);
 });
});
test('backend permission, conflict, size, validation, budget and configuration errors are preserved',async()=>{
 for(const [status,code]of [[401,'AUTH_REQUIRED'],[403,'CONTENT_PERMISSION_DENIED'],[404,'NOT_FOUND'],[409,'VERSION_CONFLICT'],[413,'BODY_TOO_LARGE'],[422,'FACT_REVIEW_REQUIRED'],[429,'CONTENT_BUDGET_EXCEEDED'],[503,'CONTENT_MODEL_NOT_CONFIGURED']]){
  await fixture(async()=>Response.json({error:{code}},{status,headers:{'retry-after':'12'}}),async base=>{
   const r=await fetch(base+prefix,{headers});assert.equal(r.status,status);assert.equal((await r.json()).error.code,code);assert.equal(r.headers.get('retry-after'),'12');
  });
 }
});
test('unsupported methods and extra paths are rejected without contacting upstream',async()=>{
 let calls=0;
 await fixture(async()=>{calls++;return Response.json({});},async base=>{
  assert.equal((await fetch(base+prefix+'/cms/credentials',{headers})).status,404);
  assert.equal((await fetch(base+prefix+'/jobs/job/retry/again',{method:'POST',headers,body:'{}'})).status,404);
  assert.equal((await fetch(base+prefix+'/documents/doc',{method:'DELETE',headers,body:'{}'})).status,404);
  assert.equal(calls,0);
 });
});
