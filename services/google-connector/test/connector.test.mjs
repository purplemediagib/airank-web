import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createApp} from '../server.mjs';
import {Store} from '../store.mjs';
import {SCOPES,aiSource,GA_METRICS,reportBody} from '../reports.mjs';
import {googleFailure,safeImportError,GENERIC_IMPORT_ERROR} from '../diagnostics.mjs';

const key=randomBytes(32).toString('hex');
const ret='https://app.example.test/settings/connections';
const conn=(workspace='w1',service='ga4')=>JSON.stringify([workspace,'p1',service]);
async function fixture(t,handler,extra={}){
  const dir=mkdtempSync(join(tmpdir(),'airank-test-'));
  const calls=[];
  const fetcher=async(url,options={})=>{calls.push({url:String(url),options});const value=await handler(String(url),options);return value instanceof Response?value:Response.json(value);};
  const app=createApp({TEST_MODE:true,PUBLIC_BASE_URL:'http://127.0.0.1:9999',APP_RETURN_URLS:ret,DATA_DIR:dir,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',CONNECTOR_API_KEY:key,TOKEN_ENCRYPTION_KEY:key,BACKFILL_DAYS:'1',...extra},fetcher);
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+app.server.address().port;
  t.after(()=>{app.close();rmSync(dir,{recursive:true,force:true});});
  const request=(path,method='GET',b,workspace='w1',auth=key)=>fetch(base+path,{method,redirect:'manual',headers:{Authorization:'Bearer '+auth,'X-AIRank-Workspace-ID':workspace,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});
  return{...app,calls,request,base,dir};
}
const path='/v1/projects/p1/connections/ga4';
function seed(app,k=conn(),overrides={}){app.store.set('connection',k,{workspace:'w1',project:'p1',service:'ga4',googleSub:'sub1',email:'owner@example.test',access_token:'ACCESS',refresh_token:'REFRESH',scope:SCOPES.ga4,expires:Date.now()+3600000,status:'connected',property:'properties/123',generation:'gen1',timeZone:'Europe/Helsinki',currency:'EUR',...overrides});}
async function start(app,service='ga4'){
  let r=await app.request('/v1/projects/p1/connections/'+service+'/connect','POST',{userId:'user1',returnUrl:ret});assert.equal(r.status,200);
  const link=new URL((await r.json()).url);r=await fetch(app.base+link.pathname+link.search,{redirect:'manual'});assert.equal(r.status,303);
  return{state:new URL(r.headers.get('location')).searchParams.get('state'),cookie:r.headers.get('set-cookie').split(';')[0],googleURL:new URL(r.headers.get('location'))};
}
test('encrypted store authenticates row identity and survives reopening',()=>{
  const dir=mkdtempSync(join(tmpdir(),'airank-store-'));
  const s=new Store(dir,key);s.set('token','w1',{secret:'PRIVATE_REFRESH_TOKEN'});assert.equal(readFileSync(join(dir,'airank.sqlite-wal')).includes(Buffer.from('PRIVATE_REFRESH_TOKEN')),false);
  const row=s.db.prepare('SELECT payload FROM records').get();assert.throws(()=>s.open('token','w2',row.payload));s.close();
  const other=new Store(dir,key);assert.deepEqual(other.take('token','w1'),{secret:'PRIVATE_REFRESH_TOKEN'});assert.equal(other.take('token','w1'),null);other.close();rmSync(dir,{recursive:true});
});
test('workspace isolation and unauthenticated API access',async t=>{
  const app=await fixture(t,()=>{throw Error('Should not call Google');});seed(app);
  assert.equal((await app.request(path,'GET',null,'w1','wrong')).status,401);
  const foreign=await(await app.request(path,'GET',null,'w2')).json();assert.equal(foreign.connected,false);
  const own=await(await app.request(path)).json();assert.equal(own.connected,true);assert.equal(own.access_token,undefined);assert.equal(own.refresh_token,undefined);
  assert.equal((await app.request(path+'/properties','GET',null,'w2')).status,404);
});
test('OAuth callback requires original browser, scopes, one-use state and PKCE',async t=>{
  const app=await fixture(t,(url,options)=>{
    if(url.endsWith('/token')){assert.ok(new URLSearchParams(options.body).get('code_verifier'));return{access_token:'ACCESS',refresh_token:'REFRESH',expires_in:3600,scope:'openid email '+SCOPES.ga4};}
    if(url.includes('/userinfo'))return{sub:'sub1',email:'person@example.test',email_verified:true};throw Error('Unexpected Google call');
  });
  assert.equal((await app.request(path+'/connect','POST',{userId:'u1',returnUrl:'https://evil.test'})).status,400);
  const flow=await start(app);assert.equal(flow.googleURL.searchParams.get('code_challenge_method'),'S256');assert.equal(flow.googleURL.searchParams.get('scope'),'openid email '+SCOPES.ga4);
  const cb=app.base+'/v1/oauth/google/callback?code=code1&state='+flow.state;
  assert.equal((await fetch(cb,{redirect:'manual'})).status,403);
  const result=await fetch(cb,{redirect:'manual',headers:{Cookie:flow.cookie}});assert.equal(result.status,303);assert.equal(new URL(result.headers.get('location')).searchParams.get('google_connection'),'connected');
  assert.equal((await fetch(cb,{redirect:'manual',headers:{Cookie:flow.cookie}})).status,400);
  const saved=app.store.get('connection',conn());assert.equal(saved.refresh_token,'REFRESH');assert.equal(saved.email,'person@example.test');
});
test('partial consent leaves previous connection intact',async t=>{
  const app=await fixture(t,()=>({access_token:'NEW',refresh_token:'NEWREFRESH',scope:'openid email'}));seed(app);const flow=await start(app);
  const r=await fetch(app.base+'/v1/oauth/google/callback?code=c&state='+flow.state,{redirect:'manual',headers:{Cookie:flow.cookie}});assert.equal(r.status,403);assert.equal(app.store.get('connection',conn()).refresh_token,'REFRESH');
});
test('different Google account cannot inherit old refresh token',async t=>{
  const app=await fixture(t,url=>url.endsWith('/token')?{access_token:'NEW',scope:SCOPES.ga4}:{sub:'sub2',email:'other@example.test',email_verified:true});seed(app);const flow=await start(app);
  const r=await fetch(app.base+'/v1/oauth/google/callback?code=c&state='+flow.state,{redirect:'manual',headers:{Cookie:flow.cookie}});assert.equal(r.status,409);assert.equal(app.store.get('connection',conn()).googleSub,'sub1');
});
test('refresh token retained, properties paginated, selection validates access',async t=>{
  let refreshes=0;
  const app=await fixture(t,url=>{
    if(url.endsWith('/token')){refreshes++;return{access_token:'NEW',expires_in:3600};}
    if(url.includes('pageToken=next'))return{accountSummaries:[{account:'accounts/1',propertySummaries:[{property:'properties/456'}]}]};
    if(url.includes('accountSummaries'))return{accountSummaries:[{account:'accounts/1',propertySummaries:[{property:'properties/123'}]}],nextPageToken:'next'};
    if(url.endsWith('properties/456'))return{timeZone:'Europe/Helsinki',currencyCode:'EUR'};throw Error('Unexpected call');
  });seed(app,conn(),{expires:0});
  const properties=await(await app.request(path+'/properties')).json();assert.equal(properties.items.length,2);assert.equal(refreshes,1);assert.equal(app.store.get('connection',conn()).refresh_token,'REFRESH');
  assert.equal((await app.request(path+'/selection','PUT',{property:'properties/999'})).status,403);
  assert.equal((await app.request(path+'/selection','PUT',{property:'properties/456'})).status,200);assert.equal(app.store.get('connection',conn()).property,'properties/456');assert.equal(app.store.get('job',conn()).status,'queued');
});
test('revoked refresh token marks reconnect required',async t=>{
  const app=await fixture(t,()=>Response.json({error:'invalid_grant'},{status:400}));seed(app,conn(),{expires:0});assert.equal((await app.request(path+'/properties')).status,409);assert.equal(app.store.get('connection',conn()).status,'reconnect_required');
});
test('GA4 sync caches metadata and paginates reports without leaking other workspace',async t=>{
  const app=await fixture(t,(url,options)=>{
    const b=JSON.parse(options.body),names=b.dimensions.map(d=>d.name),values=names.map(n=>n==='date'?'20261012':n==='sessionSource'?'chatgpt.com':n==='sessionMedium'?'referral':'/');
    return{dimensionHeaders:names.map(name=>({name})),metricHeaders:[{name:'sessions'}],rows:[{dimensionValues:values.map(value=>({value})),metricValues:[{value:'4'}]}],rowCount:1,metadata:{subjectToThresholding:true}};
  });seed(app);await app.tick();assert.equal(app.store.get('job',conn()).status,'complete');assert.equal(app.calls.length,5);
  const day=app.store.list('ga4-day')[0].value.date;
  let r=await(await app.request(path+`/reports?startDate=${day}&endDate=${day}&aiOnly=true`)).json();assert.equal(r.rows[0].aiAssistant,'ChatGPT');assert.equal(r.rows[0].sessions,4);assert.equal(r.metadata[0].googleMetadata[0].subjectToThresholding,true);
  assert.equal((await app.request(path+`/reports?startDate=${day}&endDate=${day}`,'GET',null,'w2')).status,404);
});
test('GSC keeps independent property totals and accepts domain properties',async t=>{
  const app=await fixture(t,(url,options)=>{
    assert.ok(url.includes('sc-domain%3Aexample.test'));const b=JSON.parse(options.body);assert.equal(b.dataState,'final');return{rows:[{keys:b.dimensions.length?['query']:[],clicks:b.dimensions.length?7:10,impressions:100,ctr:0.1,position:2}]};
  });seed(app,conn('w1','gsc'),{service:'gsc',property:'sc-domain:example.test',scope:SCOPES.gsc});await app.tick();
  const day=app.store.list('gsc-day')[0].value;assert.equal(day.totals.clicks,10);assert.equal(day.queries.rows[0].clicks,7);assert.equal(app.calls.length,5);
});
test('retryable Google failures persist a resumable job',async t=>{
  const app=await fixture(t,()=>Response.json({error:{status:'RESOURCE_EXHAUSTED'}},{status:429}));seed(app);await app.tick();const job=app.store.get('job',conn());assert.equal(job.status,'retrying');assert.equal(job.cursor,0);assert.ok(job.nextAttempt>Date.now());
});
test('structured Google diagnostics allowlist status/reason but never message or metadata',()=>{
  const fixtures=[
    [403,'PERMISSION_DENIED','SERVICE_DISABLED','api_disabled'],
    [403,'PERMISSION_DENIED','ACCESS_TOKEN_SCOPE_INSUFFICIENT','permission'],
    [429,'RESOURCE_EXHAUSTED','RATE_LIMIT_EXCEEDED','quota'],
    [400,'INVALID_ARGUMENT','METRIC_DIMENSION_INCOMPATIBLE','report_incompatible'],
    [400,'INVALID_ARGUMENT',undefined,'invalid_request'],
    [503,'UNAVAILABLE',undefined,'unavailable'],
    [401,'UNAUTHENTICATED',undefined,'authentication'],
  ];
  for(const [http,status,reason,category]of fixtures){
    const e=googleFailure(http,{error:{status,message:'SENTINEL_ACCESS SENTINEL_REFRESH client_secret private-property',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason,metadata:{token:'SENTINEL_ACCESS',consumer:'private-project'}}]}});
    assert.equal(e.diagnostic,`GOOGLE_IMPORT_FAILED category=${category} http=${http} status=${status}${reason?' reason='+reason:''}`);
    assert.equal(safeImportError(e.diagnostic),e.diagnostic);
    assert.doesNotMatch(e.message,/SENTINEL_ACCESS|SENTINEL_REFRESH|client_secret|private/);
  }
  const unknown=googleFailure(403,{error:{status:'SECRET',message:'REFRESH',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'REFRESH'}],errors:[{reason:'ACCESS'}]}});
  assert.equal(unknown.diagnostic,'GOOGLE_IMPORT_FAILED category=permission http=403');
  assert.equal(googleFailure(400,{error:'invalid_grant',error_description:'REFRESH'}).diagnostic,'GOOGLE_IMPORT_FAILED category=authentication http=400 reason=invalid_grant');
  assert.equal(googleFailure(403,{error:{errors:[{reason:'accessNotConfigured',message:'SECRET'}]}}).diagnostic,'GOOGLE_IMPORT_FAILED category=api_disabled http=403 reason=accessNotConfigured');
  assert.equal(safeImportError('old unsafe Google error token=REFRESH'),GENERIC_IMPORT_ERROR);
});
test('failed GA4 day preserves completed cache, ownership and resumable cursor',async t=>{
  const app=await fixture(t,()=>Response.json({error:{code:400,status:'INVALID_ARGUMENT',message:'raw property and token ACCESS',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'METRIC_DIMENSION_INCOMPATIBLE',metadata:{secret:'REFRESH'}}]}},{status:400}));
  seed(app);seed(app,conn('w2'),{workspace:'w2'});
  const cached={connectionKey:conn(),date:'2026-10-01',property:'properties/123',sources:{rows:[{sessionSource:'chatgpt.com',sessions:4}]},syncedAt:'2026-10-02T00:00:00Z'};
  app.store.set('ga4-day',JSON.stringify([conn(),cached.date]),cached);
  app.store.set('job',conn(),{connectionKey:conn(),generation:'gen1',status:'queued',dates:['2026-10-01','2026-10-02'],cursor:1,attempts:0,nextAttempt:0});
  await app.tick();
  const job=app.store.get('job',conn());
  assert.equal(job.status,'failed');assert.equal(job.cursor,1);
  assert.equal(job.lastError,'GOOGLE_IMPORT_FAILED category=report_incompatible http=400 status=INVALID_ARGUMENT reason=METRIC_DIMENSION_INCOMPATIBLE');
  assert.doesNotMatch(JSON.stringify(job),/raw property|ACCESS|REFRESH|metadata/);
  assert.deepEqual(app.store.get('ga4-day',JSON.stringify([conn(),cached.date])),cached);
  assert.equal(app.store.get('ga4-day',JSON.stringify([conn(),'2026-10-02'])),null);
  const own=await(await app.request(path)).json();assert.equal(own.sync.lastError,job.lastError);assert.equal(own.sync.completedDays,1);
  const foreign=await(await app.request(path,'GET',null,'w2')).json();assert.equal(foreign.sync.lastError,null);
  const report=await(await app.request(path+'/reports?startDate=2026-10-01&endDate=2026-10-02')).json();
  assert.equal(report.rows[0].sessions,4);assert.deepEqual(report.missingDates,['2026-10-02']);
  // Explicit retry resumes failed day, not a new backfill; cached dates are retained.
  const calls=app.calls.length;assert.equal((await app.request(path+'/sync','POST',{})).status,202);
  const resumed=app.store.get('job',conn());assert.equal(resumed.cursor,1);assert.equal(resumed.lastError,null);
  assert.deepEqual(resumed.dates,job.dates);assert.equal(app.calls.length,calls);
  assert.deepEqual(app.store.get('ga4-day',JSON.stringify([conn(),cached.date])),cached);
});
test('unknown legacy job errors are redacted before authenticated status returns',async t=>{
  const app=await fixture(t,()=>assert.fail('No Google call expected'));seed(app);
  app.store.set('job',conn(),{status:'failed',cursor:0,dates:['2026-10-01'],lastError:'token=REFRESH'});
  const status=await(await app.request(path)).json();assert.equal(status.sync.lastError,GENERIC_IMPORT_ERROR);assert.equal(app.calls.length,0);
});
test('transport and non-JSON failures have safe diagnostics and retain retry semantics',async t=>{
  for(const [handler,expected,retry]of [
    [()=>{throw Error('Authorization Bearer ACCESS');},'GOOGLE_IMPORT_FAILED category=transport',true],
    [()=>new Response('private upstream html REFRESH',{status:403}),'GOOGLE_IMPORT_FAILED category=permission http=403',false],
    [()=>new Response('private upstream html REFRESH',{status:503}),'GOOGLE_IMPORT_FAILED category=unavailable http=503',true],
    [()=>new Response('not json ACCESS'),'GOOGLE_IMPORT_FAILED category=invalid_response',true],
  ]){
    const app=await fixture(t,handler);seed(app);await app.tick();
    const job=app.store.get('job',conn());assert.equal(job.lastError,expected);assert.equal(job.status,retry?'retrying':'failed');
  }
});
test('GA4 report contract requests exact original metric/dimension sets (not live compatibility proof)',()=>{
  const dimensions={overview:['date'],sources:['date','sessionSource','sessionMedium'],pages:['date','sessionSource','sessionMedium','landingPagePlusQueryString'],countries:['date','sessionSource','sessionMedium','country'],devices:['date','sessionSource','sessionMedium','deviceCategory']};
  assert.deepEqual(GA_METRICS,['sessions','engagedSessions','engagementRate','keyEvents','sessionKeyEventRate','totalRevenue']);
  for(const [kind,names]of Object.entries(dimensions)){
    const body=reportBody(kind,'2026-10-01');assert.deepEqual(body.dimensions.map(d=>d.name),names);
    assert.deepEqual(body.metrics.map(m=>m.name),GA_METRICS);assert.equal(body.returnPropertyQuota,true);
  }
});
test('disconnect deletes only target connection and never revokes project-wide Google grant',async t=>{
  const app=await fixture(t,()=>{throw Error('Must not revoke grant');});seed(app);seed(app,conn('w2'),{workspace:'w2'});await app.request(path,'DELETE');assert.equal(app.store.get('connection',conn()),null);assert.ok(app.store.get('connection',conn('w2')));assert.equal(app.calls.length,0);
});
test('setup-only mode is healthy but blocks integration access',async t=>{
  const app=await fixture(t,()=>{}, {GOOGLE_CLIENT_SECRET:''});assert.equal((await fetch(app.base+'/health')).status,200);assert.equal((await fetch(app.base+'/ready')).status,503);assert.equal((await app.request(path)).status,503);
});
test('classification rejects lookalike domains and does not claim all organic Google is AI',()=>{
  assert.equal(aiSource('chatgpt.com'),'ChatGPT');assert.equal(aiSource('www.perplexity.ai'),'Perplexity');assert.equal(aiSource('chatgpt.com.evil.test'),null);assert.equal(aiSource('google'),null);assert.equal(aiSource('bing.com'),null);
});
