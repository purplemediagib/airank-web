// Offline browser-test process only. Never imported by the app or deployed.
import express from 'express';
import {fileURLToPath} from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createAirankRouter } from '../src/routes/airank.ts';
import { migrations } from '../../../services/bunny-api/src/migrate.mjs';
import { migrateApp } from '../../../services/bunny-api/src/app/migration.mjs';
import { migrateProjectScans } from '../../../services/bunny-api/src/app/scan-migration.mjs';
import { migrateMonitoring } from '../../../services/bunny-api/src/monitoring/migration.mjs';
import { createMonitoringEngine } from '../../../services/bunny-api/src/monitoring/engine.mjs';
import { profileEvidence } from '../../../services/bunny-api/src/common/scan-profile.mjs';
import { createAppService } from '../../../services/bunny-api/src/app/service.mjs';
import { hashToken } from '../../../services/bunny-api/src/common/utils.mjs';
import { seedAnalytics } from './analytics-seed.mjs';
import {migrateResearch} from '../../../services/bunny-api/src/research/migration.mjs';
import {migrateScheduling} from '../../../services/bunny-api/src/scheduling/migration.mjs';
import {migrateOpportunities} from '../../../services/bunny-api/src/opportunities/migration.mjs';
import {migrateReports} from '../../../services/bunny-api/src/reports/migration.mjs';
import {migrateWebsiteProfiles} from '../../../services/bunny-api/src/website-profile/migration.mjs';
import {migrateContextDrafts} from '../../../services/bunny-api/src/common/context-migration.mjs';
import {migrateEmailAuth} from '../../../services/bunny-api/src/app/email-migration.mjs';
import {tickWebsiteProfiles} from '../../../services/bunny-api/src/website-profile/worker.mjs';
import {normalizeWebsite} from '../../../services/bunny-api/src/common/website-url.mjs';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const ddl of migrations) sqlite.exec(ddl);
const execute = async q => {
  const sql = typeof q === 'string' ? q : q.sql, args = typeof q === 'string' ? [] : q.args || [];
  const s = sqlite.prepare(sql);
  if (/^\s*SELECT|RETURNING/i.test(sql)) return { rows: s.all(...args) };
  return { rows: [], rowsAffected: Number(s.run(...args).changes) };
};
let transactionTail=Promise.resolve();
const db = { execute, transaction: async () => {
  let release;const next=new Promise(r=>release=r),previous=transactionTail;transactionTail=next;await previous;
  sqlite.exec('BEGIN IMMEDIATE');
  return { execute, commit: async () => sqlite.exec('COMMIT'), rollback: async () => sqlite.exec('ROLLBACK'), close:release };
} };
await migrateApp(db);
await migrateProjectScans(db);
await migrateMonitoring(db);
await migrateResearch(db);
await migrateScheduling(db);
await migrateOpportunities(db);
await migrateReports(db);
await migrateWebsiteProfiles(db);
await migrateContextDrafts(db);
await migrateEmailAuth(db);
for (const id of ['alice', 'bob']) {
  sqlite.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(id, `fixture-${id}`, `${id}@example.test`, id, '', 1, 1);
  sqlite.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(hashToken(`fixture-${id}`), id, Date.now() + 3600000, 1);
}
const origin = 'https://fixture.example.test';
const fixtureEnv={RATE_LIMIT_SECRET:'isolated-browser-fixture-at-least-24',APP_ENV:'staging',DISABLE_FREE_SCAN_LIMITS:'true',MONITORING_ENABLED:'true',ENABLED_PROVIDERS:'openai,claude',MAX_DAILY_PROVIDER_CALLS:'1000',MONITORING_PROVIDER_TIMEOUT_MS:'1000'};
Object.assign(fixtureEnv,{APP_ADMIN_USER_IDS:'alice',PROJECT_SCHEDULER_ENABLED:'true',BENCHMARK_ENABLED:'true',BENCHMARK_SCHEDULER_ENABLED:'true'});
fixtureEnv.WEBSITE_PROFILE_ENABLED='true';
Object.assign(fixtureEnv,{EMAIL_AUTH_ENABLED:'true',RESEND_API_KEY:'offline-only',AUTH_EMAIL_FROM:'AI Rank <accounts@example.test>',GOOGLE_CLIENT_ID:'offline-client',GOOGLE_CLIENT_SECRET:'offline-secret'});
const authMails=[];
const service = createAppService({ db, clients: { fixture: { origin, redirectUri: `${origin}/api/airank/v1/app/google/callback` } }, env:fixtureEnv,sendMail:async mail=>authMails.push(mail) });
const transport = async (url, opts) => {
  try {
    const r = await service({ method: opts.method, path: url.pathname, query: url.searchParams, headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : undefined });
    return Response.json(r.data, { status: r.status, headers: r.headers });
  } catch (e) { return Response.json({ error: { code: e.code, fieldErrors: e.fieldErrors } }, { status: e.status || 500 }); }
};
const app = express();
app.post('/__fixture/autofill',async(_req,res)=>{await tickWebsiteProfiles(db,{env:fixtureEnv,validate:async url=>{if(url.includes('failed.fi'))throw Error('WEBSITE_UNAVAILABLE');return normalizeWebsite(url);},scrape:async site=>({text:'Fixture website content',source:site.website}),infer:async(site,content)=>({draft:{brandName:'BrandCASE',aliases:['Brand CASE'],ownedDomains:[site.domain],categoryFi:'Ohjelmistopalvelut yrityksille'},sources:[content.source]})});res.json({ok:true});});
app.post('/__fixture/analytics',(_req,res)=>res.json(seedAnalytics(sqlite)));
app.post('/__fixture/qa',(_req,res)=>{
 const {projectId}=seedAnalytics(sqlite);
 // Explicitly isolated malicious/unknown labels and formula-like text for QA; never used by the app server.
 const r=sqlite.prepare("SELECT id,payload FROM mon_evidence WHERE id='analytics-run-1-0'").get();
 if(r){const e=JSON.parse(r.payload);e.answer='1. Rival — palvelu\n2. Other — vaihtoehto\n3. Third — vaihtoehto\n<script>alert(1)</script>\n=HYPERLINK(\"https://invalid.test\")';sqlite.prepare('UPDATE mon_evidence SET payload=? WHERE id=?').run(JSON.stringify(e),r.id);}
 res.json({projectId});
});
let fixtureCalls=0;
const monitoringEngine=createMonitoringEngine({db,env:fixtureEnv,available:()=>true,call:async(provider,text,route)=>{
 fixtureCalls++;await new Promise(r=>setTimeout(r,100));
 return {status:'success',model:route.model,answer:`Fixture-provider answer for ${text}. Example Oy.`,citations:[{url:'https://example.fi/fixture',title:'Fixture source'}]};
}});
app.post('/__fixture/monitor',async(_req,res)=>{try{await monitoringEngine.tick();res.json({calls:fixtureCalls});}catch(e){res.status(500).json({error:String(e)});}});
// Loopback-only fixture provider completion, never part of the production API.
app.post('/__fixture/settle/:id', (req,res) => {
 const mode=req.query.mode||'complete';
 if(!['complete','zero','none','partial','failed','legacy'].includes(mode)) return res.sendStatus(400);
 const saved=sqlite.prepare('SELECT profile_json FROM scan_profiles WHERE scan_id=?').get(req.params.id);
 if(!saved) return res.sendStatus(404);
 const profile=JSON.parse(saved.profile_json);
 const prompts=sqlite.prepare('SELECT id FROM scan_prompts WHERE scan_id=? ORDER BY sequence').all(req.params.id);
 let i=0;
 for(const provider of profile.providers) for(const prompt of prompts) {
  const status=['none','failed'].includes(mode)||(mode==='partial'&&provider!==profile.providers[0])?'failed':'success';
  const text=(mode!=='zero' && i%3!==2)?`${profile.brand_name} on yksi vaihtoehto Suomessa.`:'Muita vaihtoehtoja Suomessa.';
  const citations=[{url:`https://${profile.domain}/fixture-source`,title:'Fixture source'}];
  const evidence=profileEvidence(text,profile,citations);
  sqlite.prepare('INSERT OR REPLACE INTO observations (id,scan_id,prompt_id,provider,provider_status,model,answer_text,citations_json,brand_mentioned,own_domain_cited,observed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
   .run(`fixture-${req.params.id}-${i++}`,req.params.id,prompt.id,provider,status,'fixture-model',text,JSON.stringify(citations),Number(evidence.mentioned),Number(evidence.ownCitation),Date.now());
 }
 sqlite.prepare('UPDATE scan_jobs SET status=?,finished_at=? WHERE id=?').run(mode==='failed'?'failed':mode==='none'?'no_measurements':'completed',Date.now(),req.params.id);
 if(mode==='legacy') sqlite.prepare('DELETE FROM scan_profiles WHERE scan_id=?').run(req.params.id);
 res.json({ok:true});
});
// Only this isolated test process accepts a fixture origin; real BFF remains exact-origin.
app.get('/fixture/auth-code',(req,res)=>{
 const mail=[...authMails].reverse().find(m=>m.email===req.query.email);
 res.json(mail?{code:mail.code,locale:mail.locale,kind:mail.kind}:{});
});
app.use('/api/airank', (req, _res, next) => { if (req.method !== 'GET') req.headers.origin = origin; next(); },
  createAirankRouter({ origin, upstream: 'https://upstream.example.test', clientId: 'fixture', transport }));
const staticRoot=fileURLToPath(new URL('../../airank/dist/public/',import.meta.url));
app.use(express.static(staticRoot));
app.get(/^\/(?:fi|en)(?:\/|$)/,(_req,res)=>res.sendFile(`${staticRoot}index.html`));
app.listen(9137, '127.0.0.1', () => console.log('Offline fixture ready on 9137'));
