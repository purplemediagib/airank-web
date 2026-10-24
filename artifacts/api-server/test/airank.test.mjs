import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAirankRouter, safeCookies, safeSetCookie } from '../src/routes/airank.ts';

const origin = 'https://preview.example.com';
test('Google connection routes are explicit, keep report filters and protect every mutation',async()=>{
 const seen=[];
 await fixture(async(url,options)=>{seen.push({url,options});return Response.json({configured:false,status:'setup_required'});},async base=>{
  const prefix=base+'/v1/projects/owned/connections/ga4';
  const headers={origin,'content-type':'application/json','x-csrf-token':'csrf',cookie:'__Host-airank_session=owner'};
  assert.equal((await fetch(prefix)).status,200);
  assert.equal((await fetch(prefix+'/reports?startDate=2026-10-01&endDate=2026-10-02&view=sources&aiOnly=true&offset=25&limit=25&workspaceId=evil&url=https://evil.test')).status,200);
  const q=seen.at(-1).url.searchParams;
  for(const k of ['startDate','endDate','view','aiOnly','offset','limit'])assert.ok(q.has(k));
  assert.equal(q.has('workspaceId'),false);assert.equal(q.has('url'),false);
  for(const [method,suffix,body]of [['POST','/connect',{}],['PUT','/selection',{property:'properties/123'}],['POST','/sync',{}],['DELETE','',{}]]){
   const count=seen.length;
   assert.equal((await fetch(prefix+suffix,{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})).status,403);
   assert.equal(seen.length,count);
   assert.equal((await fetch(prefix+suffix,{method,headers,body:JSON.stringify(body)})).status,200);
   assert.deepEqual(JSON.parse(seen.at(-1).options.body),body);
   assert.equal(seen.at(-1).options.headers['x-csrf-token'],'csrf');
   assert.equal(seen.at(-1).options.headers['X-AIRank-Workspace-ID'],undefined);
  }
  for(const suffix of ['/arbitrary','/connect/evil'])assert.equal((await fetch(prefix+suffix)).status,404);
  assert.equal((await fetch(prefix.replace('ga4','gmail'))).status,404);
 });
});
test('saved quick-check list and evidence are read-only and preserve upstream owner checks', async () => {
  const seen = [];
  await fixture(async (url, options) => {
    seen.push(url.pathname);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.cookie, '__Host-airank_session=owner');
    if (url.pathname === '/v1/projects/project/scans') return Response.json([{ id: 'scan-1', status: 'completed' }]);
    if (url.pathname === '/v1/scans/scan-1') return Response.json({ id: 'scan-1', project_id: 'project', observations: [{ provider: 'openai', answer_text: 'Saved answer' }] });
    return Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  }, async base => {
    const options = { headers: { cookie: '__Host-airank_session=owner' } };
    const list = await fetch(`${base}/v1/projects/project/scans`, options);
    assert.deepEqual(await list.json(), [{ id: 'scan-1', status: 'completed' }]);
    const report = await fetch(`${base}/v1/scans/scan-1`, options);
    assert.equal((await report.json()).observations[0].answer_text, 'Saved answer');
    assert.equal((await fetch(`${base}/v1/scans/other-owner`, options)).status, 403);
    assert.deepEqual(seen, ['/v1/projects/project/scans', '/v1/scans/scan-1', '/v1/scans/other-owner']);
  });
});
test('results preserve supported pagination filters and evidence, without forwarding owner overrides', async () => {
  const seen=[];
  await fixture(async(url,options)=>{
    seen.push({url,options});
    assert.equal(options.method,'GET');
    assert.equal(options.headers.cookie,'__Host-airank_session=owner');
    return Response.json({id:'evidence_1',answer:'Original <script> text',sentiment:{score:null,status:'not_mentioned'}});
  },async base=>{
    const params=new URLSearchParams({page:'2',pageSize:'25',runId:'run',promptId:'prompt',provider:'grok',topic:'Palvelu',from:'2026-10-01',to:'2026-10-15',state:'success',ownerId:'other',sentiment:'positive',search:'unsupported'});
    const response=await fetch(`${base}/v1/projects/owned/results?${params}`,{headers:{cookie:'__Host-airank_session=owner'}});
    assert.equal(response.status,200);
    for(const key of ['page','pageSize','runId','promptId','provider','topic','from','to','state']) assert.equal(seen[0].url.searchParams.get(key),params.get(key));
    for(const key of ['ownerId','sentiment','search']) assert.equal(seen[0].url.searchParams.has(key),false);
    const detail=await fetch(`${base}/v1/projects/owned/results/evidence_1?ownerId=other`,{headers:{cookie:'__Host-airank_session=owner'}});
    assert.equal((await detail.json()).answer,'Original <script> text');
    assert.equal(seen[1].url.search,'');
    assert.equal((await fetch(`${base}/v1/projects/owned/results`,{method:'POST'})).status,404);
  });
});
test('results preserve upstream ownership denial and sentiment backfill requires explicit protected POST',async()=>{
  let calls=0;
  await fixture(async(url,options)=>{
    calls++;
    if(options.method==='GET') return Response.json({error:{code:'FORBIDDEN'}},{status:403});
    assert.equal(url.pathname,'/v1/projects/owned/sentiment-backfill');
    assert.equal(options.headers['x-csrf-token'],'csrf');
    assert.deepEqual(JSON.parse(options.body),{runId:'existing-run'});
    return Response.json({queued:1});
  },async base=>{
    assert.equal((await fetch(`${base}/v1/projects/other/results/evidence`)).status,403);
    assert.equal((await fetch(`${base}/v1/projects/owned/sentiment-backfill`)).status,404);
    assert.equal((await fetch(`${base}/v1/projects/owned/sentiment-backfill`,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(`${base}/v1/projects/owned/sentiment-backfill`,{method:'POST',headers:{origin,'content-type':'application/json','x-csrf-token':'csrf'},body:JSON.stringify({runId:'existing-run'})})).status,200);
    assert.equal(calls,2);
  });
});
test('email authentication uses exact same-origin JSON without a pre-login CSRF token and forwards secure cookies',async()=>{
  let calls=0;
  await fixture(async(url,options)=>{
    calls++;assert.equal(options.headers.origin,origin);assert.equal(options.headers['x-airank-client'],'preview');
    assert.equal(url.pathname,'/v1/app/email/sign-in');
    return Response.json({authenticated:true},{headers:{'set-cookie':'__Host-airank_session=fixtureToken; Path=/; HttpOnly; Secure; SameSite=Lax'}});
  },async base=>{
    const body=JSON.stringify({email:'fixture@example.test',password:'offline password',locale:'en'});
    assert.equal((await fetch(`${base}/v1/app/email/sign-in`,{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body})).status,403);
    const r=await fetch(`${base}/v1/app/email/sign-in`,{method:'POST',headers:{origin,'content-type':'application/json'},body});
    assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);
    assert.equal((await fetch(`${base}/v1/projects`,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).status,403);
    assert.equal(calls,1);
  });
});
test('monitoring BFF keeps only prompt filters and forwards exact typed write body', async () => {
 const seen=[];
 await fixture(async (url,options)=>{
  seen.push({url,options});return Response.json({ok:true});
 },async base=>{
  const q=new URLSearchParams({status:'archived',search:'liittymä',topic:'Yritys',tag:'hinta',provider:'claude',outcome:'success',page:'2',sort:'text',url:'https://evil.test'});
  assert.equal((await fetch(`${base}/v1/projects/project/prompts?${q}`)).status,200);
  assert.equal(seen[0].url.searchParams.get('search'),'liittymä');
  assert.equal(seen[0].url.searchParams.get('url'),null);
  const body={submissionId:'stable-submission-id',kind:'neutral'};
  assert.equal((await fetch(`${base}/v1/projects/project/monitoring-runs`,{method:'POST',headers:{origin,'content-type':'application/json','x-csrf-token':'fixture-csrf'},body:JSON.stringify(body)})).status,200);
  assert.deepEqual(JSON.parse(seen[1].options.body),body);
  assert.equal(seen[1].options.headers['x-csrf-token'],'fixture-csrf');
 });
});
async function fixture(transport, fn) {
  const app = express();
  app.use('/api/airank', createAirankRouter({ origin, upstream: 'https://upstream.example.com', clientId: 'preview', transport }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}/api/airank`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('BFF rejects arbitrary paths/origins and forwards only named cookies to fixed upstream', async () => {
  let calls = 0;
  await fixture(async (url, options) => {
    calls++; assert.equal(url.origin, 'https://upstream.example.com');
    assert.equal(options.headers.cookie, '__Host-airank_session=abc');
    assert.equal(options.headers['x-airank-client'], 'preview');
    assert.equal(options.redirect, 'manual');
    assert.equal(url.search, '');
    return Response.json({ authenticated: false });
  }, async base => {
    assert.equal((await fetch(base + '/v1/admin/reset')).status, 404);
    assert.equal((await fetch(base + '/v1/projects', { method: 'POST', headers: { origin: 'https://evil.test' } })).status, 403);
    assert.equal((await fetch(base + '/v1/app/session?url=https://evil.test', { headers: { cookie: 'other=private; __Host-airank_session=abc' } })).status, 200);
    assert.equal(calls, 1);
  });
});
test('BFF unsupported upstream session becomes unavailable, not fake signed-out', async () => {
  await fixture(async () => Response.json({ error: 'Not found' }, { status: 404 }), async base => {
    const r = await fetch(base + '/v1/app/session'); assert.equal(r.status, 503);
    assert.equal((await r.json()).error.code, 'APP_NOT_CONFIGURED');
  });
});
test('BFF OAuth passes separate secure cookies and validates exact redirect target', async () => {
  let unsafe = false;
  await fixture(async () => {
    const h = new Headers({ location: unsafe ? 'https://evil.test' : `${origin}/en/dashboard` });
    h.append('set-cookie', '__Host-airank_session=abc; Path=/; HttpOnly; Secure; SameSite=Lax');
    h.append('set-cookie', '__Host-airank_app_oauth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    h.append('set-cookie', 'arbitrary=secret; Path=/; HttpOnly; Secure; SameSite=Lax');
    return new Response(null, { status: 302, headers: h });
  }, async base => {
    const r = await fetch(base + '/v1/app/google/callback?state=x&code=y', { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.getSetCookie().length, 2);
    assert.equal(r.headers.get('location'), `${origin}/en/dashboard`);
    unsafe = true;
    assert.equal((await fetch(base + '/v1/app/google/callback', { redirect: 'manual' })).status, 502);
  });
});
test('BFF validates JSON, body bounds and CSRF header before contacting upstream', async () => {
  await fixture(async () => { throw new Error('must not forward'); }, async base => {
    const headers = { origin, 'x-csrf-token': 'token', 'content-type': 'application/json' };
    assert.equal((await fetch(base + '/v1/projects', { method: 'POST', headers, body: '{' })).status, 400);
    assert.equal((await fetch(base + '/v1/projects', { method: 'POST', headers, body: JSON.stringify({ x: 'a'.repeat(70000) }) })).status, 413);
    assert.equal((await fetch(base + '/v1/projects', { method: 'POST', headers: { origin }, body: '{}' })).status, 403);
  });
});
test('cookie filtering never widens host scope', () => {
  assert.equal(safeCookies('arbitrary=a; __Host-airank_session=x'), '__Host-airank_session=x');
  assert.equal(safeSetCookie('__Host-airank_session=x; Path=/; Domain=example.com; Secure; HttpOnly; SameSite=Lax'), false);
  assert.equal(safeSetCookie('__Host-airank_session=x; Path=/; HttpOnly; SameSite=Lax'), false);
});
test('analytics GET forwards only supported filters and never allows writes', async () => {
  await fixture(async url => {
    assert.equal(url.pathname, '/v1/projects/owned/analytics');
    assert.equal(url.searchParams.get('provider'), 'openai');
    assert.equal(url.searchParams.get('topic'), 'Hinta');
    assert.equal(url.searchParams.get('group'), 'fixed');
    assert.equal(url.searchParams.get('runId'), 'run');
    assert.equal(url.searchParams.get('promptId'), 'prompt');
    assert.equal(url.searchParams.get('promptVersion'), '2');
    assert.equal(url.searchParams.get('tag'), 'pricing');
    assert.equal(url.searchParams.get('surface'), 'consumer_web');
    assert.equal(url.searchParams.get('from'), '2026-01-01');
    assert.equal(url.searchParams.get('to'), '2026-01-31');
    assert.equal(url.searchParams.has('ownerId'), false);
    return Response.json({ metrics: { score: 0 } });
  }, async base => {
    const r = await fetch(base + '/v1/projects/owned/analytics?provider=openai&topic=Hinta&tag=pricing&surface=consumer_web&group=fixed&runId=run&promptId=prompt&promptVersion=2&from=2026-01-01&to=2026-01-31&ownerId=other');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).metrics.score, 0);
    assert.equal((await fetch(base + '/v1/projects/owned/analytics', { method: 'POST' })).status, 404);
  });
});
test('logout JSON request reaches revocation endpoint through the real BFF', async () => {
  await fixture(async (url, options) => {
    assert.equal(url.pathname, '/v1/app/logout');
    assert.equal(options.headers['x-csrf-token'], 'fixture-csrf');
    assert.equal(options.body, '{}');
    return Response.json({ ok: true }, { headers: { 'set-cookie': '__Host-airank_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax' } });
  }, async base => {
    const r = await fetch(base + '/v1/app/logout', { method: 'POST', body: '{}',
      headers: { origin, 'content-type': 'application/json', 'x-csrf-token': 'fixture-csrf' } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
  });
});
test('scan POST refuses a legacy API before it can queue an unlinked paid job', async () => {
 let calls=0;
 await fixture(async (url, options) => {
  calls++; assert.equal(options.method,'GET');
  assert.equal(url.pathname,'/v1/projects/owned-project/scans');
  return Response.json({error:'Not found'},{status:404});
 }, async base => {
  const r=await fetch(base+'/v1/scans',{method:'POST',headers:{origin,'content-type':'application/json','x-csrf-token':'fixture'},body:JSON.stringify({project_id:'owned-project'})});
  assert.equal(r.status,503);assert.equal(calls,1);
 });
});
