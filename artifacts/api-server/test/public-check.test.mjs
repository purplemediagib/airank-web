import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createPublicCheckRouter,clientAddress} from '../src/routes/public-check.ts';
import {registerPublicCheckPages,redactPublicPath} from '../src/routes/public-check-pages.ts';
import {verifyProxy} from '../../../services/bunny-api/src/public-check/security.mjs';
const origin='https://app.example.test',secret='fixture-shared-proxy-secret-not-real-48chars';
async function fixture(transport,run,extra={}){
 const app=express();app.use('/api/public-check',createPublicCheckRouter({env:{AIRANK_PUBLIC_ORIGIN:origin,AIRANK_API_ORIGIN:'https://bunny.example.test',PUBLIC_CHECK_PROXY_SECRET:secret,PUBLIC_CHECK_TRUST_PROXY_HOPS:'1'},transport,...extra}));
 registerPublicCheckPages(app,async()=>'<html><body>public checker entry</body></html>');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(r=>server.close(r));}
}
test('public BFF proves trusted visitor address without leaking app credentials and rejects cross-origin writes',async()=>{
 let calls=0;
 await fixture(async(url,options)=>{
  calls++;assert.equal(url,'https://bunny.example.test/v1/public-check/preview');
  assert.equal(options.headers.cookie,undefined);assert.equal(options.headers['x-airank-client'],undefined);assert.equal(options.headers['X-Scan-Token'],'s'.repeat(43));
  const lower=Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v]));
  assert.equal(lower['x-check-address'],'203.0.113.5');
  assert(verifyProxy({method:options.method,path:new URL(url).pathname,body:options.body,headers:lower,env:{PUBLIC_CHECK_PROXY_SECRET:secret}}));
  return Response.json({ok:true});
 },async base=>{
  const opts={method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'__Host-airank_session=private','X-Scan-Token':'s'.repeat(43),'X-Forwarded-For':'forged, 203.0.113.5'},body:'{"domain":"example.fi"}'};
  assert.equal((await fetch(base+'/api/public-check/v1/preview',{...opts,headers:{...opts.headers,Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(base+'/api/public-check/v1/preview',opts)).status,200);
  assert.equal((await fetch(base+'/api/public-check/v1/projects')).status,404);assert.equal(calls,1);
 });
});
test('public bearer report reads are redacted and forwarded in signed body, not Bunny URL',async()=>{
 const token='a'.repeat(43);
 await fixture(async(url,options)=>{
  assert.equal(url,'https://bunny.example.test/v1/public-check/reports/open');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{token});
  return Response.json({id:'report-fixture'});
 },async base=>{
  const result=await fetch(base+'/api/public-check/v1/reports/'+token);assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.match(result.headers.get('referrer-policy'),/no-referrer/);
  assert(!redactPublicPath('/api/public-check/v1/reports/'+token+'?email=private').includes(token));
  assert(!redactPublicPath('/en/report/'+token).includes(token));
 });
});
test('only public embed paths permit approved Framer origins, reports cannot be framed and stay noindex',async()=>{
 await fixture(async()=>Response.json({}),async base=>{
  const embed=await fetch(base+'/en/free-check/embed');
  assert.equal(embed.status,200);assert.equal(embed.headers.get('content-security-policy'),'frame-ancestors https://airank.me https://www.airank.me');
  assert.equal(embed.headers.get('x-frame-options'),null);assert.match(embed.headers.get('x-robots-tag'),/noindex/);
  const report=await fetch(base+'/fi/report/'+'a'.repeat(43));assert.equal(report.status,200);assert.equal(report.headers.get('content-security-policy'),"frame-ancestors 'none'");assert.match(report.headers.get('cache-control'),/no-store/);
 });
});
test('unconfigured BFF reports disabled capability truthfully; bounded invalid bodies fail before transport',async()=>{
 let calls=0;
 await fixture(async()=>{calls++;return Response.json({enabled:true,emailEnabled:true,marketingEnabled:true,autofillEnabled:true});},async base=>{
  const caps=await (await fetch(base+'/api/public-check/v1/capabilities')).json();assert.equal(caps.enabled,false);
  assert.equal((await fetch(base+'/api/public-check/v1/scans',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,503);assert.equal(calls,1);
 },{env:{AIRANK_PUBLIC_ORIGIN:origin,AIRANK_API_ORIGIN:'https://bunny.example.test'}});
 await fixture(async()=>{throw Error('must not reach transport');},async base=>{
  assert.equal((await fetch(base+'/api/public-check/v1/scans',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({data:'x'.repeat(20000)})})).status,413);
 });
});
test('client IP selection trusts configured appended hops, not attacker-controlled leftmost headers',()=>{
 const req={get:()=> '1.2.3.4, 203.0.113.8',socket:{remoteAddress:'127.0.0.1'}};
 assert.equal(clientAddress(req,0),'127.0.0.1');assert.equal(clientAddress(req,1),'203.0.113.8');
});
